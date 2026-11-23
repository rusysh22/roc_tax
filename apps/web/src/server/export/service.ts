import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  adminXmlTemplateCommandSchema,
  exportCapableFamilies,
  generateExportSchema,
  OFFICIAL_BPPU_V3_SOURCE,
  recordOutcomeSchema,
  type BppuGovTreasurerOpt,
  type BppuTaxCertificate,
} from "../../lib/export/bppu-spec";
import { familyReadiness } from "../../lib/export/family-readiness";
import {
  rationalToBppuPercent,
  serializeBpuBulkXml,
  validateBpuBulkXml,
  type BpuItem,
} from "../../lib/export/bppu";
import { sumAmounts } from "../../lib/intake/decimal";
import { identityHint } from "../../lib/intake/identity";
import { allTaxFamilies } from "../../lib/intake/tax-rules";
import type { TaxCrypto } from "../intake/crypto";
import type { DocumentStorage } from "../intake/storage";
import { AccessError, can, type Permission } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import { assertWorkspaceWritable } from "../lifecycle/state";

type Tx = Prisma.TransactionClient;

export class ExportError extends Error {
  constructor(
    public code:
      | "TEMPLATE_UNVERIFIED"
      | "TEMPLATE_ALREADY_EXISTS"
      | "NOT_FOUND"
      | "NOT_APPROVED"
      | "SNAPSHOT_REQUIRED"
      | "PRODUCTION_RULE_UNVERIFIED"
      | "BATCH_SCOPE_MISMATCH"
      | "COMPANY_TAX_ID_REQUIRED"
      | "COUNTERPARTY_TIN_REQUIRED"
      | "RECIPIENT_TKU_REQUIRED"
      | "UNSUPPORTED_CURRENCY"
      | "WITHHOLDING_DATE_INVALID"
      | "XML_VALIDATION_FAILED"
      | "IDEMPOTENCY_CONFLICT"
      | "INTEGRITY_MISMATCH"
      | "INVALID_STATE",
  ) {
    super(code);
  }
}

function sha256Hex(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
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

function formatBatchRow(
  row: {
    id: string;
    companyId: string;
    taxFamily: string;
    taxPeriod: string;
    templateVersionTag: string;
    sourceSha256: string;
    exportVersion: number;
    fileName: string;
    xmlSha256: string;
    sizeBytes: number;
    itemCount: number;
    totalDppAmount: Prisma.Decimal;
    totalTaxAmount: Prisma.Decimal;
    exportedBy: string;
    exportedAt: Date;
    company: { name: string };
    items: {
      id: string;
      transactionId: string;
      snapshotId: string;
      sequenceNo: number;
      taxObjectCode: string;
      dppAmount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      ratePercent: string;
    }[];
    outcomes: {
      id: string;
      outcome: string;
      coretaxReference: string | null;
      accountHint: string | null;
      portalTimestamp: Date | null;
      evidenceSha256: string | null;
      notes: string | null;
      recordedBy: string;
      recordedAt: Date;
    }[];
  },
  userMap: Map<string, { name: string | null; email: string }>,
) {
  const nameOf = (id: string) =>
    userMap.get(id)?.name ?? userMap.get(id)?.email ?? id;
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    taxFamily: row.taxFamily,
    taxPeriod: row.taxPeriod,
    templateVersionTag: row.templateVersionTag,
    sourceSha256: row.sourceSha256,
    exportVersion: row.exportVersion,
    fileName: row.fileName,
    xmlSha256: row.xmlSha256,
    sizeBytes: row.sizeBytes,
    itemCount: row.itemCount,
    totalDppAmount: row.totalDppAmount.toFixed(2),
    totalTaxAmount: row.totalTaxAmount.toFixed(2),
    exportedBy: nameOf(row.exportedBy),
    exportedAt: row.exportedAt.toISOString(),
    items: row.items.map((it) => ({
      id: it.id,
      transactionId: it.transactionId,
      snapshotId: it.snapshotId,
      sequenceNo: it.sequenceNo,
      taxObjectCode: it.taxObjectCode,
      dppAmount: it.dppAmount.toFixed(2),
      taxAmount: it.taxAmount.toFixed(2),
      ratePercent: it.ratePercent,
    })),
    outcomes: row.outcomes.map((out) => ({
      id: out.id,
      outcome: out.outcome,
      coretaxReference: out.coretaxReference,
      accountHint: out.accountHint,
      portalTimestamp: out.portalTimestamp?.toISOString() ?? null,
      evidenceSha256: out.evidenceSha256,
      notes: out.notes,
      recordedBy: nameOf(out.recordedBy),
      recordedAt: out.recordedAt.toISOString(),
    })),
  };
}

export function exportService(
  db: PrismaClient,
  taxCrypto: TaxCrypto,
  storage: DocumentStorage,
) {
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
      if (actor.session.activeOrganizationId !== organizationId) {
        throw new AccessError("CONFLICT");
      }
      return fn(tx, actor);
    });
  }

  async function listAdminTemplates(sessionId: string) {
    return db.$transaction(async (tx) => {
      await requireSuperadmin(tx, sessionId);
      const [templates, approvedRules] = await Promise.all([
        tx.xmlTemplate.findMany({
          orderBy: [{ taxFamily: "asc" }, { createdAt: "desc" }],
        }),
        tx.taxRule.findMany({
          where: { catalogStatus: "SME_APPROVED" },
          select: { taxFamily: true },
          distinct: ["taxFamily"],
        }),
      ]);
      const approvedFamilies = new Set(approvedRules.map((r) => r.taxFamily));
      return {
        officialBppuReference: OFFICIAL_BPPU_V3_SOURCE,
        readiness: allTaxFamilies
          .filter((family) => family !== "UNCLASSIFIED")
          .map((family) =>
            familyReadiness(family, {
              templates: templates.filter((t) => t.taxFamily === family),
              hasApprovedRule: approvedFamilies.has(family),
            }),
          ),
        templates: templates.map((t) => ({
          id: t.id,
          taxFamily: t.taxFamily,
          versionTag: t.versionTag,
          sourceUrl: t.sourceUrl,
          sourceLabel: t.sourceLabel,
          sourcePublishedAt: t.sourcePublishedAt?.toISOString() ?? null,
          sourceSha256: t.sourceSha256,
          referenceUrl: t.referenceUrl,
          referenceSha256: t.referenceSha256,
          xsdSchemaHash: t.xsdSchemaHash,
          status: t.status,
          fixtureVerified: t.fixtureVerified,
          notes: t.notes,
          verifiedBy: t.verifiedBy,
          verifiedAt: t.verifiedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    });
  }

  async function mutateAdminTemplate(sessionId: string, raw: unknown) {
    const command = adminXmlTemplateCommandSchema.parse(raw);
    return db.$transaction(async (tx) => {
      const session = await requireSuperadmin(tx, sessionId);
      const now = await databaseNow(tx);

      if (command.action === "create") {
        const dup = await tx.xmlTemplate.findUnique({
          where: {
            taxFamily_versionTag: {
              taxFamily: command.taxFamily,
              versionTag: command.versionTag,
            },
          },
        });
        if (dup) throw new ExportError("TEMPLATE_ALREADY_EXISTS");

        const created = await tx.xmlTemplate.create({
          data: {
            taxFamily: command.taxFamily,
            versionTag: command.versionTag,
            sourceUrl: command.sourceUrl,
            sourceLabel: command.sourceLabel,
            sourcePublishedAt: command.sourcePublishedAt
              ? new Date(command.sourcePublishedAt)
              : null,
            sourceSha256: command.sourceSha256,
            referenceUrl: command.referenceUrl ?? null,
            referenceSha256: command.referenceSha256 ?? null,
            xsdSchemaHash: command.xsdSchemaHash,
            status: "UNVERIFIED",
            fixtureVerified: command.fixtureVerified,
            mappingSpec: {
              registeredBy: session.userId,
              registeredAt: now.toISOString(),
            },
            notes: command.notes,
            createdBy: session.userId,
          },
        });
        return { template: { id: created.id, status: created.status } };
      }

      const existing = await tx.xmlTemplate.findUnique({
        where: { id: command.templateId },
      });
      if (!existing) throw new ExportError("NOT_FOUND");

      const nextFixtureVerified =
        command.fixtureVerified ?? existing.fixtureVerified;

      if (command.status === "VERIFIED") {
        const isSupportedFamily = (
          exportCapableFamilies as readonly string[]
        ).includes(existing.taxFamily);
        if (!isSupportedFamily || !nextFixtureVerified) {
          throw new ExportError("TEMPLATE_UNVERIFIED");
        }
        if (
          existing.taxFamily === "PPH_UNIFIKASI_BPPU" &&
          existing.xsdSchemaHash !== OFFICIAL_BPPU_V3_SOURCE.xsdSchemaHash
        ) {
          throw new ExportError("TEMPLATE_UNVERIFIED");
        }
      }

      const updated = await tx.xmlTemplate.update({
        where: { id: existing.id },
        data: {
          status: command.status,
          fixtureVerified: nextFixtureVerified,
          notes: command.notes ?? existing.notes,
          verifiedBy:
            command.status === "VERIFIED"
              ? session.userId
              : existing.verifiedBy,
          verifiedAt: command.status === "VERIFIED" ? now : existing.verifiedAt,
        },
      });
      return { template: { id: updated.id, status: updated.status } };
    });
  }

  async function listWorkspaceExports(sessionId: string) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;

      const [templates, companies, eligible, batches] = await Promise.all([
        tx.xmlTemplate.findMany({
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
        tx.company.findMany({
          where: { organizationId, archivedAt: null },
          select: {
            id: true,
            name: true,
            npwpHint: true,
            nitkuHint: true,
          },
          orderBy: { name: "asc" },
        }),
        tx.transaction.findMany({
          where: {
            organizationId,
            status: { in: ["APPROVED", "EXPORTED"] },
          },
          include: {
            company: { select: { id: true, name: true } },
            counterparty: {
              select: { id: true, name: true, identityType: true },
            },
            taxSnapshots: {
              orderBy: { approvedAt: "desc" },
              take: 1,
            },
          },
          orderBy: [{ taxPeriod: "desc" }, { invoiceNumberNormalized: "asc" }],
        }),
        tx.xmlExportBatch.findMany({
          where: { organizationId },
          include: {
            company: { select: { name: true } },
            items: { orderBy: { sequenceNo: "asc" } },
            outcomes: { orderBy: { recordedAt: "desc" } },
          },
          orderBy: { exportedAt: "desc" },
          take: 50,
        }),
      ]);

      const userIds = [
        ...new Set([
          ...batches.map((b) => b.exportedBy),
          ...batches.flatMap((b) => b.outcomes.map((o) => o.recordedBy)),
        ]),
      ];
      const users = userIds.length
        ? await tx.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const familyMatrix = allTaxFamilies
        .filter((f) => f !== "UNCLASSIFIED")
        .map((taxFamily) => {
          const verifiedTemplate = templates.find(
            (t) =>
              t.taxFamily === taxFamily &&
              t.status === "VERIFIED" &&
              t.fixtureVerified &&
              (exportCapableFamilies as readonly string[]).includes(taxFamily),
          );
          return {
            taxFamily,
            state: verifiedTemplate
              ? ("AVAILABLE" as const)
              : ("TEMPLATE_UNVERIFIED" as const),
            template: verifiedTemplate
              ? {
                  id: verifiedTemplate.id,
                  versionTag: verifiedTemplate.versionTag,
                  sourceUrl: verifiedTemplate.sourceUrl,
                  sourceLabel: verifiedTemplate.sourceLabel,
                  sourcePublishedAt:
                    verifiedTemplate.sourcePublishedAt?.toISOString() ?? null,
                  sourceSha256: verifiedTemplate.sourceSha256,
                  xsdSchemaHash: verifiedTemplate.xsdSchemaHash,
                  verifiedAt:
                    verifiedTemplate.verifiedAt?.toISOString() ?? null,
                }
              : null,
          };
        });

      return {
        role: membership.role,
        companies,
        familyMatrix,
        eligibleTransactions: eligible.map((t) => {
          const snap = t.taxSnapshots[0] ?? null;
          return {
            id: t.id,
            companyId: t.companyId,
            companyName: t.company.name,
            counterpartyName: t.counterparty.name,
            counterpartyIdentityType: t.counterparty.identityType,
            taxFamily: t.taxFamily,
            taxPeriod: t.taxPeriod,
            documentDate: t.documentDate.toISOString().slice(0, 10),
            invoiceNumber: t.invoiceNumber,
            currency: t.currency,
            status: t.status,
            version: t.version,
            snapshot: snap
              ? {
                  id: snap.id,
                  transactionVersion: snap.transactionVersion,
                  ruleCode: snap.ruleCode,
                  ruleVersion: snap.ruleVersion,
                  objectCode: snap.objectCode,
                  dppAmount: snap.dppAmount.toFixed(2),
                  taxAmount: snap.taxAmount.toFixed(2),
                  ratePercent: rationalToBppuPercent(
                    snap.rateNumerator,
                    snap.rateDenominator,
                  ),
                  approvedAt: snap.approvedAt.toISOString(),
                }
              : null,
          };
        }),
        batches: batches.map((b) => formatBatchRow(b, userMap)),
      };
    });
  }

  async function generateExport(sessionId: string, raw: unknown) {
    const input = generateExportSchema.parse(raw);
    const uniqueTxIds = [...new Set(input.transactionIds)];
    if (uniqueTxIds.length !== input.transactionIds.length) {
      throw new ExportError("BATCH_SCOPE_MISMATCH");
    }

    const requestHash = sha256Hex(
      JSON.stringify({
        companyId: input.companyId,
        taxFamily: input.taxFamily,
        taxPeriod: input.taxPeriod,
        templateVersionTag: input.templateVersionTag ?? "",
        transactionIds: [...uniqueTxIds].sort(),
      }),
    );

    let putStorageKey: string | null = null;
    let activeOrgId: string | null = null;

    try {
      return await withActive(
        sessionId,
        "tax.export",
        async (tx, { session, membership }) => {
          const organizationId = membership.organizationId;
          await assertWorkspaceWritable(
            tx,
            organizationId,
            await databaseNow(tx),
          );
          activeOrgId = organizationId;
          const now = await databaseNow(tx);

          const existingByIdem = await tx.xmlExportBatch.findUnique({
            where: {
              organizationId_idempotencyKey: {
                organizationId,
                idempotencyKey: input.idempotencyKey,
              },
            },
            include: {
              company: { select: { name: true } },
              items: { orderBy: { sequenceNo: "asc" } },
              outcomes: { orderBy: { recordedAt: "desc" } },
            },
          });
          if (existingByIdem) {
            if (existingByIdem.requestHash !== requestHash) {
              throw new ExportError("IDEMPOTENCY_CONFLICT");
            }
            const user = await tx.user.findUnique({
              where: { id: existingByIdem.exportedBy },
              select: { id: true, name: true, email: true },
            });
            const map = new Map(user ? [[user.id, user]] : []);
            return {
              idempotentReplay: true,
              batch: formatBatchRow(existingByIdem, map),
            };
          }

          if (
            !(exportCapableFamilies as readonly string[]).includes(
              input.taxFamily,
            )
          ) {
            throw new ExportError("TEMPLATE_UNVERIFIED");
          }

          const template = await tx.xmlTemplate.findFirst({
            where: {
              taxFamily: input.taxFamily,
              status: "VERIFIED",
              fixtureVerified: true,
              ...(input.templateVersionTag
                ? { versionTag: input.templateVersionTag }
                : {}),
            },
            orderBy: { verifiedAt: "desc" },
          });
          if (!template) {
            throw new ExportError("TEMPLATE_UNVERIFIED");
          }

          const company = await tx.company.findFirst({
            where: {
              id: input.companyId,
              organizationId,
              archivedAt: null,
            },
          });
          if (!company) throw new ExportError("NOT_FOUND");
          if (!company.npwpCipher || !company.nitkuCipher) {
            throw new ExportError("COMPANY_TAX_ID_REQUIRED");
          }

          const companyNpwp = taxCrypto.reveal(
            organizationId,
            "COMPANY_NPWP",
            company.npwpCipher,
          );
          const companyNitku = taxCrypto.reveal(
            organizationId,
            "COMPANY_NITKU",
            company.nitkuCipher,
          );
          if (
            !/^[0-9]{15,16}$/.test(companyNpwp) ||
            !/^[0-9]{22}$/.test(companyNitku)
          ) {
            throw new ExportError("COMPANY_TAX_ID_REQUIRED");
          }

          const transactions = await tx.transaction.findMany({
            where: {
              organizationId,
              id: { in: uniqueTxIds },
            },
            include: {
              counterparty: true,
              taxInput: true,
              taxSnapshots: {
                orderBy: { approvedAt: "desc" },
                take: 1,
                include: { rule: true },
              },
            },
          });
          if (transactions.length !== uniqueTxIds.length) {
            throw new ExportError("NOT_FOUND");
          }

          transactions.sort(
            (a, b) =>
              a.invoiceNumberNormalized.localeCompare(
                b.invoiceNumberNormalized,
              ) || a.id.localeCompare(b.id),
          );

          const periodParts = input.taxPeriod.split("-");
          const taxPeriodYear = Number(periodParts[0]);
          const taxPeriodMonth = Number(periodParts[1]);
          const periodStartDate = `${input.taxPeriod}-01`;

          const bpuItems: BpuItem[] = [];
          const exportItemMeta: {
            transactionId: string;
            snapshotId: string;
            transactionVersion: number;
            taxObjectCode: string;
            dppAmount: string;
            taxAmount: string;
            ratePercent: string;
            payloadMeta: Record<string, unknown>;
          }[] = [];

          for (const t of transactions) {
            if (
              t.companyId !== input.companyId ||
              t.taxFamily !== input.taxFamily ||
              t.taxPeriod !== input.taxPeriod
            ) {
              throw new ExportError("BATCH_SCOPE_MISMATCH");
            }
            if (!["APPROVED", "EXPORTED"].includes(t.status)) {
              throw new ExportError("NOT_APPROVED");
            }
            if (t.currency !== "IDR") {
              throw new ExportError("UNSUPPORTED_CURRENCY");
            }

            const snap = t.taxSnapshots[0];
            if (!snap || snap.transactionVersion !== t.version) {
              throw new ExportError("SNAPSHOT_REQUIRED");
            }
            if (snap.rule.catalogStatus !== "SME_APPROVED") {
              throw new ExportError("PRODUCTION_RULE_UNVERIFIED");
            }

            if (
              !["NPWP", "NIK"].includes(t.counterparty.identityType) ||
              !t.counterparty.identityCipher
            ) {
              throw new ExportError("COUNTERPARTY_TIN_REQUIRED");
            }
            const counterpartTin = taxCrypto.reveal(
              organizationId,
              `COUNTERPARTY_${t.counterparty.identityType}`,
              t.counterparty.identityCipher,
            );
            if (!/^[0-9]{15,16}$/.test(counterpartTin)) {
              throw new ExportError("COUNTERPARTY_TIN_REQUIRED");
            }

            const evidenceObj =
              (snap.evidence as {
                exportContext?: {
                  recipientTku?: string | null;
                  taxCertificate?: string | null;
                  referenceDocType?: string | null;
                  govTreasurerOpt?: string | null;
                  sp2dNumber?: string | null;
                  withholdingDate?: string | null;
                } | null;
              } | null) ?? null;
            const ctx = evidenceObj?.exportContext ?? t.taxInput ?? null;

            let recipientTku = ctx?.recipientTku ?? null;
            let recipientTkuSource: "EXPLICIT" | "DERIVED_HEAD_OFFICE_000000" =
              "EXPLICIT";
            if (!recipientTku) {
              if (counterpartTin.length === 16) {
                recipientTku = `${counterpartTin}000000`;
                recipientTkuSource = "DERIVED_HEAD_OFFICE_000000";
              } else {
                throw new ExportError("RECIPIENT_TKU_REQUIRED");
              }
            }
            if (!/^[0-9]{22}$/.test(recipientTku)) {
              throw new ExportError("RECIPIENT_TKU_REQUIRED");
            }

            const documentDate = t.documentDate.toISOString().slice(0, 10);
            const withholdingDateRaw =
              ctx?.withholdingDate instanceof Date
                ? ctx.withholdingDate.toISOString().slice(0, 10)
                : (ctx?.withholdingDate ?? null);
            const withholdingDate =
              withholdingDateRaw ??
              (documentDate >= periodStartDate
                ? documentDate
                : periodStartDate);
            if (withholdingDate < periodStartDate) {
              throw new ExportError("WITHHOLDING_DATE_INVALID");
            }

            const taxCertificate = (ctx?.taxCertificate ??
              "N/A") as BppuTaxCertificate;
            const referenceDocType = (ctx?.referenceDocType ??
              "CommercialInvoice") as BpuItem["document"];
            const govTreasurerOpt = (ctx?.govTreasurerOpt ??
              "N/A") as BppuGovTreasurerOpt;
            const sp2dNumber = ctx?.sp2dNumber ?? null;

            const dppAmount = snap.dppAmount.toFixed(2);
            const taxAmount = snap.taxAmount.toFixed(2);
            const ratePercent = rationalToBppuPercent(
              snap.rateNumerator,
              snap.rateDenominator,
            );

            bpuItems.push({
              taxPeriodMonth,
              taxPeriodYear,
              counterpartTin,
              recipientTku,
              taxCertificate,
              taxObjectCode: snap.objectCode,
              taxBase: dppAmount,
              rate: ratePercent,
              document: referenceDocType,
              documentNumber: t.invoiceNumber,
              documentDate,
              idPlaceOfBusinessActivity: companyNitku,
              govTreasurerOpt,
              sp2dNumber,
              withholdingDate,
            });

            exportItemMeta.push({
              transactionId: t.id,
              snapshotId: snap.id,
              transactionVersion: t.version,
              taxObjectCode: snap.objectCode,
              dppAmount,
              taxAmount,
              ratePercent,
              payloadMeta: {
                tinHint: identityHint(companyNpwp),
                counterpartTinHint: identityHint(counterpartTin),
                recipientTkuSource,
                taxCertificate,
                referenceDocType,
                documentDate,
                withholdingDate,
                govTreasurerOpt,
                sp2dPresent: Boolean(sp2dNumber),
              },
            });
          }

          let xmlText: string;
          try {
            xmlText = serializeBpuBulkXml({
              tin: companyNpwp,
              items: bpuItems,
            });
            validateBpuBulkXml(xmlText);
          } catch {
            throw new ExportError("XML_VALIDATION_FAILED");
          }

          const xmlBytes = new TextEncoder().encode(xmlText);
          const xmlSha256 = sha256Hex(xmlBytes);

          const prevBatch = await tx.xmlExportBatch.findFirst({
            where: {
              organizationId,
              companyId: input.companyId,
              taxFamily: input.taxFamily,
              taxPeriod: input.taxPeriod,
            },
            orderBy: { exportVersion: "desc" },
            select: { exportVersion: true },
          });
          const exportVersion = (prevBatch?.exportVersion ?? 0) + 1;
          const fileName = `BPPU-${input.taxPeriod}-v${exportVersion}.xml`;

          putStorageKey = await storage.put(organizationId, xmlBytes);

          const totalDppAmount = sumAmounts(
            exportItemMeta.map((i) => i.dppAmount),
          );
          const totalTaxAmount = sumAmounts(
            exportItemMeta.map((i) => i.taxAmount),
          );
          if (!totalDppAmount || !totalTaxAmount) {
            throw new ExportError("XML_VALIDATION_FAILED");
          }

          const createdBatchRow = await tx.xmlExportBatch.create({
            data: {
              organizationId,
              companyId: input.companyId,
              templateId: template.id,
              taxFamily: input.taxFamily,
              taxPeriod: input.taxPeriod,
              templateVersionTag: template.versionTag,
              sourceSha256: template.sourceSha256,
              exportVersion,
              idempotencyKey: input.idempotencyKey,
              requestHash,
              fileName,
              storageKey: putStorageKey,
              xmlSha256,
              sizeBytes: xmlBytes.byteLength,
              itemCount: exportItemMeta.length,
              totalDppAmount,
              totalTaxAmount,
              exportedBy: session.userId,
              exportedAt: now,
            },
          });

          await tx.xmlExportItem.createMany({
            data: exportItemMeta.map((item, idx) => ({
              organizationId,
              batchId: createdBatchRow.id,
              transactionId: item.transactionId,
              snapshotId: item.snapshotId,
              transactionVersion: item.transactionVersion,
              sequenceNo: idx + 1,
              taxObjectCode: item.taxObjectCode,
              dppAmount: item.dppAmount,
              taxAmount: item.taxAmount,
              ratePercent: item.ratePercent,
              payloadMeta: item.payloadMeta as Prisma.InputJsonValue,
            })),
          });

          const createdBatch = await tx.xmlExportBatch.findUniqueOrThrow({
            where: { id: createdBatchRow.id },
            include: {
              company: { select: { name: true } },
              items: { orderBy: { sequenceNo: "asc" } },
              outcomes: { orderBy: { recordedAt: "desc" } },
            },
          });

          const approvedTxIds = transactions
            .filter((t) => t.status === "APPROVED")
            .map((t) => t.id);
          if (approvedTxIds.length > 0) {
            await tx.transaction.updateMany({
              where: {
                organizationId,
                id: { in: approvedTxIds },
                status: "APPROVED",
              },
              data: { status: "EXPORTED" },
            });
          }

          await tx.transactionEvent.createMany({
            data: exportItemMeta.map((item) => ({
              organizationId,
              transactionId: item.transactionId,
              actorId: session.userId,
              action: "XML_EXPORTED",
              changes: {
                batchId: createdBatch.id,
                exportVersion,
                templateVersionTag: template.versionTag,
                snapshotId: item.snapshotId,
                xmlSha256,
              } as Prisma.InputJsonValue,
            })),
          });

          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "XML_EXPORT_CREATED",
              targetId: createdBatch.id,
            },
          });

          const user = await tx.user.findUnique({
            where: { id: session.userId },
            select: { id: true, name: true, email: true },
          });
          const map = new Map(user ? [[user.id, user]] : []);
          return {
            idempotentReplay: false,
            batch: formatBatchRow(createdBatch, map),
          };
        },
      );
    } catch (error) {
      if (putStorageKey && activeOrgId) {
        await storage.remove(activeOrgId, putStorageKey).catch(() => {});
      }
      throw error;
    }
  }

  /**
   * Download an already generated XML file. Tax roles (tax.export) and
   * workspace Owners/Admins (team.manage, who can already export all
   * workspace data) may download; generating new XML stays tax-role only.
   */
  async function downloadExport(sessionId: string, batchId: string) {
    return withActive(
      sessionId,
      undefined,
      async (tx, { session, membership }) => {
        if (
          !can(membership.role, "tax.export") &&
          !can(membership.role, "team.manage")
        )
          throw new AccessError("FORBIDDEN");
        const organizationId = membership.organizationId;
        const batch = await tx.xmlExportBatch.findFirst({
          where: { id: batchId, organizationId },
        });
        if (!batch || batch.storageKey.includes("/purged-"))
          throw new ExportError("NOT_FOUND");

        const bytes = await storage.get(organizationId, batch.storageKey);
        if (sha256Hex(bytes) !== batch.xmlSha256) {
          throw new ExportError("INTEGRITY_MISMATCH");
        }

        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "XML_EXPORT_DOWNLOADED",
            targetId: batch.id,
          },
        });

        return {
          fileName: batch.fileName,
          xmlSha256: batch.xmlSha256,
          bytes,
        };
      },
    );
  }

  async function recordOutcome(
    sessionId: string,
    batchId: string,
    raw: unknown,
  ) {
    const input = recordOutcomeSchema.parse(raw);
    return withActive(
      sessionId,
      "tax.export",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const now = await databaseNow(tx);

        const batch = await tx.xmlExportBatch.findFirst({
          where: { id: batchId, organizationId },
          include: { items: true },
        });
        if (!batch) throw new ExportError("NOT_FOUND");

        const createdOutcome = await tx.xmlExportOutcome.create({
          data: {
            organizationId,
            batchId: batch.id,
            outcome: input.outcome,
            coretaxReference: input.coretaxReference || null,
            accountHint: input.accountHint || null,
            portalTimestamp: input.portalTimestamp
              ? new Date(input.portalTimestamp)
              : null,
            evidenceSha256: input.evidenceSha256 || null,
            notes: input.notes || null,
            recordedBy: session.userId,
            recordedAt: now,
          },
        });

        const txIds = batch.items.map((item) => item.transactionId);
        if (
          input.outcome === "CORETAX_ACCEPTED" ||
          input.outcome === "CORETAX_REJECTED"
        ) {
          await tx.transaction.updateMany({
            where: {
              organizationId,
              id: { in: txIds },
              status: "EXPORTED",
            },
            data: { status: input.outcome },
          });
        }

        await tx.transactionEvent.createMany({
          data: txIds.map((transactionId) => ({
            organizationId,
            transactionId,
            actorId: session.userId,
            action: input.outcome,
            changes: {
              batchId: batch.id,
              outcomeId: createdOutcome.id,
              coretaxReference: input.coretaxReference || null,
              accountHint: input.accountHint || null,
              notes: input.notes || null,
            } as Prisma.InputJsonValue,
          })),
        });

        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: `XML_OUTCOME_${input.outcome}`,
            targetId: batch.id,
          },
        });

        return {
          outcome: {
            id: createdOutcome.id,
            outcome: createdOutcome.outcome,
            coretaxReference: createdOutcome.coretaxReference,
            accountHint: createdOutcome.accountHint,
            portalTimestamp:
              createdOutcome.portalTimestamp?.toISOString() ?? null,
            evidenceSha256: createdOutcome.evidenceSha256,
            notes: createdOutcome.notes,
            recordedAt: createdOutcome.recordedAt.toISOString(),
          },
        };
      },
    );
  }

  return {
    listAdminTemplates,
    mutateAdminTemplate,
    listWorkspaceExports,
    generateExport,
    downloadExport,
    recordOutcome,
  };
}
