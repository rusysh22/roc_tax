import type { Prisma } from "../../generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Workspace write guard. A workspace becomes read-only once its subscription
 * termination takes effect (or when invoices are overdue past the configured
 * grace period). Reading and exporting data stays possible until the
 * retention period ends and stored documents are purged.
 */
export class WorkspaceLockedError extends Error {
  constructor(public code: "WORKSPACE_TERMINATED" | "BILLING_OVERDUE") {
    super(code);
  }
}

export type LifecycleConfig = {
  /** Notice period between a termination request and read-only access. */
  noticeDays: number;
  /** Days after termination before stored documents are deleted (null = off). */
  retentionDays: number | null;
  /** Suspend new work when an issued invoice is this many days overdue (null = off). */
  suspendAfterOverdueDays: number | null;
};

function positiveInt(raw: string | undefined) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 && n <= 3650 ? n : null;
}

export function lifecycleConfig(
  env: NodeJS.ProcessEnv = process.env,
): LifecycleConfig {
  return {
    noticeDays: positiveInt(env.DATA_TERMINATION_NOTICE_DAYS) ?? 30,
    retentionDays: positiveInt(env.DATA_RETENTION_DAYS_AFTER_TERMINATION),
    suspendAfterOverdueDays: positiveInt(
      env.BILLING_SUSPEND_AFTER_DAYS_OVERDUE,
    ),
  };
}

export const DAY_MS = 86_400_000;

/** Throws when the workspace may no longer create or change records. */
export async function assertWorkspaceWritable(
  tx: Tx,
  organizationId: string,
  now: Date,
  config: LifecycleConfig = lifecycleConfig(),
) {
  const ended = await tx.workspaceTermination.findFirst({
    where: {
      organizationId,
      OR: [
        { status: { in: ["TERMINATED", "PURGED"] } },
        { status: "REQUESTED", effectiveAt: { lte: now } },
      ],
    },
    select: { id: true },
  });
  if (ended) throw new WorkspaceLockedError("WORKSPACE_TERMINATED");
  if (config.suspendAfterOverdueDays) {
    const overdue = await tx.billingInvoice.findFirst({
      where: {
        organizationId,
        status: "ISSUED",
        dueAt: {
          lt: new Date(now.getTime() - config.suspendAfterOverdueDays * DAY_MS),
        },
      },
      select: { id: true },
    });
    if (overdue) throw new WorkspaceLockedError("BILLING_OVERDUE");
  }
}
