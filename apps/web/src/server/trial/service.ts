import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { requireActor, requireMembership } from "../workspaces/service";
import { AccessError } from "../workspaces/policy";
import { resolveWorkspaceEntitlements } from "../billing/entitlements";
import { TRIAL_DURATION_MS, jakartaDate, trialSnapshot } from "./state";
import { assertWorkspaceWritable } from "../lifecycle/state";
type Tx = Prisma.TransactionClient;
export class TrialError extends Error {
  constructor(
    public code:
      | "NOT_ACTIVATED"
      | "EXPIRED"
      | "DAILY_LIMIT"
      | "TOTAL_LIMIT"
      | "IDEMPOTENCY_CONFLICT"
      | "MONTHLY_LIMIT"
      | "ENTITLEMENT_MISSING",
  ) {
    super(code);
  }
}

/**
 * Subscription allowance for new transactions, read only from the verified
 * (signature-checked) provider entitlement. Returns null when the workspace has
 * no valid license, so callers fall back to the local trial rules.
 *
 * `MONTHLY_TRANSACTIONS` semantics: a non-negative integer is a monthly cap;
 * an explicit `null` means unlimited; an absent key fails closed.
 */
export type CreationAllowance = {
  mode: "ENTITLED";
  planCode: string | null;
  monthlyLimit: number | null;
  usedThisMonth: number;
  remainingThisMonth: number | null;
};
/** Plan code recorded on usage receipts metered under a per-invoice offer. */
export const PER_INVOICE_PLAN_CODE = "PER_INVOICE";

export function jakartaMonthStart(now: Date) {
  return new Date(`${jakartaDate(now).slice(0, 7)}-01T00:00:00+07:00`);
}

/** Active per-invoice offer (signed offer letter entered by a Superadmin). */
export async function activePerInvoiceOffer(
  tx: Tx,
  organizationId: string,
  now: Date,
) {
  const offer = await tx.organizationOffer.findUnique({
    where: { organizationId },
  });
  if (!offer || !offer.active || offer.pricingModel !== "PER_INVOICE")
    return null;
  const today = jakartaDate(now);
  const from = offer.effectiveFrom.toISOString().slice(0, 10);
  const to = offer.effectiveTo?.toISOString().slice(0, 10) ?? null;
  if (today < from || (to !== null && today > to)) return null;
  return offer;
}

export async function entitledAllowance(
  tx: Tx,
  organizationId: string,
  now: Date,
): Promise<CreationAllowance | null> {
  // Sales-led per-invoice offer: metered usage instead of a plan quota.
  const offer = await activePerInvoiceOffer(tx, organizationId, now);
  if (offer) {
    const used = await tx.entitledUsage.count({
      where: { organizationId, createdAt: { gte: jakartaMonthStart(now) } },
    });
    return {
      mode: "ENTITLED",
      planCode: PER_INVOICE_PLAN_CODE,
      monthlyLimit: offer.monthlyInvoiceCap,
      usedThisMonth: used,
      remainingThisMonth:
        offer.monthlyInvoiceCap === null
          ? null
          : Math.max(0, offer.monthlyInvoiceCap - used),
    };
  }
  const resolved = await resolveWorkspaceEntitlements(tx, organizationId, now);
  if (!resolved.paidAccessEnabled && !resolved.nonProductionTestActive)
    return null;
  const raw = resolved.entitlements.MONTHLY_TRANSACTIONS;
  if (raw === undefined) throw new TrialError("ENTITLEMENT_MISSING");
  const limit =
    raw === null
      ? null
      : typeof raw === "number" && Number.isInteger(raw) && raw >= 0
        ? raw
        : undefined;
  if (limit === undefined) throw new TrialError("ENTITLEMENT_MISSING");
  // Count durable receipts (voiding never refunds) in the Asia/Jakarta month.
  const monthStart = new Date(
    `${jakartaDate(now).slice(0, 7)}-01T00:00:00+07:00`,
  );
  const used = await tx.entitledUsage.count({
    where: { organizationId, createdAt: { gte: monthStart } },
  });
  return {
    mode: "ENTITLED",
    planCode: resolved.planCode,
    monthlyLimit: limit,
    usedThisMonth: used,
    remainingThisMonth: limit === null ? null : Math.max(0, limit - used),
  };
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
export type PersistDrafts = (
  tx: Tx,
  context: { userId: string; organizationId: string; createdAt: Date },
) => Promise<{ ids: string[] }>;
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
  /**
   * Creates one or more drafts under exactly one quota source:
   * - ENTITLED: the workspace holds a verified license (paid Berlanggan, or a
   *   SYNTHETIC_TEST license in non-production). The signed
   *   `MONTHLY_TRANSACTIONS` entitlement caps creation; trial quota is untouched.
   * - TRIAL: otherwise, the unchanged 72h / 1-per-Jakarta-day / 3-total ledger,
   *   which by definition admits a single draft per request.
   * Locks, role check, receipts, drafts and audit commit or roll back together.
   * The caller validates/fingerprints each draft and persists only through `tx`.
   */
  async function createMany(
    sessionId: string,
    inputs: TrialCreation[],
    persist: PersistDrafts,
  ) {
    const parsed = z.array(creationSchema).min(1).max(500).parse(inputs);
    if (new Set(parsed.map((p) => p.idempotencyKey)).size !== parsed.length)
      throw new TrialError("IDEMPOTENCY_CONFLICT");
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
        await assertWorkspaceWritable(
          tx,
          organizationId,
          await databaseNow(tx),
        );
        const hashes = parsed.map((p) =>
          createHash("sha256")
            .update(JSON.stringify([organizationId, p.payloadFingerprint]))
            .digest("hex"),
        );
        const keys = parsed.map((p) => p.idempotencyKey);
        const [trialReceipts, entitledReceipts] = await Promise.all([
          tx.trialUsage.findMany({
            where: { userId: session.userId, idempotencyKey: { in: keys } },
          }),
          tx.entitledUsage.findMany({
            where: { organizationId, idempotencyKey: { in: keys } },
          }),
        ]);
        const receipts = new Map<
          string,
          { requestHash: string; transactionId: string }
        >();
        for (const r of [...trialReceipts, ...entitledReceipts])
          receipts.set(r.idempotencyKey, r);
        if (receipts.size > 0) {
          // A receipt remains valid even after deletion/expiry; it never recreates a draft.
          // Partial replays of a multi-draft request are rejected, never merged.
          if (receipts.size !== keys.length)
            throw new TrialError("IDEMPOTENCY_CONFLICT");
          const ids = keys.map((key, i) => {
            const r = receipts.get(key)!;
            if (r.requestHash !== hashes[i])
              throw new TrialError("IDEMPOTENCY_CONFLICT");
            return r.transactionId;
          });
          return { transactionIds: ids, replay: true, mode: null };
        }

        const now = await databaseNow(tx);
        const allowance = await entitledAllowance(tx, organizationId, now);

        if (allowance) {
          if (
            allowance.remainingThisMonth !== null &&
            parsed.length > allowance.remainingThisMonth
          )
            throw new TrialError("MONTHLY_LIMIT");
          const drafts = await persist(tx, {
            userId: session.userId,
            organizationId,
            createdAt: now,
          });
          if (drafts.ids.length !== parsed.length)
            throw new Error("PERSISTED_COUNT_MISMATCH");
          drafts.ids.forEach((id) => z.string().min(1).max(200).parse(id));
          await tx.entitledUsage.createMany({
            data: drafts.ids.map((id, i) => ({
              organizationId,
              userId: session.userId,
              transactionId: id,
              idempotencyKey: keys[i],
              requestHash: hashes[i],
              planCode: allowance.planCode,
              createdAt: now,
            })),
          });
          await tx.workspaceAudit.createMany({
            data: drafts.ids.map((id) => ({
              organizationId,
              actorId: session.userId,
              action: "ENTITLED_TRANSACTION_CREATED",
              targetId: id,
            })),
          });
          return {
            transactionIds: drafts.ids,
            replay: false,
            mode: "ENTITLED" as const,
          };
        }

        const current = await status(tx, session.userId);
        if (current.state !== "ACTIVE") throw new TrialError(current.state);
        // The trial admits one new draft per Jakarta day, so never more than one per request.
        if (parsed.length > 1) throw new TrialError("DAILY_LIMIT");
        const drafts = await persist(tx, {
          userId: session.userId,
          organizationId,
          createdAt: new Date(current.serverNow),
        });
        if (drafts.ids.length !== 1)
          throw new Error("PERSISTED_COUNT_MISMATCH");
        const draftId = z.string().min(1).max(200).parse(drafts.ids[0]);
        // If persistence crosses midnight/expiry, recheck before committing any write.
        const finalState = await status(tx, session.userId);
        if (finalState.state !== "ACTIVE")
          throw new TrialError(finalState.state);
        const committedAt = new Date(finalState.serverNow);
        await tx.trialUsage.create({
          data: {
            userId: session.userId,
            organizationId,
            transactionId: draftId,
            idempotencyKey: keys[0],
            requestHash: hashes[0],
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
            targetId: draftId,
          },
        });
        return {
          transactionIds: [draftId],
          replay: false,
          mode: "TRIAL" as const,
        };
      },
      { maxWait: 15000, timeout: 20000 },
    );
  }

  async function create(
    sessionId: string,
    input: TrialCreation,
    persist: PersistDraft,
  ) {
    const result = await createMany(sessionId, [input], async (tx, context) => {
      const draft = await persist(tx, context);
      return { ids: [draft.id] };
    });
    return { transactionId: result.transactionIds[0], replay: result.replay };
  }

  /** Read-only creation allowance for the active workspace (UI display). */
  async function allowance(sessionId: string) {
    return db.$transaction(async (tx) => {
      const actor = await requireActor(tx, sessionId);
      if (!actor.activeOrganizationId) return null;
      await requireMembership(tx, sessionId, actor.activeOrganizationId);
      return entitledAllowance(
        tx,
        actor.activeOrganizationId,
        await databaseNow(tx),
      ).catch((error) => {
        if (error instanceof TrialError) return null;
        throw error;
      });
    });
  }
  return { snapshot, activate, create, createMany, allowance };
}
