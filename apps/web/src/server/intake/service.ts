import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  AMOUNT_SCALE,
  QUANTITY_SCALE,
  canonicalFixed,
  lineAmount,
  sumAmounts,
} from "../../lib/intake/decimal";
import {
  normalizeInvoiceNumber,
  normalizeName,
  validateIdentity,
  validateNitku,
} from "../../lib/intake/identity";
import {
  companyCommandSchema,
  counterpartyCommandSchema,
  counterpartyQuerySchema,
  draftInputSchema,
  transactionCommandSchema,
  transactionQuerySchema,
  transactionUpdateSchema,
  type DraftInput,
  type FieldIssue,
} from "../../lib/intake/schemas";
import { allows, type TransactionStatus } from "../../lib/intake/state";
import { jakartaDate } from "../trial/state";
import { trialService } from "../trial/service";
import { AccessError } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import type { TaxCrypto } from "./crypto";
import { inspectDocument, MAX_DOCUMENTS_PER_TRANSACTION } from "./documents";
import type { DocumentStorage } from "./storage";

type Tx = Prisma.TransactionClient;

export type DuplicateWarning = {
  id: string;
  invoiceNumber: string;
  documentDate: string;
  totalAmount: string;
  counterpartyName: string;
  status: TransactionStatus;
  exactAmount: boolean;
};

export class IntakeError extends Error {
  constructor(
    public code:
      | "VALIDATION_FAILED"
      | "DUPLICATE_COMPANY_NITKU"
      | "DUPLICATE_COUNTERPARTY_IDENTITY"
      | "DUPLICATE_WARNING"
      | "DUPLICATE_DOCUMENT"
      | "DOCUMENT_LIMIT"
      | "NOT_FOUND"
      | "INVALID_STATE"
      | "STALE_VERSION"
      | "IN_USE",
    public details: {
      issues?: FieldIssue[];
      duplicates?: DuplicateWarning[];
      existingName?: string;
    } = {},
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

function addJakartaDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

type NormalizedDraft = {
  companyId: string;
  counterpartyId: string;
  taxFamily: DraftInput["taxFamily"];
  documentType: DraftInput["documentType"];
  invoiceNumber: string;
  invoiceNumberNormalized: string;
  documentDate: string;
  taxPeriod: string;
  currency: "IDR";
  description: string | null;
  totalAmount: string;
  lines: {
    position: number;
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }[];
};

function normalizeDraft(raw: DraftInput, todayJakarta?: string) {
  const parsed = draftInputSchema.safeParse(raw);
  if (!parsed.success) {
    const issues: FieldIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "draft",
      code: "INVALID",
    }));
    throw new IntakeError("VALIDATION_FAILED", { issues });
  }
  const draft = parsed.data;
  const issues: FieldIssue[] = [];
  if (draft.documentDate < "2000-01-01")
    issues.push({ path: "documentDate", code: "DATE_TOO_OLD" });
  if (todayJakarta && draft.documentDate > addJakartaDays(todayJakarta, 7))
    issues.push({ path: "documentDate", code: "FUTURE_DATE" });
  if (
    draft.taxFamily === "PPN_FAKTUR_KELUARAN" &&
    draft.documentType !== "SALES_INVOICE"
  )
    issues.push({ path: "documentType", code: "FAMILY_DOCUMENT_TYPE" });
  if (
    (draft.taxFamily === "PPH_UNIFIKASI_BPPU" ||
      draft.taxFamily === "PPH_UNIFIKASI_BPNR") &&
    draft.documentType !== "SUPPLIER_INVOICE"
  )
    issues.push({ path: "documentType", code: "FAMILY_DOCUMENT_TYPE" });

  const lines = draft.lines.map((line, index) => {
    const amount = lineAmount(line.quantity, line.unitPrice);
    if (!amount)
      issues.push({ path: `lines.${index}.unitPrice`, code: "LINE_PRECISION" });
    return {
      position: index + 1,
      description: line.description,
      quantity: canonicalFixed(line.quantity, QUANTITY_SCALE),
      unitPrice: canonicalFixed(line.unitPrice, AMOUNT_SCALE),
      amount: amount ?? "0.00",
    };
  });
  const totalAmount = issues.length
    ? null
    : sumAmounts(lines.map((line) => line.amount));
  if (!issues.length && !totalAmount)
    issues.push({ path: "lines", code: "TOTAL_TOO_LARGE" });
  if (issues.length) throw new IntakeError("VALIDATION_FAILED", { issues });

  const normalized: NormalizedDraft = {
    companyId: draft.companyId,
    counterpartyId: draft.counterpartyId,
    taxFamily: draft.taxFamily,
    documentType: draft.documentType,
    invoiceNumber: draft.invoiceNumber,
    invoiceNumberNormalized: normalizeInvoiceNumber(draft.invoiceNumber),
    documentDate: draft.documentDate,
    taxPeriod: draft.taxPeriod,
    currency: draft.currency,
    description: draft.description ?? null,
    totalAmount: totalAmount!,
    lines,
  };
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
  return { normalized, fingerprint };
}

async function checkDraftReferencesAndDuplicates(
  tx: Tx,
  organizationId: string,
  draft: NormalizedDraft,
  excludeTransactionId?: string,
) {
  const company = await tx.company.findFirst({
    where: { id: draft.companyId, organizationId },
  });
  const counterparty = await tx.counterparty.findFirst({
    where: { id: draft.counterpartyId, organizationId },
  });
  const issues: FieldIssue[] = [];
  if (!company) issues.push({ path: "companyId", code: "UNKNOWN_COMPANY" });
  else if (company.archivedAt && !excludeTransactionId)
    issues.push({ path: "companyId", code: "ARCHIVED_COMPANY" });
  if (!counterparty)
    issues.push({ path: "counterpartyId", code: "UNKNOWN_COUNTERPARTY" });
  else if (counterparty.archivedAt && !excludeTransactionId)
    issues.push({ path: "counterpartyId", code: "ARCHIVED_COUNTERPARTY" });
  else if (
    (draft.documentType === "SUPPLIER_INVOICE" &&
      counterparty.kind === "CUSTOMER") ||
    (draft.documentType === "SALES_INVOICE" && counterparty.kind === "VENDOR")
  )
    issues.push({ path: "counterpartyId", code: "COUNTERPARTY_KIND" });
  if (issues.length) throw new IntakeError("VALIDATION_FAILED", { issues });

  const date = new Date(`${draft.documentDate}T00:00:00.000Z`);
  const candidates = await tx.transaction.findMany({
    where: {
      organizationId,
      status: { not: "VOIDED" },
      ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
      OR: [
        {
          counterpartyId: draft.counterpartyId,
          invoiceNumberNormalized: draft.invoiceNumberNormalized,
        },
        {
          companyId: draft.companyId,
          counterpartyId: draft.counterpartyId,
          documentDate: date,
          totalAmount: draft.totalAmount,
        },
      ],
    },
    include: { counterparty: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const duplicates: DuplicateWarning[] = candidates.map((row) => ({
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    documentDate: row.documentDate.toISOString().slice(0, 10),
    totalAmount: row.totalAmount.toFixed(2),
    counterpartyName: row.counterparty.name,
    status: row.status,
    exactAmount: row.totalAmount.toFixed(2) === draft.totalAmount,
  }));
  return { duplicates };
}

export function intakeService(
  db: PrismaClient,
  crypto: TaxCrypto,
  storage: DocumentStorage,
) {
  const trials = trialService(db);

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

  async function listCompanies(sessionId: string) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const rows = await tx.company.findMany({
        where: { organizationId },
        orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
      });
      return {
        role: membership.role,
        companies: rows.map((row) => ({
          id: row.id,
          name: row.name,
          legalName: row.legalName,
          npwpHint: row.npwpHint,
          nitkuHint: row.nitkuHint,
          address: row.address,
          archivedAt: row.archivedAt?.toISOString() ?? null,
        })),
      };
    });
  }

  async function mutateCompany(sessionId: string, raw: unknown) {
    const command = companyCommandSchema.parse(raw);
    return withActive(
      sessionId,
      "team.manage",
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        if (command.action === "delete") {
          const existing = await tx.company.findFirst({
            where: { id: command.id, organizationId },
          });
          if (!existing) throw new IntakeError("NOT_FOUND");
          const [transactions, imports, exports] = await Promise.all([
            tx.transaction.count({
              where: { companyId: existing.id, organizationId },
            }),
            tx.importBatch.count({
              where: { companyId: existing.id, organizationId },
            }),
            tx.xmlExportBatch.count({
              where: { companyId: existing.id, organizationId },
            }),
          ]);
          if (transactions + imports + exports > 0)
            throw new IntakeError("IN_USE");
          await tx.company.delete({ where: { id: existing.id } });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "COMPANY_DELETED",
              targetId: existing.id,
            },
          });
          return { id: existing.id };
        }
        if (command.action === "archive") {
          const existing = await tx.company.findFirst({
            where: { id: command.id, organizationId },
          });
          if (!existing) throw new IntakeError("NOT_FOUND");
          await tx.company.update({
            where: { id: existing.id },
            data: { archivedAt: existing.archivedAt ? null : new Date() },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: existing.archivedAt
                ? "COMPANY_RESTORED"
                : "COMPANY_ARCHIVED",
              targetId: existing.id,
            },
          });
          return { id: existing.id };
        }
        const issues: FieldIssue[] = [];
        const npwp = command.company.npwp
          ? validateIdentity("NPWP", command.company.npwp)
          : undefined;
        if (command.company.npwp && !npwp)
          issues.push({ path: "npwp", code: "INVALID_NPWP" });
        const nitku = command.company.nitku
          ? validateNitku(command.company.nitku)
          : undefined;
        if (command.company.nitku && !nitku)
          issues.push({ path: "nitku", code: "INVALID_NITKU" });
        if (issues.length)
          throw new IntakeError("VALIDATION_FAILED", { issues });

        const npwpProtected = npwp
          ? crypto.protect(organizationId, "COMPANY_NPWP", npwp)
          : undefined;
        const nitkuProtected = nitku
          ? crypto.protect(organizationId, "COMPANY_NITKU", nitku)
          : undefined;

        if (nitkuProtected) {
          const duplicate = await tx.company.findFirst({
            where: {
              organizationId,
              nitkuIndex: nitkuProtected.index,
              ...(command.action === "update"
                ? { id: { not: command.id } }
                : {}),
            },
          });
          if (duplicate)
            throw new IntakeError("DUPLICATE_COMPANY_NITKU", {
              existingName: duplicate.name,
            });
        }
        if (command.action === "create") {
          const created = await tx.company.create({
            data: {
              organizationId,
              name: command.company.name,
              legalName: command.company.legalName,
              address: command.company.address ?? null,
              npwpCipher: npwpProtected?.cipher ?? null,
              npwpIndex: npwpProtected?.index ?? null,
              npwpHint: npwpProtected?.hint ?? null,
              nitkuCipher: nitkuProtected?.cipher ?? null,
              nitkuIndex: nitkuProtected?.index ?? null,
              nitkuHint: nitkuProtected?.hint ?? null,
              createdBy: session.userId,
            },
          });
          await tx.workspaceAudit.create({
            data: {
              organizationId,
              actorId: session.userId,
              action: "COMPANY_CREATED",
              targetId: created.id,
            },
          });
          return { id: created.id };
        }
        const existing = await tx.company.findFirst({
          where: { id: command.id, organizationId },
        });
        if (!existing) throw new IntakeError("NOT_FOUND");
        await tx.company.update({
          where: { id: existing.id },
          data: {
            name: command.company.name,
            legalName: command.company.legalName,
            address: command.company.address ?? null,
            ...(command.clearNpwp
              ? { npwpCipher: null, npwpIndex: null, npwpHint: null }
              : npwpProtected
                ? {
                    npwpCipher: npwpProtected.cipher,
                    npwpIndex: npwpProtected.index,
                    npwpHint: npwpProtected.hint,
                  }
                : {}),
            ...(command.clearNitku
              ? { nitkuCipher: null, nitkuIndex: null, nitkuHint: null }
              : nitkuProtected
                ? {
                    nitkuCipher: nitkuProtected.cipher,
                    nitkuIndex: nitkuProtected.index,
                    nitkuHint: nitkuProtected.hint,
                  }
                : {}),
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "COMPANY_UPDATED",
            targetId: existing.id,
          },
        });
        return { id: existing.id };
      },
    );
  }

  async function listCounterparties(sessionId: string, rawQuery: unknown = {}) {
    const query = counterpartyQuerySchema.parse(rawQuery);
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const where: Prisma.CounterpartyWhereInput = {
        organizationId,
        ...(query.id ? { id: query.id } : {}),
        ...(query.q
          ? { nameNormalized: { contains: normalizeName(query.q) } }
          : {}),
        ...(query.id || query.archived === "include"
          ? {}
          : query.archived === "only"
            ? { archivedAt: { not: null } }
            : { archivedAt: null }),
      };
      const total = await tx.counterparty.count({ where });
      const rows = await tx.counterparty.findMany({
        where,
        orderBy: { nameNormalized: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { _count: { select: { transactions: true } } },
      });
      return {
        role: membership.role,
        total,
        page: query.page,
        counterparties: rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          name: row.name,
          identityType: row.identityType,
          identityHint: row.identityHint,
          countryCode: row.countryCode,
          address: row.address,
          archivedAt: row.archivedAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          transactionCount: row._count.transactions,
        })),
      };
    });
  }

  async function mutateCounterparty(sessionId: string, raw: unknown) {
    const command = counterpartyCommandSchema.parse(raw);
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    return db.$transaction(async (tx) => {
      await lockWorkspace(tx, organizationId);
      const { session, membership } = await requireMembership(
        tx,
        sessionId,
        organizationId,
      );
      if (session.activeOrganizationId !== organizationId)
        throw new AccessError("CONFLICT");
      if (!["OWNER", "ADMIN", "PREPARER"].includes(membership.role))
        throw new AccessError("FORBIDDEN");

      if (command.action === "archive" || command.action === "delete") {
        const existing = await tx.counterparty.findFirst({
          where: { id: command.id, organizationId },
        });
        if (!existing) throw new IntakeError("NOT_FOUND");
        if (command.action === "delete") {
          const used = await tx.transaction.count({
            where: { counterpartyId: existing.id, organizationId },
          });
          if (used > 0) throw new IntakeError("IN_USE");
          await tx.counterparty.delete({ where: { id: existing.id } });
        } else {
          await tx.counterparty.update({
            where: { id: existing.id },
            data: { archivedAt: existing.archivedAt ? null : new Date() },
          });
        }
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action:
              command.action === "delete"
                ? "COUNTERPARTY_DELETED"
                : existing.archivedAt
                  ? "COUNTERPARTY_RESTORED"
                  : "COUNTERPARTY_ARCHIVED",
            targetId: existing.id,
          },
        });
        return { id: existing.id, duplicateNames: [] as string[] };
      }

      const data = command.counterparty;
      const issues: FieldIssue[] = [];
      let normalizedIdentity: string | null = null;
      if (data.identityType === "NONE") {
        if (data.identity)
          issues.push({ path: "identity", code: "IDENTITY_NOT_ALLOWED" });
      } else if (data.identity) {
        normalizedIdentity = validateIdentity(data.identityType, data.identity);
        if (!normalizedIdentity) {
          issues.push({
            path: "identity",
            code:
              data.identityType === "NPWP"
                ? "INVALID_NPWP"
                : data.identityType === "NIK"
                  ? "INVALID_NIK"
                  : "INVALID_FOREIGN_TIN",
          });
        }
      } else if (command.action === "create") {
        issues.push({ path: "identity", code: "REQUIRED" });
      }
      if (issues.length) throw new IntakeError("VALIDATION_FAILED", { issues });

      const protectedIdentity = normalizedIdentity
        ? crypto.protect(
            organizationId,
            `COUNTERPARTY_${data.identityType}`,
            normalizedIdentity,
          )
        : undefined;
      if (protectedIdentity) {
        const duplicate = await tx.counterparty.findFirst({
          where: {
            organizationId,
            identityType: data.identityType,
            identityIndex: protectedIdentity.index,
            ...(command.action === "update" ? { id: { not: command.id } } : {}),
          },
        });
        if (duplicate)
          throw new IntakeError("DUPLICATE_COUNTERPARTY_IDENTITY", {
            existingName: duplicate.name,
          });
      }
      const nameNormalized = normalizeName(data.name);
      const duplicateNames = await tx.counterparty.findMany({
        where: {
          organizationId,
          nameNormalized,
          ...(command.action === "update" ? { id: { not: command.id } } : {}),
        },
        select: { id: true, name: true },
        take: 5,
      });

      if (command.action === "create") {
        const created = await tx.counterparty.create({
          data: {
            organizationId,
            kind: data.kind,
            name: data.name,
            nameNormalized,
            identityType: data.identityType,
            identityCipher: protectedIdentity?.cipher ?? null,
            identityIndex: protectedIdentity?.index ?? null,
            identityHint: protectedIdentity?.hint ?? null,
            countryCode: data.countryCode,
            address: data.address ?? null,
            createdBy: session.userId,
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "COUNTERPARTY_CREATED",
            targetId: created.id,
          },
        });
        return { id: created.id, duplicateNames };
      }
      const existing = await tx.counterparty.findFirst({
        where: { id: command.id, organizationId },
      });
      if (!existing) throw new IntakeError("NOT_FOUND");
      if (data.identityType !== "NONE" && !protectedIdentity) {
        if (
          existing.identityType !== data.identityType ||
          !existing.identityCipher
        )
          throw new IntakeError("VALIDATION_FAILED", {
            issues: [{ path: "identity", code: "REQUIRED" }],
          });
      }
      await tx.counterparty.update({
        where: { id: existing.id },
        data: {
          kind: data.kind,
          name: data.name,
          nameNormalized,
          identityType: data.identityType,
          countryCode: data.countryCode,
          address: data.address ?? null,
          ...(data.identityType === "NONE"
            ? {
                identityCipher: null,
                identityIndex: null,
                identityHint: null,
              }
            : protectedIdentity
              ? {
                  identityCipher: protectedIdentity.cipher,
                  identityIndex: protectedIdentity.index,
                  identityHint: protectedIdentity.hint,
                }
              : {}),
        },
      });
      await tx.workspaceAudit.create({
        data: {
          organizationId,
          actorId: session.userId,
          action: "COUNTERPARTY_UPDATED",
          targetId: existing.id,
        },
      });
      return { id: existing.id, duplicateNames };
    });
  }

  async function checkDraft(
    sessionId: string,
    rawDraft: DraftInput,
    excludeTransactionId?: string,
  ) {
    return withActive(
      sessionId,
      "draft.prepare",
      async (tx, { membership }) => {
        const today = jakartaDate(await databaseNow(tx));
        const { normalized } = normalizeDraft(rawDraft, today);
        const { duplicates } = await checkDraftReferencesAndDuplicates(
          tx,
          membership.organizationId,
          normalized,
          excludeTransactionId,
        );
        return {
          totalAmount: normalized.totalAmount,
          lines: normalized.lines,
          duplicates,
        };
      },
    );
  }

  /**
   * Manual draft creation. Delegates exclusively to Batch 02's trialService.create,
   * so the organization lock, account lock, role check, quota receipt, draft rows
   * and audit records commit or roll back in a single database transaction.
   * Invalid drafts and unacknowledged duplicates throw inside the callback,
   * rolling back the transaction before any trial receipt is written.
   */
  async function createTransaction(sessionId: string, raw: unknown) {
    const command = transactionCommandSchema.parse(raw);
    if (command.action === "check") return checkDraft(sessionId, command.draft);

    // Pre-parse shape and precision before acquiring locks; date bounds are
    // checked against the database clock inside the persistence callback.
    const preliminary = normalizeDraft(command.draft, undefined);
    return trials.create(
      sessionId,
      {
        idempotencyKey: command.idempotencyKey,
        payloadFingerprint: preliminary.fingerprint,
      },
      async (tx, context) => {
        const { normalized } = normalizeDraft(
          command.draft,
          jakartaDate(context.createdAt),
        );
        const { duplicates } = await checkDraftReferencesAndDuplicates(
          tx,
          context.organizationId,
          normalized,
        );
        if (duplicates.length > 0 && !command.acknowledgeDuplicates)
          throw new IntakeError("DUPLICATE_WARNING", { duplicates });

        const created = await tx.transaction.create({
          data: {
            organizationId: context.organizationId,
            companyId: normalized.companyId,
            counterpartyId: normalized.counterpartyId,
            taxFamily: normalized.taxFamily,
            documentType: normalized.documentType,
            source: "MANUAL",
            status: "DRAFT",
            invoiceNumber: normalized.invoiceNumber,
            invoiceNumberNormalized: normalized.invoiceNumberNormalized,
            documentDate: new Date(`${normalized.documentDate}T00:00:00.000Z`),
            taxPeriod: normalized.taxPeriod,
            currency: normalized.currency,
            description: normalized.description,
            totalAmount: normalized.totalAmount,
            createdBy: context.userId,
            createdAt: context.createdAt,
            lines: {
              create: normalized.lines.map((line) => ({
                position: line.position,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                amount: line.amount,
              })),
            },
            events: {
              create: {
                actorId: context.userId,
                action: "DRAFT_CREATED",
                changes: {
                  invoiceNumber: normalized.invoiceNumber,
                  totalAmount: normalized.totalAmount,
                  taxFamily: normalized.taxFamily,
                  acknowledgedDuplicates: duplicates.map((item) => item.id),
                },
                createdAt: context.createdAt,
              },
            },
          },
        });
        return { id: created.id };
      },
    );
  }

  async function listTransactions(sessionId: string, rawQuery: unknown = {}) {
    const query = transactionQuerySchema.parse(rawQuery);
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const q = query.q?.trim();
      const where: Prisma.TransactionWhereInput = {
        organizationId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.taxFamily ? { taxFamily: query.taxFamily } : {}),
        ...(query.statuses.length || query.excludeStatuses.length
          ? {
              AND: [
                ...(query.statuses.length
                  ? [{ status: { in: query.statuses } }]
                  : []),
                ...(query.excludeStatuses.length
                  ? [{ status: { notIn: query.excludeStatuses } }]
                  : []),
              ],
            }
          : {}),
        ...(query.families.length ? { taxFamily: { in: query.families } } : {}),
        ...(query.sources.length ? { source: { in: query.sources } } : {}),
        ...(query.companyIds.length
          ? { companyId: { in: query.companyIds } }
          : {}),
        ...(query.counterpartyIds.length
          ? { counterpartyId: { in: query.counterpartyIds } }
          : {}),
        ...(query.taxPeriod ? { taxPeriod: query.taxPeriod } : {}),
        ...(query.taxPeriods.length
          ? { taxPeriod: { in: query.taxPeriods } }
          : {}),
        ...(query.dateFrom || query.dateTo
          ? {
              documentDate: {
                ...(query.dateFrom
                  ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
                  : {}),
                ...(query.dateTo
                  ? { lte: new Date(`${query.dateTo}T00:00:00.000Z`) }
                  : {}),
              },
            }
          : {}),
        ...(query.invoice
          ? {
              invoiceNumberNormalized: {
                contains: normalizeInvoiceNumber(query.invoice),
              },
            }
          : {}),
        ...(query.counterparty
          ? {
              counterparty: {
                nameNormalized: { contains: normalizeName(query.counterparty) },
              },
            }
          : {}),
        ...(q
          ? {
              OR: [
                {
                  invoiceNumberNormalized: {
                    contains: normalizeInvoiceNumber(q),
                  },
                },
                {
                  counterparty: {
                    nameNormalized: { contains: normalizeName(q) },
                  },
                },
              ],
            }
          : {}),
      };
      const [sortField, sortDir]: [string, "asc" | "desc"] =
        query.sort.includes(":")
          ? (query.sort.split(":") as [string, "asc" | "desc"])
          : query.sort === "date_asc"
            ? ["date", "asc"]
            : query.sort === "date_desc"
              ? ["date", "desc"]
              : ["created", "desc"];
      const orderBy: Prisma.TransactionOrderByWithRelationInput[] = [
        sortField === "date"
          ? { documentDate: sortDir }
          : sortField === "invoice"
            ? { invoiceNumberNormalized: sortDir }
            : sortField === "amount"
              ? { totalAmount: sortDir }
              : sortField === "status"
                ? { status: sortDir }
                : sortField === "period"
                  ? { taxPeriod: sortDir }
                  : { createdAt: sortDir },
        { createdAt: "desc" },
      ];
      const total = await tx.transaction.count({ where });
      const rows = await tx.transaction.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          counterparty: {
            select: { id: true, name: true, identityHint: true },
          },
          _count: { select: { documents: true, lines: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      });
      const duplicateSet = new Set<string>();
      for (const row of rows) {
        if (row.status === "VOIDED") continue;
        const match = await tx.transaction.findFirst({
          where: {
            organizationId,
            id: { not: row.id },
            status: { not: "VOIDED" },
            OR: [
              {
                counterpartyId: row.counterpartyId,
                invoiceNumberNormalized: row.invoiceNumberNormalized,
              },
              {
                companyId: row.companyId,
                counterpartyId: row.counterpartyId,
                documentDate: row.documentDate,
                totalAmount: row.totalAmount,
              },
            ],
          },
          select: { id: true },
        });
        if (match) duplicateSet.add(row.id);
      }
      return {
        role: membership.role,
        total,
        page: query.page,
        pageSize: query.pageSize,
        transactions: rows.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          documentDate: row.documentDate.toISOString().slice(0, 10),
          taxPeriod: row.taxPeriod,
          taxFamily: row.taxFamily,
          documentType: row.documentType,
          source: row.source,
          status: row.status,
          currency: row.currency,
          totalAmount: row.totalAmount.toFixed(2),
          company: row.company,
          counterparty: row.counterparty,
          documentCount: row._count.documents,
          lineCount: row._count.lines,
          hasDuplicate: duplicateSet.has(row.id),
          version: row.version,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    });
  }

  async function getTransaction(sessionId: string, transactionId: string) {
    return withActive(sessionId, undefined, async (tx, { membership }) => {
      const organizationId = membership.organizationId;
      const row = await tx.transaction.findFirst({
        where: { id: transactionId, organizationId },
        include: {
          company: true,
          counterparty: true,
          lines: { orderBy: { position: "asc" } },
          documents: { orderBy: { createdAt: "asc" } },
          comments: { orderBy: { createdAt: "asc" } },
          events: { orderBy: { createdAt: "desc" }, take: 100 },
        },
      });
      if (!row) throw new IntakeError("NOT_FOUND");
      const actorIds = [
        ...new Set([
          row.createdBy,
          ...row.comments.map((comment) => comment.authorId),
          ...row.events.map((event) => event.actorId),
        ]),
      ];
      const users = await tx.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true },
      });
      const userMap = new Map(users.map((user) => [user.id, user]));
      const duplicates =
        row.status === "VOIDED"
          ? []
          : (
              await checkDraftReferencesAndDuplicates(
                tx,
                organizationId,
                {
                  companyId: row.companyId,
                  counterpartyId: row.counterpartyId,
                  taxFamily: row.taxFamily as NormalizedDraft["taxFamily"],
                  documentType: row.documentType,
                  invoiceNumber: row.invoiceNumber,
                  invoiceNumberNormalized: row.invoiceNumberNormalized,
                  documentDate: row.documentDate.toISOString().slice(0, 10),
                  taxPeriod: row.taxPeriod,
                  currency: "IDR",
                  description: row.description,
                  totalAmount: row.totalAmount.toFixed(2),
                  lines: [],
                },
                row.id,
              )
            ).duplicates;
      return {
        role: membership.role,
        transaction: {
          id: row.id,
          version: row.version,
          companyId: row.companyId,
          counterpartyId: row.counterpartyId,
          company: {
            id: row.company.id,
            name: row.company.name,
            legalName: row.company.legalName,
            npwpHint: row.company.npwpHint,
            nitkuHint: row.company.nitkuHint,
          },
          counterparty: {
            id: row.counterparty.id,
            name: row.counterparty.name,
            kind: row.counterparty.kind,
            identityType: row.counterparty.identityType,
            identityHint: row.counterparty.identityHint,
            countryCode: row.counterparty.countryCode,
          },
          taxFamily: row.taxFamily,
          documentType: row.documentType,
          source: row.source,
          status: row.status,
          invoiceNumber: row.invoiceNumber,
          documentDate: row.documentDate.toISOString().slice(0, 10),
          taxPeriod: row.taxPeriod,
          currency: row.currency,
          description: row.description,
          totalAmount: row.totalAmount.toFixed(2),
          voidedAt: row.voidedAt?.toISOString() ?? null,
          voidReason: row.voidReason,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          lines: row.lines.map((line) => ({
            id: line.id,
            position: line.position,
            description: line.description,
            quantity: line.quantity.toFixed(4),
            unitPrice: line.unitPrice.toFixed(2),
            amount: line.amount.toFixed(2),
          })),
          documents: row.documents.map((doc) => ({
            id: doc.id,
            originalName: doc.originalName,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes,
            sha256: doc.sha256,
            scanStatus: doc.scanStatus,
            createdAt: doc.createdAt.toISOString(),
          })),
          comments: row.comments.map((comment) => ({
            id: comment.id,
            body: comment.body,
            authorName:
              userMap.get(comment.authorId)?.name ??
              userMap.get(comment.authorId)?.email ??
              comment.authorId,
            createdAt: comment.createdAt.toISOString(),
          })),
          events: row.events.map((event) => ({
            id: event.id,
            action: event.action,
            actorName:
              userMap.get(event.actorId)?.name ??
              userMap.get(event.actorId)?.email ??
              event.actorId,
            changes: event.changes,
            createdAt: event.createdAt.toISOString(),
          })),
          duplicates,
        },
      };
    });
  }

  /**
   * Updates, voids or comments on an existing transaction. Does NOT touch
   * TrialUsage: editing decreases no quota and voiding never refunds quota.
   */
  async function mutateTransaction(
    sessionId: string,
    transactionId: string,
    raw: unknown,
  ) {
    const command = transactionUpdateSchema.parse(raw);
    const permission =
      command.action === "comment" ? undefined : "draft.prepare";
    return withActive(
      sessionId,
      permission,
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const existing = await tx.transaction.findFirst({
          where: { id: transactionId, organizationId },
        });
        if (!existing) throw new IntakeError("NOT_FOUND");

        if (command.action === "comment") {
          if (!allows(existing.status, "comment"))
            throw new IntakeError("INVALID_STATE");
          const comment = await tx.transactionComment.create({
            data: {
              organizationId,
              transactionId: existing.id,
              authorId: session.userId,
              body: command.body,
            },
          });
          await tx.transactionEvent.create({
            data: {
              organizationId,
              transactionId: existing.id,
              actorId: session.userId,
              action: "COMMENT_ADDED",
              changes: { commentId: comment.id },
            },
          });
          return { id: existing.id, version: existing.version };
        }

        if (existing.version !== command.version)
          throw new IntakeError("STALE_VERSION");

        if (command.action === "void") {
          if (!allows(existing.status, "void"))
            throw new IntakeError("INVALID_STATE");
          const now = await databaseNow(tx);
          const updated = await tx.transaction.updateMany({
            where: {
              id: existing.id,
              organizationId,
              version: command.version,
            },
            data: {
              status: "VOIDED",
              voidedAt: now,
              voidReason: command.reason,
              version: { increment: 1 },
            },
          });
          if (updated.count !== 1) throw new IntakeError("STALE_VERSION");
          await tx.transactionEvent.create({
            data: {
              organizationId,
              transactionId: existing.id,
              actorId: session.userId,
              action: "DRAFT_VOIDED",
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
              action: "TRANSACTION_VOIDED",
              targetId: existing.id,
            },
          });
          return { id: existing.id, version: existing.version + 1 };
        }

        if (!allows(existing.status, "edit"))
          throw new IntakeError("INVALID_STATE");
        const now = await databaseNow(tx);
        const { normalized } = normalizeDraft(command.draft, jakartaDate(now));
        const { duplicates } = await checkDraftReferencesAndDuplicates(
          tx,
          organizationId,
          normalized,
          existing.id,
        );
        if (duplicates.length > 0 && !command.acknowledgeDuplicates)
          throw new IntakeError("DUPLICATE_WARNING", { duplicates });

        const updated = await tx.transaction.updateMany({
          where: { id: existing.id, organizationId, version: command.version },
          data: {
            companyId: normalized.companyId,
            counterpartyId: normalized.counterpartyId,
            taxFamily: normalized.taxFamily,
            documentType: normalized.documentType,
            invoiceNumber: normalized.invoiceNumber,
            invoiceNumberNormalized: normalized.invoiceNumberNormalized,
            documentDate: new Date(`${normalized.documentDate}T00:00:00.000Z`),
            taxPeriod: normalized.taxPeriod,
            description: normalized.description,
            totalAmount: normalized.totalAmount,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) throw new IntakeError("STALE_VERSION");
        await tx.transactionLine.deleteMany({
          where: { transactionId: existing.id, organizationId },
        });
        await tx.transactionLine.createMany({
          data: normalized.lines.map((line) => ({
            transactionId: existing.id,
            organizationId,
            position: line.position,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            amount: line.amount,
          })),
        });
        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId: existing.id,
            actorId: session.userId,
            action: "DRAFT_UPDATED",
            changes: {
              before: {
                invoiceNumber: existing.invoiceNumber,
                documentDate: existing.documentDate.toISOString().slice(0, 10),
                taxPeriod: existing.taxPeriod,
                taxFamily: existing.taxFamily,
                totalAmount: existing.totalAmount.toFixed(2),
              },
              after: {
                invoiceNumber: normalized.invoiceNumber,
                documentDate: normalized.documentDate,
                taxPeriod: normalized.taxPeriod,
                taxFamily: normalized.taxFamily,
                totalAmount: normalized.totalAmount,
              },
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "TRANSACTION_UPDATED",
            targetId: existing.id,
          },
        });
        return { id: existing.id, version: existing.version + 1 };
      },
    );
  }

  async function attachDocument(
    sessionId: string,
    transactionId: string,
    file: { bytes: Uint8Array; declaredType: string; fileName: string },
  ) {
    const inspected = inspectDocument(file);
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;
    const storageKey = await storage.put(organizationId, file.bytes);
    try {
      return await db.$transaction(async (tx) => {
        await lockWorkspace(tx, organizationId);
        const { session } = await requireMembership(
          tx,
          sessionId,
          organizationId,
          "draft.prepare",
        );
        if (session.activeOrganizationId !== organizationId)
          throw new AccessError("CONFLICT");
        const transaction = await tx.transaction.findFirst({
          where: { id: transactionId, organizationId },
        });
        if (!transaction) throw new IntakeError("NOT_FOUND");
        if (!allows(transaction.status, "attach"))
          throw new IntakeError("INVALID_STATE");
        const count = await tx.sourceDocument.count({
          where: { transactionId: transaction.id, organizationId },
        });
        if (count >= MAX_DOCUMENTS_PER_TRANSACTION)
          throw new IntakeError("DOCUMENT_LIMIT");
        const duplicate = await tx.sourceDocument.findFirst({
          where: {
            transactionId: transaction.id,
            organizationId,
            sha256: inspected.sha256,
          },
        });
        if (duplicate) throw new IntakeError("DUPLICATE_DOCUMENT");
        const doc = await tx.sourceDocument.create({
          data: {
            organizationId,
            transactionId: transaction.id,
            storageKey,
            sha256: inspected.sha256,
            sizeBytes: inspected.sizeBytes,
            mimeType: inspected.mimeType,
            originalName: inspected.name,
            uploadedBy: session.userId,
          },
        });
        await tx.transactionEvent.create({
          data: {
            organizationId,
            transactionId: transaction.id,
            actorId: session.userId,
            action: "DOCUMENT_ATTACHED",
            changes: {
              documentId: doc.id,
              originalName: doc.originalName,
              sha256: doc.sha256,
              sizeBytes: doc.sizeBytes,
            },
          },
        });
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "DOCUMENT_UPLOADED",
            targetId: doc.id,
          },
        });
        return {
          id: doc.id,
          originalName: doc.originalName,
          mimeType: doc.mimeType,
          sizeBytes: doc.sizeBytes,
          sha256: doc.sha256,
        };
      });
    } catch (error) {
      await storage.remove(organizationId, storageKey).catch(() => {});
      throw error;
    }
  }

  async function readDocument(
    sessionId: string,
    transactionId: string,
    documentId: string,
  ) {
    const doc = await withActive(
      sessionId,
      undefined,
      async (tx, { session, membership }) => {
        const organizationId = membership.organizationId;
        const found = await tx.sourceDocument.findFirst({
          where: { id: documentId, transactionId, organizationId },
        });
        if (!found) throw new IntakeError("NOT_FOUND");
        await tx.workspaceAudit.create({
          data: {
            organizationId,
            actorId: session.userId,
            action: "DOCUMENT_VIEWED",
            targetId: found.id,
          },
        });
        return found;
      },
    );
    const bytes = await storage.get(doc.organizationId, doc.storageKey);
    return {
      bytes,
      mimeType: doc.mimeType,
      originalName: doc.originalName,
      sha256: doc.sha256,
    };
  }

  return {
    listCompanies,
    mutateCompany,
    listCounterparties,
    mutateCounterparty,
    checkDraft,
    createTransaction,
    listTransactions,
    getTransaction,
    mutateTransaction,
    attachDocument,
    readDocument,
  };
}
