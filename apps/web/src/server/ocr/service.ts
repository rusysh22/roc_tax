import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  AMOUNT_SCALE,
  QUANTITY_SCALE,
  canonicalFixed,
  formatFixed,
  lineAmount,
  parseFixed,
  sumAmounts,
} from "../../lib/intake/decimal";
import { normalizeInvoiceNumber } from "../../lib/intake/identity";
import {
  isSafeHttpsEndpointUrl,
  isValidSecretRefName,
  ocrCommandSchema,
  orgOcrSettingsSchema,
  providerConfigCommandSchema,
  type OcrAdapterKey,
  type OcrExtractedFields,
} from "../../lib/intake/ocr";
import { allows } from "../../lib/intake/state";
import { jakartaDate } from "../trial/state";
import { AccessError } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import type { DocumentStorage } from "../intake/storage";
import {
  OcrAdapterError,
  normalizeCandidateFields,
  resolveOcrAdapter,
  type OcrAdapter,
} from "./adapter";

type Tx = Prisma.TransactionClient;

export class OcrError extends Error {
  constructor(
    public code:
      | "INVALID_ENDPOINT_URL"
      | "INVALID_SECRET_REF"
      | "PROVIDER_NOT_ALLOWED"
      | "VENDOR_NOT_APPROVED"
      | "OCR_NOT_CONFIGURED"
      | "OCR_DISABLED_NONE"
      | "OCR_SECRET_MISSING"
      | "CONSENT_REQUIRED"
      | "SPEND_CAP_EXCEEDED"
      | "JOB_ALREADY_ACTIVE"
      | "LOW_CONFIDENCE_VERIFICATION_REQUIRED"
      | "LINE_PRECISION"
      | "INVALID_STATE"
      | "NOT_FOUND",
  ) {
    super(code);
  }
}

export type OcrServiceOptions = {
  env?: NodeJS.ProcessEnv;
  adapters?: Partial<Record<OcrAdapterKey, OcrAdapter>>;
  retryBaseDelayMs?: number;
};

async function lockWorkspace(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
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

function jakartaMonthBounds(now: Date): { start: Date; end: Date } {
  const day = jakartaDate(now); // YYYY-MM-DD in Asia/Jakarta
  const [year, month] = day.split("-").map(Number);
  // Asia/Jakarta is fixed UTC+7
  const startUtc = Date.UTC(year, month - 1, 1, -7, 0, 0, 0);
  const endUtc = Date.UTC(year, month, 1, -7, 0, 0, 0);
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

function redactedErrorMessage(code: string): string {
  switch (code) {
    case "OCR_NOT_CONFIGURED":
      return "External OCR provider is not configured.";
    case "OCR_PROVIDER_DISABLED":
      return "OCR is set to NONE / manual entry.";
    case "OCR_TIMEOUT":
      return "OCR provider request timed out.";
    case "OCR_INVALID_DOCUMENT":
      return "Document could not be processed by OCR adapter.";
    case "OCR_PAGE_LIMIT":
      return "Document exceeds configured maximum pages.";
    case "OCR_SECRET_MISSING":
      return "Configured server secret reference is missing.";
    default:
      return "OCR provider failed to extract document.";
  }
}

export function ocrService(
  db: PrismaClient,
  storage: DocumentStorage,
  options: OcrServiceOptions = {},
) {
  const env = options.env ?? process.env;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 2000;

  async function withActive<T>(
    sessionId: string,
    permission: "team.manage" | "draft.prepare" | undefined,
    fn: (
      tx: Tx,
      actor: Awaited<ReturnType<typeof requireMembership>>,
    ) => Promise<T>,
  ) {
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    return db.$transaction(async (tx) => {
      await lockWorkspace(tx, organizationId);
      const actor = await requireMembership(
        tx,
        sessionId,
        organizationId,
        permission,
      );
      if (actor.session.activeOrganizationId !== organizationId)
        throw new AccessError("CONFLICT");
      return fn(tx, actor);
    });
  }

  async function listProviders(sessionId: string) {
    return db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      const providers = await tx.ocrProviderConfig.findMany({
        orderBy: { createdAt: "asc" },
      });
      const counts = await tx.ocrJob.groupBy({
        by: ["status"],
        _count: { _all: true },
      });
      const health: Record<string, number> = {};
      for (const item of counts) health[item.status] = item._count._all;
      return {
        providers: providers.map((p) => ({
          id: p.id,
          slug: p.slug,
          displayName: p.displayName,
          adapterKey: p.adapterKey,
          endpointUrl: p.endpointUrl,
          secretRef: p.secretRef,
          secretConfigured: p.secretRef ? Boolean(env[p.secretRef]) : false,
          model: p.model,
          region: p.region,
          maxPages: p.maxPages,
          timeoutMs: p.timeoutMs,
          monthlyPageCap: p.monthlyPageCap,
          monthlySpendCapIdr: p.monthlySpendCapIdr.toFixed(2),
          estimatedCostPerPageIdr: p.estimatedCostPerPageIdr.toFixed(2),
          retentionPolicy: p.retentionPolicy,
          processorNotice: p.processorNotice,
          vendorApproved: p.vendorApproved,
          enabled: p.enabled,
          updatedAt: p.updatedAt.toISOString(),
        })),
        jobHealth: health,
      };
    });
  }

  async function upsertProvider(sessionId: string, raw: unknown) {
    const command = providerConfigCommandSchema.parse(raw);
    if (command.endpointUrl && !isSafeHttpsEndpointUrl(command.endpointUrl)) {
      throw new OcrError("INVALID_ENDPOINT_URL");
    }
    if (command.secretRef && !isValidSecretRefName(command.secretRef)) {
      throw new OcrError("INVALID_SECRET_REF");
    }
    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      const saved = await tx.ocrProviderConfig.upsert({
        where: { slug: command.slug },
        create: {
          slug: command.slug,
          displayName: command.displayName,
          adapterKey: command.adapterKey,
          endpointUrl: command.endpointUrl ?? null,
          secretRef: command.secretRef ?? null,
          model: command.model,
          region: command.region,
          maxPages: command.maxPages,
          timeoutMs: command.timeoutMs,
          monthlyPageCap: command.monthlyPageCap,
          monthlySpendCapIdr: command.monthlySpendCapIdr,
          estimatedCostPerPageIdr: command.estimatedCostPerPageIdr,
          retentionPolicy: command.retentionPolicy,
          processorNotice: command.processorNotice,
          vendorApproved: command.vendorApproved,
          enabled: command.enabled,
          updatedBy: session.userId,
        },
        update: {
          displayName: command.displayName,
          adapterKey: command.adapterKey,
          endpointUrl: command.endpointUrl ?? null,
          secretRef: command.secretRef ?? null,
          model: command.model,
          region: command.region,
          maxPages: command.maxPages,
          timeoutMs: command.timeoutMs,
          monthlyPageCap: command.monthlyPageCap,
          monthlySpendCapIdr: command.monthlySpendCapIdr,
          estimatedCostPerPageIdr: command.estimatedCostPerPageIdr,
          retentionPolicy: command.retentionPolicy,
          processorNotice: command.processorNotice,
          vendorApproved: command.vendorApproved,
          enabled: command.enabled,
          updatedBy: session.userId,
        },
      });
      return { id: saved.id, slug: saved.slug };
    });
  }

  async function monthlyUsage(tx: Tx, organizationId: string, now: Date) {
    const { start, end } = jakartaMonthBounds(now);
    const agg = await tx.ocrJob.aggregate({
      where: {
        organizationId,
        status: { in: ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED_RETRYABLE"] },
        createdAt: { gte: start, lt: end },
      },
      _sum: { pageCount: true, estimatedCostIdr: true },
      _count: { _all: true },
    });
    return {
      pagesUsed: agg._sum.pageCount ?? 0,
      spendIdr: agg._sum.estimatedCostIdr?.toFixed(2) ?? "0.00",
      jobCount: agg._count._all,
    };
  }

  function evaluateEffectiveStatus(
    setting: {
      externalAiConsent: boolean;
      provider: {
        adapterKey: OcrAdapterKey;
        enabled: boolean;
        vendorApproved: boolean;
        secretRef: string | null;
      } | null;
    } | null,
  ) {
    if (!setting?.provider || setting.provider.adapterKey === "NONE") {
      return "NONE_MANUAL" as const;
    }
    if (!setting.provider.enabled || !setting.provider.vendorApproved) {
      return "VENDOR_NOT_APPROVED" as const;
    }
    if (setting.provider.adapterKey === "EXTERNAL_NOT_CONFIGURED") {
      return "NOT_CONFIGURED" as const;
    }
    if (!setting.externalAiConsent) {
      return "CONSENT_REQUIRED" as const;
    }
    if (setting.provider.secretRef && !env[setting.provider.secretRef]) {
      return "NOT_CONFIGURED" as const;
    }
    return "READY" as const;
  }

  async function getOrgOcrSettings(sessionId: string) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const now = await databaseNow(tx);
      const setting = await tx.organizationOcrSetting.findUnique({
        where: { organizationId },
        include: { provider: true },
      });
      const enabledProviders = await tx.ocrProviderConfig.findMany({
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
      });
      const usage = await monthlyUsage(tx, organizationId, now);
      return {
        role: membership.role,
        effectiveStatus: evaluateEffectiveStatus(setting),
        current: {
          providerSlug: setting?.provider?.slug ?? "none",
          displayName: setting?.provider?.displayName ?? "NONE (Manual only)",
          adapterKey: setting?.provider?.adapterKey ?? "NONE",
          model: setting?.provider?.model ?? "none",
          region: setting?.provider?.region ?? "local",
          externalAiConsent: setting?.externalAiConsent ?? false,
          consentedAt: setting?.consentedAt?.toISOString() ?? null,
        },
        allowedProviders: enabledProviders.map((p) => ({
          slug: p.slug,
          displayName: p.displayName,
          adapterKey: p.adapterKey,
          model: p.model,
          region: p.region,
          maxPages: p.maxPages,
          monthlyPageCap: p.monthlyPageCap,
          monthlySpendCapIdr: p.monthlySpendCapIdr.toFixed(2),
          retentionPolicy: p.retentionPolicy,
          processorNotice: p.processorNotice,
          vendorApproved: p.vendorApproved,
          secretReady: p.secretRef ? Boolean(env[p.secretRef]) : true,
        })),
        usageThisMonth: usage,
      };
    });
  }

  async function updateOrgOcrSettings(sessionId: string, raw: unknown) {
    const command = orgOcrSettingsSchema.parse(raw);
    return withActive(
      sessionId,
      "team.manage",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);

        if (command.providerSlug === "none") {
          await tx.organizationOcrSetting.upsert({
            where: { organizationId },
            create: {
              organizationId,
              providerId: null,
              externalAiConsent: false,
              updatedBy: session.userId,
            },
            update: {
              providerId: null,
              externalAiConsent: false,
              consentedBy: null,
              consentedAt: null,
              updatedBy: session.userId,
            },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "OCR_SETTINGS_DISABLED",
            },
          });
          return {
            providerSlug: "none",
            effectiveStatus: "NONE_MANUAL" as const,
          };
        }

        const provider = await tx.ocrProviderConfig.findFirst({
          where: { slug: command.providerSlug, enabled: true },
        });
        if (!provider) throw new OcrError("PROVIDER_NOT_ALLOWED");
        if (!provider.vendorApproved) throw new OcrError("VENDOR_NOT_APPROVED");
        if (provider.adapterKey === "EXTERNAL_NOT_CONFIGURED")
          throw new OcrError("OCR_NOT_CONFIGURED");
        if (provider.adapterKey !== "NONE" && !command.externalAiConsent)
          throw new OcrError("CONSENT_REQUIRED");

        await tx.organizationOcrSetting.upsert({
          where: { organizationId },
          create: {
            organizationId,
            providerId: provider.id,
            externalAiConsent: command.externalAiConsent,
            consentedBy: command.externalAiConsent ? session.userId : null,
            consentedAt: command.externalAiConsent ? now : null,
            updatedBy: session.userId,
          },
          update: {
            providerId: provider.id,
            externalAiConsent: command.externalAiConsent,
            consentedBy: command.externalAiConsent ? session.userId : null,
            consentedAt: command.externalAiConsent ? now : null,
            updatedBy: session.userId,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "OCR_SETTINGS_UPDATED",
            targetId: provider.slug,
          },
        });
        return {
          providerSlug: provider.slug,
          effectiveStatus: evaluateEffectiveStatus({
            externalAiConsent: command.externalAiConsent,
            provider,
          }),
        };
      },
    );
  }

  async function getTransactionOcr(sessionId: string, transactionId: string) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const transaction = await tx.transaction.findFirst({
        where: { id: transactionId, organizationId },
        select: { id: true, status: true },
      });
      if (!transaction) throw new OcrError("NOT_FOUND");
      const setting = await tx.organizationOcrSetting.findUnique({
        where: { organizationId },
        include: { provider: true },
      });
      const jobs = await tx.ocrJob.findMany({
        where: { organizationId, transactionId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      const candidates = await tx.ocrCandidate.findMany({
        where: { organizationId, transactionId },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return {
        role: membership.role,
        effectiveStatus: evaluateEffectiveStatus(setting),
        provider: setting?.provider
          ? {
              slug: setting.provider.slug,
              displayName: setting.provider.displayName,
              adapterKey: setting.provider.adapterKey,
              model: setting.provider.model,
              region: setting.provider.region,
            }
          : null,
        jobs: jobs.map((j) => ({
          id: j.id,
          documentId: j.documentId,
          providerSlug: j.providerSlug,
          adapterKey: j.adapterKey,
          model: j.model,
          region: j.region,
          status: j.status,
          attemptCount: j.attemptCount,
          maxAttempts: j.maxAttempts,
          pageCount: j.pageCount,
          estimatedCostIdr: j.estimatedCostIdr.toFixed(2),
          errorCode: j.errorCode,
          errorMessage: j.errorMessage,
          nextRunAt: j.nextRunAt.toISOString(),
          startedAt: j.startedAt?.toISOString() ?? null,
          finishedAt: j.finishedAt?.toISOString() ?? null,
          createdAt: j.createdAt.toISOString(),
        })),
        candidates: candidates.map((c) => ({
          id: c.id,
          jobId: c.jobId,
          documentId: c.documentId,
          providerSlug: c.providerSlug,
          model: c.model,
          providerVersion: c.providerVersion,
          extractedFields: c.extractedFields as OcrExtractedFields,
          appliedFields: c.appliedFields,
          promptInjectionDetected: c.promptInjectionDetected,
          reviewedBy: c.reviewedBy,
          reviewedAt: c.reviewedAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
        })),
      };
    });
  }

  async function enqueueJob(
    sessionId: string,
    transactionId: string,
    documentId: string,
  ) {
    return withActive(
      sessionId,
      "draft.prepare",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);
        const transaction = await tx.transaction.findFirst({
          where: { id: transactionId, organizationId },
        });
        if (!transaction) throw new OcrError("NOT_FOUND");
        const activeJob = await tx.ocrJob.findFirst({
          where: {
            transactionId,
            documentId,
            status: { in: ["QUEUED", "RUNNING", "FAILED_RETRYABLE"] },
          },
        });
        if (activeJob) throw new OcrError("JOB_ALREADY_ACTIVE");
        if (!allows(transaction.status, "attach")) {
          throw new OcrError("INVALID_STATE");
        }
        const doc = await tx.sourceDocument.findFirst({
          where: { id: documentId, transactionId, organizationId },
        });
        if (!doc) throw new OcrError("NOT_FOUND");

        const setting = await tx.organizationOcrSetting.findUnique({
          where: { organizationId },
          include: { provider: true },
        });
        if (!setting?.provider || setting.provider.adapterKey === "NONE") {
          throw new OcrError("OCR_DISABLED_NONE");
        }
        const provider = setting.provider;
        if (!provider.enabled || !provider.vendorApproved) {
          throw new OcrError("VENDOR_NOT_APPROVED");
        }
        if (provider.adapterKey === "EXTERNAL_NOT_CONFIGURED") {
          throw new OcrError("OCR_NOT_CONFIGURED");
        }
        if (!setting.externalAiConsent) {
          throw new OcrError("CONSENT_REQUIRED");
        }
        if (provider.secretRef && !env[provider.secretRef]) {
          throw new OcrError("OCR_SECRET_MISSING");
        }

        const usage = await monthlyUsage(tx, organizationId, now);
        if (
          provider.monthlyPageCap > 0 &&
          usage.pagesUsed + 1 > provider.monthlyPageCap
        ) {
          throw new OcrError("SPEND_CAP_EXCEEDED");
        }
        const nextCost =
          parseFixed(usage.spendIdr, AMOUNT_SCALE) +
          parseFixed(provider.estimatedCostPerPageIdr.toFixed(2), AMOUNT_SCALE);
        const cap = parseFixed(
          provider.monthlySpendCapIdr.toFixed(2),
          AMOUNT_SCALE,
        );
        if (cap > BigInt(0) && nextCost > cap) {
          throw new OcrError("SPEND_CAP_EXCEEDED");
        }

        const job = await tx.ocrJob.create({
          data: {
            organizationId,
            transactionId,
            documentId,
            providerId: provider.id,
            providerSlug: provider.slug,
            adapterKey: provider.adapterKey,
            model: provider.model,
            region: provider.region,
            status: "QUEUED",
            nextRunAt: now,
            estimatedCostIdr: provider.estimatedCostPerPageIdr,
            createdBy: session.userId,
          },
        });
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "EXTRACTING" },
        });
        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId,
            actorId: session.userId,
            action: "OCR_JOB_QUEUED",
            changes: {
              jobId: job.id,
              documentId: doc.id,
              providerSlug: provider.slug,
              model: provider.model,
              region: provider.region,
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "OCR_JOB_QUEUED",
            targetId: job.id,
          },
        });
        return { jobId: job.id, status: job.status };
      },
    );
  }

  /**
   * Claims and executes one due OCR job using `FOR UPDATE SKIP LOCKED`.
   * Document I/O and adapter execution happen outside the claim lock, then
   * result/retry/dead-letter transitions commit atomically.
   */
  async function processNextJob(targetJobId?: string) {
    const claimed = await db.$transaction(async (tx) => {
      const now = await databaseNow(tx);
      const rows = targetJobId
        ? await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "OcrJob"
            WHERE id = ${targetJobId}
              AND status IN ('QUEUED', 'FAILED_RETRYABLE')
              AND "nextRunAt" <= ${now}
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `
        : await tx.$queryRaw<{ id: string }[]>`
            SELECT id FROM "OcrJob"
            WHERE status IN ('QUEUED', 'FAILED_RETRYABLE')
              AND "nextRunAt" <= ${now}
            ORDER BY "nextRunAt" ASC, "createdAt" ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          `;
      if (rows.length === 0) return null;
      const job = await tx.ocrJob.update({
        where: { id: rows[0].id },
        data: {
          status: "RUNNING",
          startedAt: now,
          attemptCount: { increment: 1 },
        },
        include: {
          document: true,
          provider: true,
        },
      });
      return job;
    });

    if (!claimed) return null;

    const maxPages = claimed.provider?.maxPages ?? 10;
    const timeoutMs = claimed.provider?.timeoutMs ?? 15000;
    const costPerPage =
      claimed.provider?.estimatedCostPerPageIdr.toFixed(2) ?? "0.00";

    try {
      const bytes = await storage.get(
        claimed.organizationId,
        claimed.document.storageKey,
      );
      const secret = claimed.provider?.secretRef
        ? (env[claimed.provider.secretRef] ?? null)
        : null;
      if (claimed.provider?.secretRef && !secret) {
        throw new OcrAdapterError("OCR_SECRET_MISSING", false);
      }

      const adapter = resolveOcrAdapter(claimed.adapterKey, options.adapters);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        adapter.extract({
          bytes,
          mimeType: claimed.document.mimeType,
          fileName: claimed.document.originalName,
          model: claimed.model,
          region: claimed.region,
          maxPages,
          timeoutMs,
          secret,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new OcrAdapterError("OCR_TIMEOUT", true)),
            timeoutMs,
          );
        }),
      ]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      const normalized = normalizeCandidateFields(result.rawFields);

      return await db.$transaction(async (tx) => {
        const now = await databaseNow(tx);
        const totalCost = formatFixed(
          parseFixed(costPerPage, AMOUNT_SCALE) * BigInt(result.pageCount),
          AMOUNT_SCALE,
        );
        await tx.ocrJob.update({
          where: { id: claimed.id },
          data: {
            status: "SUCCEEDED",
            finishedAt: now,
            pageCount: result.pageCount,
            estimatedCostIdr: totalCost,
            errorCode: null,
            errorMessage: null,
          },
        });
        const candidate = await tx.ocrCandidate.create({
          data: {
            organizationId: claimed.organizationId,
            transactionId: claimed.transactionId,
            documentId: claimed.documentId,
            jobId: claimed.id,
            providerSlug: claimed.providerSlug,
            model: claimed.model,
            providerVersion: result.providerVersion,
            extractedFields:
              normalized.fields as unknown as Prisma.InputJsonValue,
            promptInjectionDetected: normalized.promptInjectionDetected,
          },
        });
        await tx.transaction.updateMany({
          where: {
            id: claimed.transactionId,
            organizationId: claimed.organizationId,
            status: "EXTRACTING",
          },
          data: { status: "NEEDS_REVIEW" },
        });
        await tx.transactionEvent.create({
          data: {
            organizationId: claimed.organizationId,
            transactionId: claimed.transactionId,
            actorId: claimed.createdBy,
            action: "OCR_JOB_SUCCEEDED",
            changes: {
              jobId: claimed.id,
              candidateId: candidate.id,
              providerSlug: claimed.providerSlug,
              model: claimed.model,
              providerVersion: result.providerVersion,
              pageCount: result.pageCount,
              promptInjectionDetected: normalized.promptInjectionDetected,
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId: claimed.organizationId,
            actorId: claimed.createdBy,
            action: "OCR_JOB_COMPLETED",
            targetId: claimed.id,
          },
        });
        return {
          jobId: claimed.id,
          status: "SUCCEEDED" as const,
          candidateId: candidate.id,
        };
      });
    } catch (error) {
      const adapterErr =
        error instanceof OcrAdapterError
          ? error
          : new OcrAdapterError("OCR_PROVIDER_ERROR", true);
      const canRetry =
        adapterErr.retryable && claimed.attemptCount < claimed.maxAttempts;

      return await db.$transaction(async (tx) => {
        const now = await databaseNow(tx);
        const safeMessage = redactedErrorMessage(adapterErr.code);
        if (canRetry) {
          const delayMs = Math.min(
            60_000,
            retryBaseDelayMs * 2 ** Math.max(0, claimed.attemptCount - 1),
          );
          await tx.ocrJob.update({
            where: { id: claimed.id },
            data: {
              status: "FAILED_RETRYABLE",
              nextRunAt: new Date(now.getTime() + delayMs),
              errorCode: adapterErr.code,
              errorMessage: safeMessage,
            },
          });
          return {
            jobId: claimed.id,
            status: "FAILED_RETRYABLE" as const,
            errorCode: adapterErr.code,
          };
        }

        await tx.ocrJob.update({
          where: { id: claimed.id },
          data: {
            status: "DEAD_LETTER",
            finishedAt: now,
            errorCode: adapterErr.code,
            errorMessage: safeMessage,
          },
        });
        await tx.transaction.updateMany({
          where: {
            id: claimed.transactionId,
            organizationId: claimed.organizationId,
            status: "EXTRACTING",
          },
          data: { status: "DRAFT" },
        });
        await tx.transactionEvent.create({
          data: {
            organizationId: claimed.organizationId,
            transactionId: claimed.transactionId,
            actorId: claimed.createdBy,
            action: "OCR_JOB_DEAD_LETTERED",
            changes: {
              jobId: claimed.id,
              errorCode: adapterErr.code,
              attempts: claimed.attemptCount,
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId: claimed.organizationId,
            actorId: claimed.createdBy,
            action: "OCR_JOB_DEAD_LETTERED",
            targetId: claimed.id,
          },
        });
        return {
          jobId: claimed.id,
          status: "DEAD_LETTER" as const,
          errorCode: adapterErr.code,
        };
      });
    }
  }

  async function processPendingJobs(limit = 5) {
    const results = [];
    for (let i = 0; i < limit; i++) {
      const outcome = await processNextJob();
      if (!outcome) break;
      results.push(outcome);
    }
    return results;
  }

  async function retryJob(
    sessionId: string,
    transactionId: string,
    jobId: string,
  ) {
    return withActive(
      sessionId,
      "draft.prepare",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);
        const job = await tx.ocrJob.findFirst({
          where: { id: jobId, transactionId, organizationId },
        });
        if (!job) throw new OcrError("NOT_FOUND");
        if (job.status !== "DEAD_LETTER" && job.status !== "FAILED_RETRYABLE") {
          throw new OcrError("INVALID_STATE");
        }
        const setting = await tx.organizationOcrSetting.findUnique({
          where: { organizationId },
          include: { provider: true },
        });
        if (
          !setting?.provider ||
          !setting.provider.enabled ||
          !setting.provider.vendorApproved ||
          setting.provider.adapterKey === "NONE" ||
          setting.provider.adapterKey === "EXTERNAL_NOT_CONFIGURED" ||
          !setting.externalAiConsent
        ) {
          throw new OcrError("OCR_NOT_CONFIGURED");
        }
        await tx.ocrJob.update({
          where: { id: job.id },
          data: {
            status: "QUEUED",
            attemptCount: 0,
            nextRunAt: now,
            startedAt: null,
            finishedAt: null,
            errorCode: null,
            errorMessage: null,
          },
        });
        await tx.transaction.updateMany({
          where: {
            id: transactionId,
            organizationId,
            status: { in: ["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"] },
          },
          data: { status: "EXTRACTING" },
        });
        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId,
            actorId: session.userId,
            action: "OCR_JOB_RETRIED",
            changes: { jobId: job.id },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "OCR_JOB_RETRIED",
            targetId: job.id,
          },
        });
        return { jobId: job.id, status: "QUEUED" as const };
      },
    );
  }

  async function fallbackToManual(
    sessionId: string,
    transactionId: string,
    jobId?: string,
  ) {
    return withActive(
      sessionId,
      "draft.prepare",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);
        const transaction = await tx.transaction.findFirst({
          where: { id: transactionId, organizationId },
        });
        if (!transaction) throw new OcrError("NOT_FOUND");
        if (
          transaction.status !== "EXTRACTING" &&
          transaction.status !== "NEEDS_REVIEW" &&
          transaction.status !== "DRAFT"
        ) {
          throw new OcrError("INVALID_STATE");
        }
        await tx.ocrJob.updateMany({
          where: {
            organizationId,
            transactionId,
            ...(jobId ? { id: jobId } : {}),
            status: { in: ["QUEUED", "FAILED_RETRYABLE"] },
          },
          data: { status: "CANCELLED", finishedAt: now },
        });
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { status: "DRAFT" },
        });
        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId,
            actorId: session.userId,
            action: "OCR_MANUAL_FALLBACK",
            changes: jobId ? { jobId } : {},
          },
        });
        return { status: "DRAFT" as const };
      },
    );
  }

  async function applyCandidates(
    sessionId: string,
    transactionId: string,
    candidateId: string,
    verifiedLowConfidence: boolean,
    values: {
      invoiceNumber?: string;
      documentDate?: string;
      taxPeriod?: string;
      description?: string;
      lineDescription?: string;
      quantity?: string;
      unitPrice?: string;
      verifiedCounterpartyIdentity?: string;
    },
  ) {
    return withActive(
      sessionId,
      "draft.prepare",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);
        const existing = await tx.transaction.findFirst({
          where: { id: transactionId, organizationId },
          include: { lines: { orderBy: { position: "asc" } } },
        });
        if (!existing) throw new OcrError("NOT_FOUND");
        if (!allows(existing.status, "edit")) {
          throw new OcrError("INVALID_STATE");
        }
        const candidate = await tx.ocrCandidate.findFirst({
          where: { id: candidateId, transactionId, organizationId },
        });
        if (!candidate) throw new OcrError("NOT_FOUND");

        const fields =
          candidate.extractedFields as unknown as OcrExtractedFields;
        const needsVerification =
          fields.counterpartyIdentity.requiresVerification ||
          fields.currency.requiresVerification ||
          fields.totalAmount.requiresVerification ||
          fields.lines.some((l) => l.unitPrice.requiresVerification) ||
          candidate.promptInjectionDetected;

        if (needsVerification && !verifiedLowConfidence) {
          throw new OcrError("LOW_CONFIDENCE_VERIFICATION_REQUIRED");
        }

        const nextInvoiceNumber =
          values.invoiceNumber ?? existing.invoiceNumber;
        const nextDocumentDate =
          values.documentDate ??
          existing.documentDate.toISOString().slice(0, 10);
        const nextTaxPeriod = values.taxPeriod ?? existing.taxPeriod;
        const nextDescription =
          values.description !== undefined
            ? values.description || null
            : existing.description;

        const firstLine = existing.lines[0];
        const nextLineDesc =
          values.lineDescription ?? firstLine?.description ?? "Item";
        const nextQty = canonicalFixed(
          values.quantity ?? firstLine?.quantity.toFixed(4) ?? "1",
          QUANTITY_SCALE,
        );
        const nextPrice = canonicalFixed(
          values.unitPrice ?? firstLine?.unitPrice.toFixed(2) ?? "0.00",
          AMOUNT_SCALE,
        );
        const computedLine = lineAmount(nextQty, nextPrice);
        if (!computedLine) throw new OcrError("LINE_PRECISION");

        const nextTotalAmount = sumAmounts([
          computedLine,
          ...existing.lines.slice(1).map((l) => l.amount.toFixed(2)),
        ]);
        if (!nextTotalAmount) throw new OcrError("LINE_PRECISION");

        await tx.transaction.update({
          where: { id: existing.id },
          data: {
            invoiceNumber: nextInvoiceNumber,
            invoiceNumberNormalized: normalizeInvoiceNumber(nextInvoiceNumber),
            documentDate: new Date(`${nextDocumentDate}T00:00:00.000Z`),
            taxPeriod: nextTaxPeriod,
            description: nextDescription,
            totalAmount: nextTotalAmount,
            version: { increment: 1 },
          },
        });

        if (firstLine) {
          await tx.transactionLine.update({
            where: { id: firstLine.id },
            data: {
              description: nextLineDesc,
              quantity: nextQty,
              unitPrice: nextPrice,
              amount: computedLine,
            },
          });
        }

        const appliedSnapshot = {
          invoiceNumber: nextInvoiceNumber,
          documentDate: nextDocumentDate,
          taxPeriod: nextTaxPeriod,
          lineDescription: nextLineDesc,
          quantity: nextQty,
          unitPrice: nextPrice,
          verifiedLowConfidence,
          verifiedCounterpartyIdentityHint: values.verifiedCounterpartyIdentity
            ? `••••${values.verifiedCounterpartyIdentity.slice(-4)}`
            : null,
        };

        await tx.ocrCandidate.update({
          where: { id: candidate.id },
          data: {
            appliedFields: appliedSnapshot as Prisma.InputJsonValue,
            reviewedBy: session.userId,
            reviewedAt: now,
          },
        });

        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId,
            actorId: session.userId,
            action: "OCR_CANDIDATES_APPLIED",
            changes: {
              provenance: {
                jobId: candidate.jobId,
                candidateId: candidate.id,
                providerSlug: candidate.providerSlug,
                model: candidate.model,
                providerVersion: candidate.providerVersion,
              },
              before: {
                invoiceNumber: existing.invoiceNumber,
                documentDate: existing.documentDate.toISOString().slice(0, 10),
                taxPeriod: existing.taxPeriod,
                totalAmount: existing.totalAmount.toFixed(2),
              },
              after: {
                invoiceNumber: nextInvoiceNumber,
                documentDate: nextDocumentDate,
                taxPeriod: nextTaxPeriod,
                totalAmount: nextTotalAmount,
              },
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "OCR_CORRECTION_APPLIED",
            targetId: candidate.id,
          },
        });
        return {
          transactionId: existing.id,
          version: existing.version + 1,
          totalAmount: nextTotalAmount,
        };
      },
    );
  }

  async function executeTransactionOcrCommand(
    sessionId: string,
    transactionId: string,
    raw: unknown,
  ) {
    const command = ocrCommandSchema.parse(raw);
    switch (command.action) {
      case "enqueue": {
        const queued = await enqueueJob(
          sessionId,
          transactionId,
          command.documentId,
        );
        // Kick off background extraction asynchronously without blocking the HTTP response.
        setImmediate(() => {
          void processNextJob(queued.jobId).catch(() => {});
        });
        return queued;
      }
      case "retry": {
        const retried = await retryJob(sessionId, transactionId, command.jobId);
        setImmediate(() => {
          void processNextJob(retried.jobId).catch(() => {});
        });
        return retried;
      }
      case "fallback":
        return fallbackToManual(sessionId, transactionId, command.jobId);
      case "apply":
        return applyCandidates(
          sessionId,
          transactionId,
          command.candidateId,
          command.verifiedLowConfidence,
          command.values,
        );
    }
  }

  return {
    listProviders,
    upsertProvider,
    getOrgOcrSettings,
    updateOrgOcrSettings,
    getTransactionOcr,
    enqueueJob,
    processNextJob,
    processPendingJobs,
    retryJob,
    fallbackToManual,
    applyCandidates,
    executeTransactionOcrCommand,
  };
}
