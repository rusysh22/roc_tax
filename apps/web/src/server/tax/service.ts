import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  reviewCommandSchema,
  taxPolicyCommandSchema,
  taxRuleCommandSchema,
  type TaxBlocker,
  type TaxRuleStatus,
} from "../../lib/intake/tax-rules";
import { AccessError, type Permission } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import { evaluateDeterministicTax, type RuleCandidate } from "./engine";

type Tx = Prisma.TransactionClient;

export class TaxError extends Error {
  constructor(
    public code:
      | "SME_REVIEW_REQUIRED"
      | "INVALID_EFFECTIVE_RANGE"
      | "INVALID_TAX_RATE"
      | "EVALUATION_REQUIRED"
      | "EVALUATION_STALE"
      | "EVALUATION_HAS_BLOCKERS"
      | "PRODUCTION_RULE_UNVERIFIED"
      | "SELF_APPROVAL_BLOCKED"
      | "SOLE_USER_ACK_REQUIRED"
      | "INVALID_STATE"
      | "STALE_VERSION"
      | "NOT_FOUND",
  ) {
    super(code);
  }
}

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

function toRuleCandidate(row: {
  id: string;
  code: string;
  version: number;
  taxFamily: string;
  documentType: string;
  objectCode: string;
  name: string;
  jurisdiction: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: "HALF_UP" | "FLOOR" | "CEIL";
  requireCounterpartyIdentity: boolean;
  requirePayrollEvidence: boolean;
  requireTreatyEvidence: boolean;
  sourceCitation: string;
  catalogStatus: TaxRuleStatus;
  smeReviewedBy: string | null;
}): RuleCandidate {
  return {
    ...row,
    effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
    effectiveTo: row.effectiveTo
      ? row.effectiveTo.toISOString().slice(0, 10)
      : null,
  };
}

export function taxService(db: PrismaClient) {
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

  async function listRules(sessionId: string) {
    return db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      const rows = await tx.taxRule.findMany({
        orderBy: [{ code: "asc" }, { version: "desc" }],
      });
      return {
        rules: rows.map((r) => ({
          ...toRuleCandidate(r),
          smeReviewedAt: r.smeReviewedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    });
  }

  async function mutateRule(sessionId: string, raw: unknown) {
    const command = taxRuleCommandSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      const now = await databaseNow(tx);

      if (command.action === "set_status") {
        const existing = await tx.taxRule.findUnique({
          where: { id: command.ruleId },
        });
        if (!existing) throw new TaxError("NOT_FOUND");
        if (
          command.catalogStatus === "SME_APPROVED" &&
          !command.smeReviewedBy?.trim()
        ) {
          throw new TaxError("SME_REVIEW_REQUIRED");
        }
        const updated = await tx.taxRule.update({
          where: { id: existing.id },
          data: {
            catalogStatus: command.catalogStatus,
            smeReviewedBy:
              command.catalogStatus === "SME_APPROVED"
                ? command.smeReviewedBy!.trim()
                : existing.smeReviewedBy,
            smeReviewedAt:
              command.catalogStatus === "SME_APPROVED"
                ? now
                : existing.smeReviewedAt,
          },
        });
        return { id: updated.id, catalogStatus: updated.catalogStatus };
      }

      if (command.rateNumerator > command.rateDenominator) {
        throw new TaxError("INVALID_TAX_RATE");
      }
      if (command.effectiveTo && command.effectiveTo < command.effectiveFrom) {
        throw new TaxError("INVALID_EFFECTIVE_RANGE");
      }
      if (
        command.catalogStatus === "SME_APPROVED" &&
        !command.smeReviewedBy?.trim()
      ) {
        throw new TaxError("SME_REVIEW_REQUIRED");
      }

      const created = await tx.taxRule.create({
        data: {
          code: command.code,
          version: command.version,
          taxFamily: command.taxFamily,
          documentType: command.documentType,
          objectCode: command.objectCode,
          name: command.name,
          jurisdiction: command.jurisdiction,
          effectiveFrom: new Date(`${command.effectiveFrom}T00:00:00.000Z`),
          effectiveTo: command.effectiveTo
            ? new Date(`${command.effectiveTo}T00:00:00.000Z`)
            : null,
          rateNumerator: command.rateNumerator,
          rateDenominator: command.rateDenominator,
          roundingMode: command.roundingMode,
          requireCounterpartyIdentity: command.requireCounterpartyIdentity,
          requirePayrollEvidence: command.requirePayrollEvidence,
          requireTreatyEvidence: command.requireTreatyEvidence,
          sourceCitation: command.sourceCitation,
          catalogStatus: command.catalogStatus,
          smeReviewedBy:
            command.catalogStatus === "SME_APPROVED"
              ? command.smeReviewedBy!.trim()
              : null,
          smeReviewedAt: command.catalogStatus === "SME_APPROVED" ? now : null,
          createdBy: session.userId,
        },
      });
      return {
        id: created.id,
        code: created.code,
        version: created.version,
        catalogStatus: created.catalogStatus,
      };
    });
  }

  async function getTaxPolicy(sessionId: string) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const policy = await tx.organizationTaxPolicy.findUnique({
        where: { organizationId: membership.organizationId },
      });
      return {
        role: membership.role,
        segregationPolicy: policy?.segregationPolicy ?? "STRICT_SEPARATION",
        updatedAt: policy?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async function updateTaxPolicy(sessionId: string, raw: unknown) {
    const command = taxPolicyCommandSchema.parse(raw);
    return withActive(
      sessionId,
      "team.manage",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        await tx.organizationTaxPolicy.upsert({
          where: { organizationId },
          create: {
            organizationId,
            segregationPolicy: command.segregationPolicy,
            updatedBy: session.userId,
          },
          update: {
            segregationPolicy: command.segregationPolicy,
            updatedBy: session.userId,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: `TAX_POLICY_${command.segregationPolicy}`,
          },
        });
        return { segregationPolicy: command.segregationPolicy };
      },
    );
  }

  async function getTransactionTaxState(
    sessionId: string,
    transactionId: string,
  ) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const transaction = await tx.transaction.findFirst({
        where: { id: transactionId, organizationId },
        include: {
          taxInput: true,
          taxEvaluations: { orderBy: { evaluatedAt: "desc" }, take: 10 },
          taxSnapshots: { orderBy: { approvedAt: "desc" }, take: 10 },
        },
      });
      if (!transaction) throw new TaxError("NOT_FOUND");
      const policy = await tx.organizationTaxPolicy.findUnique({
        where: { organizationId },
      });
      const rules = await tx.taxRule.findMany({
        where: {
          catalogStatus: { in: ["SME_APPROVED", "NON_PRODUCTION_TEST"] },
        },
        orderBy: [
          { catalogStatus: "asc" },
          { code: "asc" },
          { version: "desc" },
        ],
      });
      const userIds = [
        ...new Set([
          ...transaction.taxEvaluations.map((e) => e.evaluatedBy),
          ...transaction.taxSnapshots.map((s) => s.approvedBy),
        ]),
      ];
      const users = userIds.length
        ? await tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      return {
        role: membership.role,
        segregationPolicy: policy?.segregationPolicy ?? "STRICT_SEPARATION",
        taxInput: transaction.taxInput
          ? {
              objectCode: transaction.taxInput.objectCode,
              payrollEvidenceRef: transaction.taxInput.payrollEvidenceRef,
              treatyCertificateRef: transaction.taxInput.treatyCertificateRef,
              treatyCountryCode: transaction.taxInput.treatyCountryCode,
              smeOverrideNote: transaction.taxInput.smeOverrideNote,
              recipientTku: transaction.taxInput.recipientTku,
              taxCertificate: transaction.taxInput.taxCertificate,
              referenceDocType: transaction.taxInput.referenceDocType,
              govTreasurerOpt: transaction.taxInput.govTreasurerOpt,
              sp2dNumber: transaction.taxInput.sp2dNumber,
              withholdingDate: transaction.taxInput.withholdingDate
                ? transaction.taxInput.withholdingDate
                    .toISOString()
                    .slice(0, 10)
                : null,
            }
          : null,
        availableRules: rules.map((r) => ({
          id: r.id,
          code: r.code,
          version: r.version,
          taxFamily: r.taxFamily,
          documentType: r.documentType,
          objectCode: r.objectCode,
          name: r.name,
          catalogStatus: r.catalogStatus,
          effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: r.effectiveTo?.toISOString().slice(0, 10) ?? null,
          sourceCitation: r.sourceCitation,
        })),
        evaluations: transaction.taxEvaluations.map((e) => ({
          id: e.id,
          transactionVersion: e.transactionVersion,
          ruleCode: e.ruleCode,
          ruleVersion: e.ruleVersion,
          catalogStatus: e.catalogStatus,
          taxFamily: e.taxFamily,
          objectCode: e.objectCode,
          dppAmount: e.dppAmount.toFixed(2),
          taxAmount: e.taxAmount.toFixed(2),
          rateNumerator: e.rateNumerator,
          rateDenominator: e.rateDenominator,
          roundingMode: e.roundingMode,
          blockers: e.blockers as TaxBlocker[],
          evidence: e.evidence,
          evaluatedBy:
            userMap.get(e.evaluatedBy)?.name ??
            userMap.get(e.evaluatedBy)?.email ??
            e.evaluatedBy,
          evaluatedAt: e.evaluatedAt.toISOString(),
        })),
        snapshots: transaction.taxSnapshots.map((s) => ({
          id: s.id,
          transactionVersion: s.transactionVersion,
          ruleCode: s.ruleCode,
          ruleVersion: s.ruleVersion,
          sourceCitation: s.sourceCitation,
          effectiveFrom: s.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: s.effectiveTo?.toISOString().slice(0, 10) ?? null,
          taxFamily: s.taxFamily,
          objectCode: s.objectCode,
          dppAmount: s.dppAmount.toFixed(2),
          taxAmount: s.taxAmount.toFixed(2),
          rateNumerator: s.rateNumerator,
          rateDenominator: s.rateDenominator,
          roundingMode: s.roundingMode,
          segregationPolicy: s.segregationPolicy,
          soleUserExceptionUsed: s.soleUserExceptionUsed,
          approvedBy:
            userMap.get(s.approvedBy)?.name ??
            userMap.get(s.approvedBy)?.email ??
            s.approvedBy,
          approvedAt: s.approvedAt.toISOString(),
        })),
      };
    });
  }

  async function executeReviewCommand(
    sessionId: string,
    transactionId: string,
    raw: unknown,
  ) {
    const command = reviewCommandSchema.parse(raw);

    return withActive(
      sessionId,
      undefined,
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const role = membership.role;
        const now = await databaseNow(tx);

        const existing = await tx.transaction.findFirst({
          where: { id: transactionId, organizationId },
          include: {
            counterparty: true,
            taxInput: true,
          },
        });
        if (!existing) throw new TaxError("NOT_FOUND");

        if (command.action === "evaluate") {
          if (!["PREPARER", "REVIEWER"].includes(role)) {
            throw new AccessError("FORBIDDEN");
          }
          if (
            ![
              "DRAFT",
              "NEEDS_REVIEW",
              "CHANGES_REQUESTED",
              "VALIDATED",
              "SUBMITTED",
            ].includes(existing.status)
          ) {
            throw new TaxError("INVALID_STATE");
          }
          const canEditFamily = [
            "DRAFT",
            "NEEDS_REVIEW",
            "CHANGES_REQUESTED",
            "VALIDATED",
          ].includes(existing.status);
          const targetFamily =
            command.taxFamily && canEditFamily
              ? command.taxFamily
              : existing.taxFamily;
          const nextObjectCode =
            command.objectCode !== undefined
              ? command.objectCode
              : (existing.taxInput?.objectCode ?? null);
          const nextPayrollRef =
            command.payrollEvidenceRef !== undefined
              ? command.payrollEvidenceRef
              : (existing.taxInput?.payrollEvidenceRef ?? null);
          const nextTreatyRef =
            command.treatyCertificateRef !== undefined
              ? command.treatyCertificateRef
              : (existing.taxInput?.treatyCertificateRef ?? null);
          const nextTreatyCountry =
            command.treatyCountryCode !== undefined
              ? command.treatyCountryCode
              : (existing.taxInput?.treatyCountryCode ?? null);
          const nextOverrideNote =
            command.smeOverrideNote !== undefined
              ? command.smeOverrideNote
              : (existing.taxInput?.smeOverrideNote ?? null);
          const nextRecipientTku =
            command.recipientTku !== undefined
              ? command.recipientTku
              : (existing.taxInput?.recipientTku ?? null);
          const nextTaxCertificate =
            command.taxCertificate !== undefined
              ? command.taxCertificate
              : (existing.taxInput?.taxCertificate ?? "N/A");
          const nextReferenceDocType =
            command.referenceDocType !== undefined
              ? command.referenceDocType
              : (existing.taxInput?.referenceDocType ?? "CommercialInvoice");
          const nextGovTreasurerOpt =
            command.govTreasurerOpt !== undefined
              ? command.govTreasurerOpt
              : (existing.taxInput?.govTreasurerOpt ?? "N/A");
          const nextSp2dNumber =
            command.sp2dNumber !== undefined
              ? command.sp2dNumber
              : (existing.taxInput?.sp2dNumber ?? null);
          const nextWithholdingDate =
            command.withholdingDate !== undefined
              ? new Date(`${command.withholdingDate}T00:00:00.000Z`)
              : (existing.taxInput?.withholdingDate ?? null);

          await tx.transactionTaxInput.upsert({
            where: { transactionId: existing.id },
            create: {
              transactionId: existing.id,
              organizationId,
              objectCode: nextObjectCode,
              payrollEvidenceRef: nextPayrollRef,
              treatyCertificateRef: nextTreatyRef,
              treatyCountryCode: nextTreatyCountry,
              smeOverrideNote: nextOverrideNote,
              recipientTku: nextRecipientTku,
              taxCertificate: nextTaxCertificate,
              referenceDocType: nextReferenceDocType,
              govTreasurerOpt: nextGovTreasurerOpt,
              sp2dNumber: nextSp2dNumber,
              withholdingDate: nextWithholdingDate,
              updatedBy: session.userId,
            },
            update: {
              objectCode: nextObjectCode,
              payrollEvidenceRef: nextPayrollRef,
              treatyCertificateRef: nextTreatyRef,
              treatyCountryCode: nextTreatyCountry,
              smeOverrideNote: nextOverrideNote,
              recipientTku: nextRecipientTku,
              taxCertificate: nextTaxCertificate,
              referenceDocType: nextReferenceDocType,
              govTreasurerOpt: nextGovTreasurerOpt,
              sp2dNumber: nextSp2dNumber,
              withholdingDate: nextWithholdingDate,
              updatedBy: session.userId,
            },
          });

          const rules = await tx.taxRule.findMany({
            where: {
              catalogStatus: { in: ["SME_APPROVED", "NON_PRODUCTION_TEST"] },
            },
          });
          const priorEvaluation = await tx.taxEvaluation.findFirst({
            where: { transactionId: existing.id, organizationId },
            orderBy: { evaluatedAt: "desc" },
          });

          const result = evaluateDeterministicTax(
            {
              taxFamily: targetFamily,
              documentType: existing.documentType,
              documentDate: existing.documentDate.toISOString().slice(0, 10),
              dppAmount: existing.totalAmount.toFixed(2),
              counterpartyIdentityType: existing.counterparty.identityType,
              counterpartyCountryCode: existing.counterparty.countryCode,
              objectCode: nextObjectCode,
              payrollEvidenceRef: nextPayrollRef,
              treatyCertificateRef: nextTreatyRef,
              treatyCountryCode: nextTreatyCountry,
              smeOverrideNote: nextOverrideNote,
              allowNonProductionPreview: command.allowNonProductionPreview,
            },
            rules.map(toRuleCandidate),
          );

          let nextStatus = existing.status;
          if (
            canEditFamily &&
            result.blockers.length === 0 &&
            result.productionApprovedRule
          ) {
            nextStatus = "VALIDATED";
          } else if (
            canEditFamily &&
            existing.status === "VALIDATED" &&
            result.blockers.length > 0
          ) {
            nextStatus = "DRAFT";
          }

          const updatedTx = await tx.transaction.update({
            where: { id: existing.id },
            data: {
              taxFamily: targetFamily as typeof existing.taxFamily,
              status: nextStatus,
              ...(role === "REVIEWER"
                ? { lastReviewedBy: session.userId }
                : {}),
            },
          });

          const evaluation = await tx.taxEvaluation.create({
            data: {
              organizationId,
              transactionId: existing.id,
              transactionVersion: updatedTx.version,
              ruleId: result.matchedRule?.id ?? null,
              ruleCode: result.matchedRule?.code ?? null,
              ruleVersion: result.matchedRule?.version ?? null,
              catalogStatus: result.matchedRule?.catalogStatus ?? null,
              taxFamily: targetFamily as typeof existing.taxFamily,
              objectCode: result.objectCode,
              dppAmount: result.dppAmount,
              taxAmount: result.taxAmount,
              rateNumerator: result.rateNumerator,
              rateDenominator: result.rateDenominator,
              roundingMode: result.roundingMode,
              blockers: result.blockers as unknown as Prisma.InputJsonValue,
              evidence: {
                ...result.evidence,
                diff: priorEvaluation
                  ? {
                      previousTaxAmount: priorEvaluation.taxAmount.toFixed(2),
                      previousObjectCode: priorEvaluation.objectCode,
                      previousRuleCode: priorEvaluation.ruleCode,
                      previousRuleVersion: priorEvaluation.ruleVersion,
                    }
                  : null,
              } as Prisma.InputJsonValue,
              evaluatedBy: session.userId,
              evaluatedAt: now,
            },
          });

          await tx.transactionEvent.create({
            data: {
              organizationId,
              transactionId: existing.id,
              actorId: session.userId,
              action: "TAX_EVALUATED",
              changes: {
                evaluationId: evaluation.id,
                taxFamily: targetFamily,
                objectCode: result.objectCode,
                ruleCode: result.matchedRule?.code ?? null,
                ruleVersion: result.matchedRule?.version ?? null,
                catalogStatus: result.matchedRule?.catalogStatus ?? null,
                dppAmount: result.dppAmount,
                taxAmount: result.taxAmount,
                blockers: result.blockers.map((b) => b.code),
                previousTaxAmount:
                  priorEvaluation?.taxAmount.toFixed(2) ?? null,
              },
            },
          });

          return {
            evaluationId: evaluation.id,
            status: nextStatus,
            taxAmount: result.taxAmount,
            blockers: result.blockers,
            productionApprovedRule: result.productionApprovedRule,
          };
        }

        if (existing.version !== command.version) {
          throw new TaxError("STALE_VERSION");
        }

        if (command.action === "submit") {
          if (role !== "PREPARER") throw new AccessError("FORBIDDEN");
          if (existing.status !== "VALIDATED") {
            throw new TaxError("INVALID_STATE");
          }
          const latestEval = await tx.taxEvaluation.findFirst({
            where: { transactionId: existing.id, organizationId },
            orderBy: { evaluatedAt: "desc" },
          });
          if (!latestEval) throw new TaxError("EVALUATION_REQUIRED");
          if (latestEval.catalogStatus !== "SME_APPROVED") {
            throw new TaxError("PRODUCTION_RULE_UNVERIFIED");
          }
          if ((latestEval.blockers as unknown[]).length > 0) {
            throw new TaxError("EVALUATION_HAS_BLOCKERS");
          }
          if (
            latestEval.dppAmount.toFixed(2) !==
              existing.totalAmount.toFixed(2) ||
            latestEval.taxFamily !== existing.taxFamily
          ) {
            throw new TaxError("EVALUATION_STALE");
          }

          const updated = await tx.transaction.updateMany({
            where: {
              id: existing.id,
              organizationId,
              version: command.version,
              status: "VALIDATED",
            },
            data: {
              status: "SUBMITTED",
              lastSubmittedBy: session.userId,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new TaxError("STALE_VERSION");

          await tx.transactionEvent.create({
            data: {
              organizationId,
              transactionId: existing.id,
              actorId: session.userId,
              action: "TAX_SUBMITTED",
              changes: { evaluationId: latestEval.id },
            },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "TRANSACTION_SUBMITTED",
              targetId: existing.id,
            },
          });
          return {
            status: "SUBMITTED" as const,
            version: existing.version + 1,
          };
        }

        if (command.action === "request_changes") {
          if (!["REVIEWER", "APPROVER"].includes(role)) {
            throw new AccessError("FORBIDDEN");
          }
          if (
            existing.status !== "SUBMITTED" &&
            existing.status !== "VALIDATED"
          ) {
            throw new TaxError("INVALID_STATE");
          }
          const updated = await tx.transaction.updateMany({
            where: {
              id: existing.id,
              organizationId,
              version: command.version,
              status: existing.status,
            },
            data: {
              status: "CHANGES_REQUESTED",
              lastReviewedBy: session.userId,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new TaxError("STALE_VERSION");

          await tx.transactionComment.create({
            data: {
              organizationId,
              transactionId: existing.id,
              authorId: session.userId,
              body: command.reason,
            },
          });
          await tx.transactionEvent.create({
            data: {
              organizationId,
              transactionId: existing.id,
              actorId: session.userId,
              action: "REVIEW_CHANGES_REQUESTED",
              changes: {
                previousStatus: existing.status,
                reason: command.reason,
              },
            },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "TRANSACTION_CHANGES_REQUESTED",
              targetId: existing.id,
            },
          });
          return {
            status: "CHANGES_REQUESTED" as const,
            version: existing.version + 1,
          };
        }

        if (command.action === "reopen") {
          if (!["REVIEWER", "APPROVER"].includes(role)) {
            throw new AccessError("FORBIDDEN");
          }
          if (!["APPROVED", "CORETAX_REJECTED"].includes(existing.status)) {
            throw new TaxError("INVALID_STATE");
          }
          const updated = await tx.transaction.updateMany({
            where: {
              id: existing.id,
              organizationId,
              version: command.version,
              status: { in: ["APPROVED", "CORETAX_REJECTED"] },
            },
            data: {
              status: "CHANGES_REQUESTED",
              lastReviewedBy: session.userId,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new TaxError("STALE_VERSION");

          await tx.transactionComment.create({
            data: {
              organizationId,
              transactionId: existing.id,
              authorId: session.userId,
              body: command.reason,
            },
          });
          await tx.transactionEvent.create({
            data: {
              organizationId,
              transactionId: existing.id,
              actorId: session.userId,
              action: "TAX_REOPENED",
              changes: { reason: command.reason },
            },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "TRANSACTION_REOPENED",
              targetId: existing.id,
            },
          });
          return {
            status: "CHANGES_REQUESTED" as const,
            version: existing.version + 1,
          };
        }

        // action === "approve"
        if (role !== "APPROVER") throw new AccessError("FORBIDDEN");
        if (existing.status !== "SUBMITTED") {
          throw new TaxError("INVALID_STATE");
        }

        const latestEval = await tx.taxEvaluation.findFirst({
          where: { transactionId: existing.id, organizationId },
          include: { rule: true },
          orderBy: { evaluatedAt: "desc" },
        });
        if (!latestEval || !latestEval.rule) {
          throw new TaxError("EVALUATION_REQUIRED");
        }
        if (
          latestEval.catalogStatus !== "SME_APPROVED" ||
          latestEval.rule.catalogStatus !== "SME_APPROVED"
        ) {
          throw new TaxError("PRODUCTION_RULE_UNVERIFIED");
        }
        if ((latestEval.blockers as unknown[]).length > 0) {
          throw new TaxError("EVALUATION_HAS_BLOCKERS");
        }
        const newerContentEdit = await tx.transactionEvent.findFirst({
          where: {
            transactionId: existing.id,
            organizationId,
            action: { in: ["DRAFT_UPDATED", "OCR_CANDIDATES_APPLIED"] },
            createdAt: { gt: latestEval.evaluatedAt },
          },
        });
        if (
          newerContentEdit ||
          latestEval.dppAmount.toFixed(2) !== existing.totalAmount.toFixed(2) ||
          latestEval.taxFamily !== existing.taxFamily
        ) {
          throw new TaxError("EVALUATION_STALE");
        }

        const policyRow = await tx.organizationTaxPolicy.findUnique({
          where: { organizationId },
        });
        const segregationPolicy =
          policyRow?.segregationPolicy ?? "STRICT_SEPARATION";
        const isSelfApproval =
          existing.createdBy === session.userId ||
          existing.lastSubmittedBy === session.userId ||
          existing.lastReviewedBy === session.userId;

        if (isSelfApproval) {
          if (segregationPolicy === "STRICT_SEPARATION") {
            throw new TaxError("SELF_APPROVAL_BLOCKED");
          }
          if (!command.soleUserOverrideAck) {
            throw new TaxError("SOLE_USER_ACK_REQUIRED");
          }
        }

        const updated = await tx.transaction.updateMany({
          where: {
            id: existing.id,
            organizationId,
            version: command.version,
            status: "SUBMITTED",
          },
          data: {
            status: "APPROVED",
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new TaxError("STALE_VERSION");

        const latestEvalEvidence =
          (latestEval.evidence as Record<string, unknown> | null) ?? {};
        const snapshotEvidence = {
          ...latestEvalEvidence,
          exportContext: existing.taxInput
            ? {
                recipientTku: existing.taxInput.recipientTku,
                taxCertificate: existing.taxInput.taxCertificate,
                referenceDocType: existing.taxInput.referenceDocType,
                govTreasurerOpt: existing.taxInput.govTreasurerOpt,
                sp2dNumber: existing.taxInput.sp2dNumber,
                withholdingDate: existing.taxInput.withholdingDate
                  ? existing.taxInput.withholdingDate.toISOString().slice(0, 10)
                  : null,
              }
            : null,
        };

        const snapshot = await tx.taxEvaluationSnapshot.create({
          data: {
            organizationId,
            transactionId: existing.id,
            evaluationId: latestEval.id,
            transactionVersion: existing.version + 1,
            ruleId: latestEval.rule.id,
            ruleCode: latestEval.rule.code,
            ruleVersion: latestEval.rule.version,
            sourceCitation: latestEval.rule.sourceCitation,
            effectiveFrom: latestEval.rule.effectiveFrom,
            effectiveTo: latestEval.rule.effectiveTo,
            taxFamily: latestEval.taxFamily,
            objectCode: latestEval.objectCode ?? latestEval.rule.objectCode,
            dppAmount: latestEval.dppAmount,
            taxAmount: latestEval.taxAmount,
            rateNumerator: latestEval.rateNumerator,
            rateDenominator: latestEval.rateDenominator,
            roundingMode: latestEval.roundingMode,
            evidence: snapshotEvidence as Prisma.InputJsonValue,
            segregationPolicy,
            soleUserExceptionUsed: isSelfApproval,
            submittedBy: existing.lastSubmittedBy,
            reviewedBy: existing.lastReviewedBy,
            approvedBy: session.userId,
            approvedAt: now,
          },
        });

        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId: existing.id,
            actorId: session.userId,
            action: "TAX_APPROVED",
            changes: {
              snapshotId: snapshot.id,
              ruleCode: snapshot.ruleCode,
              ruleVersion: snapshot.ruleVersion,
              dppAmount: snapshot.dppAmount.toFixed(2),
              taxAmount: snapshot.taxAmount.toFixed(2),
              soleUserExceptionUsed: isSelfApproval,
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: isSelfApproval
              ? "TAX_APPROVED_SOLE_USER_EXCEPTION"
              : "TAX_APPROVED",
            targetId: existing.id,
          },
        });

        return {
          status: "APPROVED" as const,
          snapshotId: snapshot.id,
          version: existing.version + 1,
          soleUserExceptionUsed: isSelfApproval,
        };
      },
    );
  }

  return {
    listRules,
    mutateRule,
    getTaxPolicy,
    updateTaxPolicy,
    getTransactionTaxState,
    executeReviewCommand,
  };
}
