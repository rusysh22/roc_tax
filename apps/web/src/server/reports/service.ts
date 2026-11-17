import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  adminOverviewQuerySchema,
  classifyReconciliationDiscrepancy,
  reconciliationQuerySchema,
  superadminSupportInspectSchema,
  supportAccessGrantCommandSchema,
  type DiscrepancyCode,
} from "../../lib/reports/schemas";
import { resolveWorkspaceEntitlements } from "../billing/entitlements";
import { serializeCsv } from "../intake/spreadsheet";
import { AccessError, type Permission } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";

type Tx = Prisma.TransactionClient;

export class ReportsError extends Error {
  constructor(
    public code:
      "NOT_FOUND" | "SUPPORT_ACCESS_GRANT_REQUIRED" | "SUPPORT_ACCESS_EXPIRED",
  ) {
    super(code);
  }
}

async function databaseNow(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}

async function requireSuperadmin(tx: Tx, sessionId: string) {
  const session = await requireActor(tx, sessionId);
  if (session.user.platformRole !== "SUPERADMIN") {
    throw new AccessError("FORBIDDEN");
  }
  return session;
}

export type ReconciliationRow = {
  transactionId: string;
  invoiceNumber: string;
  documentDate: string;
  taxPeriod: string;
  taxFamily: string;
  source: string;
  status: string;
  companyId: string;
  companyName: string;
  counterpartyName: string;
  sourceAmount: string;
  approvedDppAmount: string | null;
  approvedTaxAmount: string | null;
  ruleCode: string | null;
  ruleVersion: number | null;
  batchId: string | null;
  exportVersion: number | null;
  xmlSha256Prefix: string | null;
  coretaxOutcome: string | null;
  coretaxReference: string | null;
  coretaxRecordedAt: string | null;
  discrepancy: DiscrepancyCode;
};

export function reportsService(db: PrismaClient) {
  async function withActive<T>(
    sessionId: string,
    permission: Permission | undefined,
    fn: (
      tx: Tx,
      actor: Awaited<ReturnType<typeof requireMembership>>,
    ) => Promise<T>,
  ) {
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    return db.$transaction(async (tx) => {
      const actor = await requireMembership(
        tx,
        sessionId,
        organizationId,
        permission,
      );
      if (actor.session.activeOrganizationId !== organizationId) {
        throw new AccessError("CONFLICT");
      }
      return fn(tx, actor);
    });
  }

  async function buildReconciliationRows(
    tx: Tx,
    organizationId: string,
  ): Promise<ReconciliationRow[]> {
    const txs = await tx.transaction.findMany({
      where: { organizationId },
      include: {
        company: { select: { id: true, name: true } },
        counterparty: { select: { name: true } },
        taxEvaluations: {
          orderBy: { evaluatedAt: "desc" },
          take: 1,
        },
        taxSnapshots: {
          orderBy: { approvedAt: "desc" },
          take: 1,
        },
        xmlExportItems: {
          orderBy: { batch: { exportedAt: "desc" } },
          take: 1,
          include: {
            batch: {
              include: {
                outcomes: {
                  orderBy: { recordedAt: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: [{ taxPeriod: "desc" }, { createdAt: "desc" }],
    });

    return txs.map((t) => {
      const latestEval = t.taxEvaluations[0] ?? null;
      const latestSnap = t.taxSnapshots[0] ?? null;
      const currentSnap =
        latestSnap && latestSnap.transactionVersion === t.version
          ? latestSnap
          : null;
      const latestExport = t.xmlExportItems[0] ?? null;
      const latestOutcomeRow = latestExport?.batch.outcomes[0] ?? null;

      const evalBlockers = Array.isArray(latestEval?.blockers)
        ? latestEval.blockers.length
        : 0;

      const discrepancy = classifyReconciliationDiscrepancy({
        status: t.status,
        hasEvaluation: Boolean(latestEval),
        evaluationBlockersCount: evalBlockers,
        hasCurrentSnapshot: Boolean(currentSnap),
        hasExportItem: Boolean(latestExport),
        latestOutcome: latestOutcomeRow?.outcome ?? null,
      });

      return {
        transactionId: t.id,
        invoiceNumber: t.invoiceNumber,
        documentDate: t.documentDate.toISOString().slice(0, 10),
        taxPeriod: t.taxPeriod,
        taxFamily: t.taxFamily,
        source: t.source,
        status: t.status,
        companyId: t.company.id,
        companyName: t.company.name,
        counterpartyName: t.counterparty.name,
        sourceAmount: t.totalAmount.toFixed(2),
        approvedDppAmount: latestSnap ? latestSnap.dppAmount.toFixed(2) : null,
        approvedTaxAmount: latestSnap ? latestSnap.taxAmount.toFixed(2) : null,
        ruleCode: latestSnap?.ruleCode ?? null,
        ruleVersion: latestSnap?.ruleVersion ?? null,
        batchId: latestExport?.batch.id ?? null,
        exportVersion: latestExport?.batch.exportVersion ?? null,
        xmlSha256Prefix: latestExport
          ? latestExport.batch.xmlSha256.slice(0, 12)
          : null,
        coretaxOutcome: latestOutcomeRow?.outcome ?? null,
        coretaxReference: latestOutcomeRow?.coretaxReference ?? null,
        coretaxRecordedAt: latestOutcomeRow?.recordedAt.toISOString() ?? null,
        discrepancy,
      };
    });
  }

  function applyReconciliationFilter(
    rows: ReconciliationRow[],
    query: ReturnType<typeof reconciliationQuerySchema.parse>,
  ) {
    const q = query.search.toLowerCase();
    return rows.filter((row) => {
      if (query.companyId && row.companyId !== query.companyId) return false;
      if (query.taxPeriod && row.taxPeriod !== query.taxPeriod) return false;
      if (query.taxFamily && row.taxFamily !== query.taxFamily) return false;
      if (query.source && row.source !== query.source) return false;
      if (query.discrepancyOnly && row.discrepancy === "NONE") return false;
      if (
        q &&
        !row.invoiceNumber.toLowerCase().includes(q) &&
        !row.counterpartyName.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }

  async function getReconciliationReport(sessionId: string, rawQuery: unknown) {
    const query = reconciliationQuerySchema.parse(rawQuery);
    return withActive(
      sessionId,
      undefined,
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);

        const [allRows, companies, trial, entitlements] = await Promise.all([
          buildReconciliationRows(tx, organizationId),
          tx.company.findMany({
            where: { organizationId, archivedAt: null },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
          tx.trialAccount.findUnique({
            where: { userId: session.userId },
            include: { _count: { select: { usage: true } } },
          }),
          resolveWorkspaceEntitlements(tx, organizationId, now),
        ]);

        const cards = {
          totalTransactions: allRows.length,
          inReviewCount: allRows.filter((r) =>
            [
              "DRAFT",
              "EXTRACTING",
              "NEEDS_REVIEW",
              "VALIDATED",
              "SUBMITTED",
              "CHANGES_REQUESTED",
            ].includes(r.status),
          ).length,
          approvedCount: allRows.filter((r) => r.status === "APPROVED").length,
          exportedCount: allRows.filter((r) => r.status === "EXPORTED").length,
          coretaxSubmittedCount: allRows.filter(
            (r) => r.coretaxOutcome === "CORETAX_SUBMITTED",
          ).length,
          coretaxAcceptedCount: allRows.filter(
            (r) =>
              r.status === "CORETAX_ACCEPTED" ||
              r.coretaxOutcome === "CORETAX_ACCEPTED",
          ).length,
          coretaxRejectedCount: allRows.filter(
            (r) =>
              r.status === "CORETAX_REJECTED" ||
              r.coretaxOutcome === "CORETAX_REJECTED",
          ).length,
          discrepancyCount: allRows.filter(
            (r) => r.discrepancy !== "NONE" && r.discrepancy !== "VOIDED",
          ).length,
        };

        const filtered = applyReconciliationFilter(allRows, query);
        const totalRows = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalRows / query.pageSize));
        const page = Math.min(query.page, totalPages);
        const start = (page - 1) * query.pageSize;
        const rows = filtered.slice(start, start + query.pageSize);

        return {
          role: membership.role,
          cards,
          planAndUsage: {
            trial: trial
              ? {
                  activatedAt: trial.activatedAt.toISOString(),
                  expiresAt: trial.expiresAt.toISOString(),
                  usedTotal: trial._count.usage,
                  maxTotal: 3,
                  maxPerJakartaDay: 1,
                }
              : null,
            entitlements,
          },
          companies,
          pagination: {
            page,
            pageSize: query.pageSize,
            totalRows,
            totalPages,
          },
          rows,
        };
      },
    );
  }

  async function exportReconciliationCsv(sessionId: string, rawQuery: unknown) {
    const query = reconciliationQuerySchema.parse(rawQuery);
    return withActive(
      sessionId,
      undefined,
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const allRows = await buildReconciliationRows(tx, organizationId);
        const filtered = applyReconciliationFilter(allRows, query).slice(
          0,
          2000,
        );

        const header = [
          "transaction_id",
          "invoice_number",
          "document_date",
          "tax_period",
          "tax_family",
          "source",
          "status",
          "company_name",
          "counterparty_name",
          "source_amount_idr",
          "approved_dpp_idr",
          "approved_tax_idr",
          "rule_code",
          "export_version",
          "xml_sha256_prefix",
          "coretax_manual_outcome",
          "coretax_manual_reference",
          "discrepancy",
        ];
        const matrix = [
          header,
          ...filtered.map((r) => [
            r.transactionId,
            r.invoiceNumber,
            r.documentDate,
            r.taxPeriod,
            r.taxFamily,
            r.source,
            r.status,
            r.companyName,
            r.counterpartyName,
            r.sourceAmount,
            r.approvedDppAmount ?? "",
            r.approvedTaxAmount ?? "",
            r.ruleCode ? `${r.ruleCode}@v${r.ruleVersion}` : "",
            r.exportVersion ? `v${r.exportVersion}` : "",
            r.xmlSha256Prefix ?? "",
            r.coretaxOutcome ?? "NOT_RECORDED",
            r.coretaxReference ?? "",
            r.discrepancy,
          ]),
        ];

        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "RECONCILIATION_CSV_EXPORTED",
          },
        });

        const csvText = serializeCsv(matrix);
        return {
          fileName: `serentax-reconciliation-${new Date().toISOString().slice(0, 10)}.csv`,
          bytes: new TextEncoder().encode(csvText),
        };
      },
    );
  }

  async function listWorkspaceSupportAccess(sessionId: string) {
    return withActive(sessionId, "team.manage", async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const [grants, audits] = await Promise.all([
        tx.supportAccessGrant.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        tx.supportAccessAudit.findMany({
          where: { organizationId },
          orderBy: { accessedAt: "desc" },
          take: 25,
        }),
      ]);
      return {
        grants: grants.map((g) => ({
          id: g.id,
          reason: g.reason,
          status: g.status,
          expiresAt: g.expiresAt.toISOString(),
          revokedAt: g.revokedAt?.toISOString() ?? null,
          createdAt: g.createdAt.toISOString(),
        })),
        audits: audits.map((a) => ({
          id: a.id,
          grantId: a.grantId,
          action: a.action,
          reason: a.reason,
          accessedAt: a.accessedAt.toISOString(),
        })),
      };
    });
  }

  async function mutateWorkspaceSupportAccess(sessionId: string, raw: unknown) {
    const command = supportAccessGrantCommandSchema.parse(raw);
    return withActive(
      sessionId,
      "team.manage",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);

        if (command.action === "grant") {
          const expiresAt = new Date(
            now.getTime() + command.durationMinutes * 60_000,
          );
          const grant = await tx.supportAccessGrant.create({
            data: {
              organizationId,
              grantedBy: session.userId,
              reason: command.reason,
              status: "ACTIVE",
              expiresAt,
            },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "SUPPORT_ACCESS_GRANTED",
              targetId: grant.id,
            },
          });
          return { grantId: grant.id, expiresAt: expiresAt.toISOString() };
        }

        const existing = await tx.supportAccessGrant.findFirst({
          where: { id: command.grantId, organizationId },
        });
        if (!existing) throw new ReportsError("NOT_FOUND");
        await tx.supportAccessGrant.update({
          where: { id: existing.id },
          data: {
            status: "REVOKED",
            revokedBy: session.userId,
            revokedAt: now,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "SUPPORT_ACCESS_REVOKED",
            targetId: existing.id,
          },
        });
        return { grantId: existing.id, status: "REVOKED" as const };
      },
    );
  }

  async function getSuperadminOverview(sessionId: string, rawQuery: unknown) {
    const query = adminOverviewQuerySchema.parse(rawQuery);
    return db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      const now = await databaseNow(tx);

      const [
        rulesTotal,
        rulesSmeApproved,
        rulesNonProd,
        tplVerified,
        tplUnverified,
        tplRetired,
        ocrTotal,
        ocrApproved,
        ocrEnabled,
        ocrQueued,
        ocrRunning,
        ocrSucceeded,
        ocrRetryable,
        ocrDeadLetter,
        ocrCancelled,
        billingConfig,
        webhookTotal,
        webhookValid,
        webhookRejected,
        orgCount,
        orgs,
        jobCount,
        jobs,
      ] = await Promise.all([
        tx.taxRule.count(),
        tx.taxRule.count({ where: { catalogStatus: "SME_APPROVED" } }),
        tx.taxRule.count({ where: { catalogStatus: "NON_PRODUCTION_TEST" } }),
        tx.xmlTemplate.count({ where: { status: "VERIFIED" } }),
        tx.xmlTemplate.count({ where: { status: "UNVERIFIED" } }),
        tx.xmlTemplate.count({ where: { status: "RETIRED" } }),
        tx.ocrProviderConfig.count(),
        tx.ocrProviderConfig.count({ where: { vendorApproved: true } }),
        tx.ocrProviderConfig.count({ where: { enabled: true } }),
        tx.ocrJob.count({ where: { status: "QUEUED" } }),
        tx.ocrJob.count({ where: { status: "RUNNING" } }),
        tx.ocrJob.count({ where: { status: "SUCCEEDED" } }),
        tx.ocrJob.count({ where: { status: "FAILED_RETRYABLE" } }),
        tx.ocrJob.count({ where: { status: "DEAD_LETTER" } }),
        tx.ocrJob.count({ where: { status: "CANCELLED" } }),
        tx.billingConfig.findUnique({ where: { id: "default" } }),
        tx.billingWebhookEvent.count(),
        tx.billingWebhookEvent.count({ where: { signatureValid: true } }),
        tx.billingWebhookEvent.count({ where: { signatureValid: false } }),
        tx.organization.count(),
        tx.organization.findMany({
          orderBy: { createdAt: "desc" },
          skip: (query.orgPage - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            name: true,
            createdAt: true,
            _count: {
              select: {
                memberships: true,
                companies: true,
                transactions: true,
                xmlExportBatches: true,
              },
            },
            license: { select: { status: true } },
            supportAccessGrants: {
              where: { status: "ACTIVE", expiresAt: { gt: now } },
              orderBy: { expiresAt: "desc" },
              take: 1,
              select: { id: true, expiresAt: true },
            },
          },
        }),
        tx.ocrJob.count({
          where: query.jobStatus ? { status: query.jobStatus } : undefined,
        }),
        tx.ocrJob.findMany({
          where: query.jobStatus ? { status: query.jobStatus } : undefined,
          orderBy: { createdAt: "desc" },
          skip: (query.jobPage - 1) * query.pageSize,
          take: query.pageSize,
          select: {
            id: true,
            organizationId: true,
            providerSlug: true,
            adapterKey: true,
            status: true,
            attemptCount: true,
            maxAttempts: true,
            errorCode: true,
            pageCount: true,
            createdAt: true,
            finishedAt: true,
          },
        }),
      ]);

      return {
        platformHealth: {
          taxRules: {
            total: rulesTotal,
            smeApproved: rulesSmeApproved,
            nonProductionTest: rulesNonProd,
            draft: rulesTotal - rulesSmeApproved - rulesNonProd,
          },
          xmlTemplates: {
            verified: tplVerified,
            unverified: tplUnverified,
            retired: tplRetired,
          },
          ocrProviders: {
            total: ocrTotal,
            vendorApproved: ocrApproved,
            enabled: ocrEnabled,
          },
          ocrJobs: {
            queued: ocrQueued,
            running: ocrRunning,
            succeeded: ocrSucceeded,
            failedRetryable: ocrRetryable,
            deadLetter: ocrDeadLetter,
            cancelled: ocrCancelled,
          },
          billing: {
            adapterMode: billingConfig?.adapterMode ?? "NOT_CONFIGURED",
            saasLicensingApproved:
              billingConfig?.saasLicensingApproved ?? false,
            webhookTotal,
            webhookValid,
            webhookRejected,
          },
        },
        orgPagination: {
          page: query.orgPage,
          pageSize: query.pageSize,
          totalRows: orgCount,
          totalPages: Math.max(1, Math.ceil(orgCount / query.pageSize)),
        },
        organizations: orgs.map((o) => ({
          id: o.id,
          name: o.name,
          createdAt: o.createdAt.toISOString(),
          memberCount: o._count.memberships,
          companyCount: o._count.companies,
          transactionCount: o._count.transactions,
          exportBatchCount: o._count.xmlExportBatches,
          licenseStatus: o.license?.status ?? "NOT_CONFIGURED",
          activeSupportGrantId: o.supportAccessGrants[0]?.id ?? null,
          activeSupportGrantExpiresAt:
            o.supportAccessGrants[0]?.expiresAt.toISOString() ?? null,
        })),
        jobPagination: {
          page: query.jobPage,
          pageSize: query.pageSize,
          totalRows: jobCount,
          totalPages: Math.max(1, Math.ceil(jobCount / query.pageSize)),
        },
        jobs: jobs.map((j) => ({
          id: j.id,
          organizationId: j.organizationId,
          providerSlug: j.providerSlug,
          adapterKey: j.adapterKey,
          status: j.status,
          attemptCount: j.attemptCount,
          maxAttempts: j.maxAttempts,
          errorCode: j.errorCode,
          pageCount: j.pageCount,
          createdAt: j.createdAt.toISOString(),
          finishedAt: j.finishedAt?.toISOString() ?? null,
        })),
      };
    });
  }

  /**
   * Privacy-preserving audited support inspection: Superadmin MUST present an
   * active, non-expired `SupportAccessGrant` created by the tenant OWNER/ADMIN.
   * Even then, raw tax IDs, invoice descriptions, and document files stay masked.
   */
  async function inspectTenantSupport(sessionId: string, raw: unknown) {
    const input = superadminSupportInspectSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      const now = await databaseNow(tx);

      const grant = await tx.supportAccessGrant.findFirst({
        where: {
          id: input.grantId,
          organizationId: input.organizationId,
        },
      });
      if (!grant || grant.status !== "ACTIVE") {
        throw new ReportsError("SUPPORT_ACCESS_GRANT_REQUIRED");
      }
      if (grant.expiresAt.getTime() <= now.getTime()) {
        throw new ReportsError("SUPPORT_ACCESS_EXPIRED");
      }

      const [org, txStatusCounts, recentBatches, failedJobs] =
        await Promise.all([
          tx.organization.findUnique({
            where: { id: input.organizationId },
            select: { id: true, name: true, createdAt: true },
          }),
          tx.transaction.groupBy({
            by: ["status"],
            where: { organizationId: input.organizationId },
            _count: { _all: true },
          }),
          tx.xmlExportBatch.findMany({
            where: { organizationId: input.organizationId },
            orderBy: { exportedAt: "desc" },
            take: 10,
            select: {
              id: true,
              taxFamily: true,
              taxPeriod: true,
              exportVersion: true,
              itemCount: true,
              xmlSha256: true,
              exportedAt: true,
              outcomes: {
                orderBy: { recordedAt: "desc" },
                take: 1,
                select: { outcome: true, recordedAt: true },
              },
            },
          }),
          tx.ocrJob.findMany({
            where: {
              organizationId: input.organizationId,
              status: { in: ["FAILED_RETRYABLE", "DEAD_LETTER"] },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              errorCode: true,
              attemptCount: true,
              updatedAt: true,
            },
          }),
        ]);
      if (!org) throw new ReportsError("NOT_FOUND");

      await tx.supportAccessAudit.create({
        data: {
          organizationId: input.organizationId,
          grantId: grant.id,
          actorId: session.userId,
          action: "SUPPORT_DIAGNOSTICS_VIEWED",
          reason: input.reason,
          accessedAt: now,
        },
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId: input.organizationId,
          actorId: session.userId,
          action: "SUPPORT_ACCESS_USED",
          targetId: grant.id,
        },
      });

      return {
        privacyMode: "REDACTED_DIAGNOSTICS_ONLY" as const,
        organization: {
          id: org.id,
          name: org.name,
          createdAt: org.createdAt.toISOString(),
        },
        grant: {
          id: grant.id,
          expiresAt: grant.expiresAt.toISOString(),
        },
        transactionStatusBreakdown: txStatusCounts.map((g) => ({
          status: g.status,
          count: g._count._all,
        })),
        recentExportBatches: recentBatches.map((b) => ({
          id: b.id,
          taxFamily: b.taxFamily,
          taxPeriod: b.taxPeriod,
          exportVersion: b.exportVersion,
          itemCount: b.itemCount,
          xmlSha256Prefix: b.xmlSha256.slice(0, 12),
          exportedAt: b.exportedAt.toISOString(),
          latestOutcome: b.outcomes[0]?.outcome ?? null,
        })),
        recentFailedJobs: failedJobs.map((j) => ({
          id: j.id,
          status: j.status,
          errorCode: j.errorCode,
          attemptCount: j.attemptCount,
          updatedAt: j.updatedAt.toISOString(),
        })),
      };
    });
  }

  return {
    getReconciliationReport,
    exportReconciliationCsv,
    listWorkspaceSupportAccess,
    mutateWorkspaceSupportAccess,
    getSuperadminOverview,
    inspectTenantSupport,
  };
}
