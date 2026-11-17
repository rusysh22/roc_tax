import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { requireActor, requireMembership } from "../workspaces/service";
import { AccessError } from "../workspaces/policy";
import { TRIAL_DURATION_MS, jakartaDate, trialSnapshot } from "./state";
type Tx = Prisma.TransactionClient;
export class TrialError extends Error {
  constructor(
    public code:
      | "NOT_ACTIVATED"
      | "EXPIRED"
      | "DAILY_LIMIT"
      | "TOTAL_LIMIT"
      | "IDEMPOTENCY_CONFLICT",
  ) {
    super(code);
  }
}
const creationSchema = z
  .object({
    idempotencyKey: z.uuid(),
    payloadFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type TrialCreation = z.infer<typeof creationSchema>;
export type PersistDraft = (
  tx: Tx,
  context: { userId: string; organizationId: string; createdAt: Date },
) => Promise<{ id: string }>;
async function databaseNow(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}
async function lockAccount(tx: Tx, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}
async function status(tx: Tx, userId: string) {
  const trial = await tx.trialAccount.findUnique({
    where: { userId },
    include: { usage: { select: { jakartaDate: true } } },
  });
  return trialSnapshot(await databaseNow(tx), trial, trial?.usage ?? []);
}
export function trialService(db: PrismaClient) {
  async function snapshot(sessionId: string) {
    return db.$transaction(async (tx) => {
      const initial = await requireActor(tx, sessionId);
      await lockAccount(tx, initial.userId);
      const actor = await requireActor(tx, sessionId);
      return status(tx, actor.userId);
    });
  }
  async function activate(sessionId: string) {
    return db.$transaction(async (tx) => {
      const initial = await requireActor(tx, sessionId);
      await lockAccount(tx, initial.userId);
      const actor = await requireActor(tx, sessionId);
      if (
        !(await tx.trialAccount.findUnique({ where: { userId: actor.userId } }))
      ) {
        const now = await databaseNow(tx);
        await tx.trialAccount.create({
          data: {
            userId: actor.userId,
            activatedAt: now,
            expiresAt: new Date(now.getTime() + TRIAL_DURATION_MS),
          },
        });
      }
      return status(tx, actor.userId);
    });
  }
  // Internal only: no public draft creation endpoint exists in Batch 02.
  // The caller must validate/normalize a draft, fingerprint its complete payload,
  // and perform all persistence through the supplied transaction. No network I/O.
  async function create(
    sessionId: string,
    input: TrialCreation,
    persist: PersistDraft,
  ) {
    const parsed = creationSchema.parse(input);
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    return db.$transaction(
      async (tx) => {
        // Follow existing workspace lock order: organization, then account.
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
        await lockAccount(tx, initial.userId);
        const { session } = await requireMembership(
          tx,
          sessionId,
          organizationId,
          "draft.prepare",
        );
        if (session.activeOrganizationId !== organizationId)
          throw new AccessError("CONFLICT");
        const requestHash = createHash("sha256")
          .update(JSON.stringify([organizationId, parsed.payloadFingerprint]))
          .digest("hex");
        const receipt = await tx.trialUsage.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: session.userId,
              idempotencyKey: parsed.idempotencyKey,
            },
          },
        });
        if (receipt) {
          if (receipt.requestHash !== requestHash)
            throw new TrialError("IDEMPOTENCY_CONFLICT");
          // A receipt remains valid even after deletion/expiry; it never recreates a draft.
          return { transactionId: receipt.transactionId, replay: true };
        }
        const current = await status(tx, session.userId);
        if (current.state !== "ACTIVE") throw new TrialError(current.state);
        const now = new Date(current.serverNow);
        const draft = await persist(tx, {
          userId: session.userId,
          organizationId,
          createdAt: now,
        });
        z.string().min(1).max(200).parse(draft.id);
        // If persistence crosses midnight/expiry, recheck before committing any write.
        const finalState = await status(tx, session.userId);
        if (finalState.state !== "ACTIVE")
          throw new TrialError(finalState.state);
        const committedAt = new Date(finalState.serverNow);
        await tx.trialUsage.create({
          data: {
            userId: session.userId,
            organizationId,
            transactionId: draft.id,
            idempotencyKey: parsed.idempotencyKey,
            requestHash,
            jakartaDate: jakartaDate(committedAt),
            slot: finalState.usedTotal + 1,
            createdAt: committedAt,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "TRIAL_TRANSACTION_CREATED",
            targetId: draft.id,
          },
        });
        return { transactionId: draft.id, replay: false };
      },
      { maxWait: 15000, timeout: 10000 },
    );
  }
  return { snapshot, activate, create };
}
