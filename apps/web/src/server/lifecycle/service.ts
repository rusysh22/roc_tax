import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import type { DocumentStorage } from "../intake/storage";
import { AccessError } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import { DAY_MS, lifecycleConfig, type LifecycleConfig } from "./state";

type Tx = Prisma.TransactionClient;

export class LifecycleError extends Error {
  constructor(
    public code:
      "ALREADY_REQUESTED" | "NOT_CANCELLABLE" | "NOT_FOUND" | "OWNER_ONLY",
  ) {
    super(code);
  }
}

const requestSchema = z
  .object({ reason: z.string().trim().max(1000).default("") })
  .strict();
const adminSchema = z
  .object({
    organizationId: z.string().min(1).max(100),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();

async function databaseNow(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}

function view(t: {
  id: string;
  status: string;
  reason: string;
  requestedAt: Date;
  effectiveAt: Date;
  terminatedAt: Date | null;
  purgeAfter: Date | null;
  purgedAt: Date | null;
  purgedDocuments: number;
  purgedExports: number;
}) {
  return {
    id: t.id,
    status: t.status,
    reason: t.reason,
    requestedAt: t.requestedAt.toISOString(),
    effectiveAt: t.effectiveAt.toISOString(),
    terminatedAt: t.terminatedAt?.toISOString() ?? null,
    purgeAfter: t.purgeAfter?.toISOString() ?? null,
    purgedAt: t.purgedAt?.toISOString() ?? null,
    purgedDocuments: t.purgedDocuments,
    purgedExports: t.purgedExports,
  };
}

/**
 * Subscription termination and automatic data deletion.
 *
 * Owner requests termination → after the notice period the workspace is
 * read-only (TERMINATED) → after the retention period stored documents and
 * generated XML files are deleted (PURGED). Accounting records, tax
 * snapshots and the audit trail are kept as business records.
 */
export function lifecycleService(
  db: PrismaClient,
  storage: DocumentStorage,
  config: LifecycleConfig = lifecycleConfig(),
) {
  async function active(sessionId: string) {
    const session = await requireActor(db, sessionId);
    if (!session.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    return requireMembership(db, sessionId, session.activeOrganizationId);
  }

  async function status(sessionId: string) {
    const { membership } = await active(sessionId);
    const current = await db.workspaceTermination.findFirst({
      where: {
        organizationId: membership.organizationId,
        status: { not: "CANCELLED" },
      },
      orderBy: { createdAt: "desc" },
    });
    return {
      canManage: membership.role === "OWNER",
      noticeDays: config.noticeDays,
      retentionDays: config.retentionDays,
      termination: current ? view(current) : null,
    };
  }

  async function request(sessionId: string, raw: unknown) {
    const { reason } = requestSchema.parse(raw);
    const session = await requireActor(db, sessionId);
    if (!session.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = session.activeOrganizationId;
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
      const { membership } = await requireMembership(
        tx,
        sessionId,
        organizationId,
      );
      if (membership.role !== "OWNER") throw new LifecycleError("OWNER_ONLY");
      const existing = await tx.workspaceTermination.findFirst({
        where: { organizationId, status: { not: "CANCELLED" } },
      });
      if (existing) throw new LifecycleError("ALREADY_REQUESTED");
      const now = await databaseNow(tx);
      const created = await tx.workspaceTermination.create({
        data: {
          organizationId,
          reason,
          requestedBy: session.userId,
          requestedAt: now,
          effectiveAt: new Date(now.getTime() + config.noticeDays * DAY_MS),
        },
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId,
          actorId: session.userId,
          action: "TERMINATION_REQUESTED",
          targetId: created.id,
        },
      });
      return view(created);
    });
  }

  async function cancel(sessionId: string) {
    const session = await requireActor(db, sessionId);
    if (!session.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = session.activeOrganizationId;
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
      const { membership } = await requireMembership(
        tx,
        sessionId,
        organizationId,
      );
      if (membership.role !== "OWNER") throw new LifecycleError("OWNER_ONLY");
      const now = await databaseNow(tx);
      const pending = await tx.workspaceTermination.findFirst({
        where: {
          organizationId,
          status: "REQUESTED",
          effectiveAt: { gt: now },
        },
      });
      if (!pending) throw new LifecycleError("NOT_CANCELLABLE");
      await tx.workspaceTermination.update({
        where: { id: pending.id },
        data: {
          status: "CANCELLED",
          cancelledBy: session.userId,
          cancelledAt: now,
        },
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId,
          actorId: session.userId,
          action: "TERMINATION_CANCELLED",
          targetId: pending.id,
        },
      });
      return { ok: true };
    });
  }

  /** Superadmin: end a subscription now (e.g. contract ended, non-payment). */
  async function adminTerminate(sessionId: string, raw: unknown) {
    const command = adminSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const session = await requireActor(tx, sessionId);
      if (session.user.platformRole !== "SUPERADMIN")
        throw new AccessError("FORBIDDEN");
      const org = await tx.organization.findUnique({
        where: { id: command.organizationId },
      });
      if (!org) throw new LifecycleError("NOT_FOUND");
      const now = await databaseNow(tx);
      const purgeAfter = config.retentionDays
        ? new Date(now.getTime() + config.retentionDays * DAY_MS)
        : null;
      const pending = await tx.workspaceTermination.findFirst({
        where: { organizationId: org.id, status: "REQUESTED" },
      });
      const data = {
        status: "TERMINATED" as const,
        effectiveAt: now,
        terminatedAt: now,
        purgeAfter,
      };
      const saved = pending
        ? await tx.workspaceTermination.update({
            where: { id: pending.id },
            data,
          })
        : await tx.workspaceTermination.create({
            data: {
              organizationId: org.id,
              reason: command.reason,
              requestedBy: session.userId,
              requestedAt: now,
              ...data,
            },
          });
      await tx.workspaceAudit.create({
        data: {
          organizationId: org.id,
          actorId: session.userId,
          action: "WORKSPACE_TERMINATED",
          targetId: saved.id,
        },
      });
      return view(saved);
    });
  }

  /** Superadmin list of all terminations (any status). */
  async function adminList(sessionId: string) {
    const session = await requireActor(db, sessionId);
    if (session.user.platformRole !== "SUPERADMIN")
      throw new AccessError("FORBIDDEN");
    const rows = await db.workspaceTermination.findMany({
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    return {
      noticeDays: config.noticeDays,
      retentionDays: config.retentionDays,
      terminations: rows.map((r) => ({
        ...view(r),
        workspace: r.organization.name,
        organizationId: r.organizationId,
      })),
    };
  }

  /** Deletes stored documents and XML files of one terminated workspace. */
  async function purgeWorkspace(terminationId: string, organizationId: string) {
    const [documents, batches] = await Promise.all([
      db.sourceDocument.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, storageKey: true },
      }),
      db.xmlExportBatch.findMany({
        where: {
          organizationId,
          NOT: { storageKey: { contains: "/purged-" } },
        },
        select: { id: true, storageKey: true },
      }),
    ]);
    for (const doc of documents) {
      await db.$transaction(async (tx) => {
        const now = await databaseNow(tx);
        await tx.ocrCandidate.deleteMany({
          where: { documentId: doc.id, organizationId },
        });
        await tx.sourceDocument.update({
          where: { id: doc.id },
          data: {
            deletedAt: now,
            deletedBy: "system:retention",
            storageKey: `${organizationId}/deleted-${doc.id}`,
          },
        });
      });
      await storage.remove(organizationId, doc.storageKey).catch(() => {});
    }
    for (const batch of batches) {
      await db.xmlExportBatch.update({
        where: { id: batch.id },
        data: { storageKey: `${organizationId}/purged-${batch.id}` },
      });
      await storage.remove(organizationId, batch.storageKey).catch(() => {});
    }
    await db.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      await tx.workspaceTermination.update({
        where: { id: terminationId },
        data: {
          status: "PURGED",
          purgedAt: now,
          purgedDocuments: documents.length,
          purgedExports: batches.length,
        },
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId,
          actorId: "system",
          action: "DATA_PURGED",
          targetId: terminationId,
        },
      });
    });
    return { documents: documents.length, exports: batches.length };
  }

  /**
   * Scheduled job (cron): applies due terminations and purges workspaces
   * whose retention period has ended. Safe to run repeatedly.
   */
  async function runScheduled(now = new Date()) {
    const due = await db.workspaceTermination.findMany({
      where: { status: "REQUESTED", effectiveAt: { lte: now } },
    });
    for (const t of due) {
      await db.workspaceTermination.update({
        where: { id: t.id },
        data: {
          status: "TERMINATED",
          terminatedAt: t.effectiveAt,
          purgeAfter: config.retentionDays
            ? new Date(t.effectiveAt.getTime() + config.retentionDays * DAY_MS)
            : null,
        },
      });
      await db.workspaceAudit.create({
        data: {
          organizationId: t.organizationId,
          actorId: "system",
          action: "WORKSPACE_TERMINATED",
          targetId: t.id,
        },
      });
    }
    // Retention configured after termination: schedule the purge now.
    if (config.retentionDays) {
      const unscheduled = await db.workspaceTermination.findMany({
        where: { status: "TERMINATED", purgeAfter: null },
      });
      for (const t of unscheduled)
        await db.workspaceTermination.update({
          where: { id: t.id },
          data: {
            purgeAfter: new Date(
              (t.terminatedAt ?? t.effectiveAt).getTime() +
                config.retentionDays * DAY_MS,
            ),
          },
        });
    }
    const purgeable = config.retentionDays
      ? await db.workspaceTermination.findMany({
          where: { status: "TERMINATED", purgeAfter: { lte: now } },
        })
      : [];
    let documents = 0;
    let exports = 0;
    for (const t of purgeable) {
      const result = await purgeWorkspace(t.id, t.organizationId);
      documents += result.documents;
      exports += result.exports;
    }
    return {
      terminated: due.length,
      purgedWorkspaces: purgeable.length,
      purgedDocuments: documents,
      purgedExports: exports,
      retentionConfigured: config.retentionDays !== null,
    };
  }

  return { status, request, cancel, adminTerminate, adminList, runScheduled };
}
