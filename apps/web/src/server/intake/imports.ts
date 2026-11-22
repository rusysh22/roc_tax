import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  AMOUNT_SCALE,
  QUANTITY_SCALE,
  amountPattern,
  canonicalFixed,
  lineAmount,
  quantityPattern,
} from "../../lib/intake/decimal";
import {
  normalizeInvoiceNumber,
  normalizeName,
  validateIdentity,
} from "../../lib/intake/identity";
import {
  blockedIntakeFamilies,
  documentTypes,
  intakeFamilies,
} from "../../lib/intake/schemas";
import {
  columnMappingSchema,
  guessColumnMapping,
  importColumns,
  isFormulaText,
  requiredImportColumns,
  type ImportColumn,
  type ImportRowIssue,
} from "../../lib/intake/spreadsheet";
import { jakartaDate, trialSnapshot } from "../trial/state";
import {
  entitledAllowance,
  trialService,
  TrialError,
  type CreationAllowance,
} from "../trial/service";
import { AccessError } from "../workspaces/policy";
import { requireActor, requireMembership } from "../workspaces/service";
import type { TaxCrypto } from "./crypto";
import { sanitizeFileName } from "./documents";
import {
  parseSpreadsheet,
  serializeCsv,
  type ParsedSheet,
} from "./spreadsheet";

type Tx = Prisma.TransactionClient;

export type EvaluatedImportRow = {
  rowNumber: number;
  status: "VALID" | "INVALID";
  invoiceNumber: string;
  documentDate: string;
  taxPeriod: string;
  documentType: (typeof documentTypes)[number] | "";
  taxFamily: (typeof intakeFamilies)[number] | "";
  counterpartyId: string | null;
  counterpartyName: string;
  description: string | null;
  lineDescription: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string | null;
  currency: string;
  issues: ImportRowIssue[];
  duplicates: {
    id: string;
    invoiceNumber: string;
    documentDate: string;
    totalAmount: string;
    exactAmount: boolean;
  }[];
  fingerprint: string | null;
};

export type ImportPreviewResult = {
  fileName: string;
  fileSha256: string;
  format: "CSV" | "XLSX";
  headers: string[];
  mapping: Partial<Record<ImportColumn, string>>;
  mappingComplete: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rows: EvaluatedImportRow[];
  trial: ReturnType<typeof trialSnapshot>;
  entitlement: CreationAllowance | null;
  eligibleToCommit: boolean;
  quotaBlockReason:
    | null
    | "NO_VALID_ROWS"
    | "DUPLICATE_CONFIRMATION_REQUIRED"
    | "NOT_ACTIVATED"
    | "EXPIRED"
    | "DAILY_LIMIT"
    | "TOTAL_LIMIT"
    | "TRIAL_SINGLE_ROW_LIMIT"
    | "MONTHLY_LIMIT"
    | "ENTITLEMENT_MISSING";
  errorReportCsv: string;
};

export class ImportBatchError extends Error {
  constructor(
    public code:
      | "MAPPING_INCOMPLETE"
      | "NO_VALID_ROWS"
      | "DUPLICATE_WARNING"
      | "TRIAL_SINGLE_ROW_LIMIT"
      | "IDEMPOTENCY_CONFLICT"
      | "UNKNOWN_COMPANY"
      | "ARCHIVED_COMPANY",
    public preview?: ImportPreviewResult,
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

function deriveChildUuid(batchKey: string, rowNumber: number): string {
  const digest = createHash("sha256")
    .update(`serentax-import-row:${batchKey}:${rowNumber}`)
    .digest();
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function buildErrorCsv(rows: readonly EvaluatedImportRow[]): string {
  const header = [
    "row_number",
    "status",
    "invoice_number",
    "counterparty_name",
    "issues",
    "duplicate_invoices",
  ];
  const lines = rows
    .filter((r) => r.status === "INVALID" || r.duplicates.length > 0)
    .map((r) => [
      String(r.rowNumber),
      r.status,
      r.invoiceNumber,
      r.counterpartyName,
      r.issues.map((i) => `${i.column}:${i.code}`).join("; "),
      r.duplicates
        .map((d) => `${d.invoiceNumber} (${d.documentDate})`)
        .join("; "),
    ]);
  return serializeCsv([header, ...lines]);
}

async function evaluateSheet(
  tx: Tx,
  organizationId: string,
  userId: string,
  companyId: string,
  fileName: string,
  sheet: ParsedSheet,
  explicitMapping: Partial<Record<ImportColumn, string>> | undefined,
  crypto: TaxCrypto,
): Promise<ImportPreviewResult> {
  const company = await tx.company.findFirst({
    where: { id: companyId, organizationId },
  });
  if (!company) throw new ImportBatchError("UNKNOWN_COMPANY");
  if (company.archivedAt) throw new ImportBatchError("ARCHIVED_COMPANY");

  const now = await databaseNow(tx);
  const todayJakarta = jakartaDate(now);
  const maxDate = addJakartaDays(todayJakarta, 7);
  const trialRow = await tx.trialAccount.findUnique({
    where: { userId },
    include: { usage: { select: { jakartaDate: true } } },
  });
  const trial = trialSnapshot(now, trialRow, trialRow?.usage ?? []);
  let entitlement: CreationAllowance | null = null;
  let entitlementError: "ENTITLEMENT_MISSING" | null = null;
  try {
    entitlement = await entitledAllowance(tx, organizationId, now);
  } catch (error) {
    if (!(error instanceof TrialError)) throw error;
    entitlementError = "ENTITLEMENT_MISSING";
  }

  const guessed = guessColumnMapping(sheet.headers);
  const merged: Partial<Record<ImportColumn, string>> = {
    ...guessed,
    ...(explicitMapping ?? {}),
  };
  for (const col of importColumns) {
    const chosen = merged[col];
    if (chosen && !sheet.headers.includes(chosen)) {
      delete merged[col];
    }
  }
  const parsedMapping = columnMappingSchema.safeParse(merged);
  const mappingComplete =
    parsedMapping.success &&
    requiredImportColumns.every((col) => Boolean(merged[col]));

  const counterparties = await tx.counterparty.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      nameNormalized: true,
      kind: true,
      identityType: true,
      identityIndex: true,
    },
  });
  const byName = new Map<string, typeof counterparties>();
  const byIdentity = new Map<string, (typeof counterparties)[number]>();
  for (const cp of counterparties) {
    const list = byName.get(cp.nameNormalized) ?? [];
    list.push(cp);
    byName.set(cp.nameNormalized, list);
    if (cp.identityIndex) {
      byIdentity.set(`${cp.identityType}:${cp.identityIndex}`, cp);
    }
  }

  const seenInFile = new Map<string, number>();
  const rows: EvaluatedImportRow[] = [];

  for (const rawRow of sheet.rows) {
    const issues: ImportRowIssue[] = [];
    const readCell = (col: ImportColumn): string => {
      const header = merged[col];
      if (!header) {
        if (requiredImportColumns.includes(col)) {
          issues.push({ column: col, code: "MISSING_COLUMN" });
        }
        return "";
      }
      const cell = rawRow.cells[header];
      if (!cell) return "";
      if (cell.hasFormula || isFormulaText(cell.value)) {
        issues.push({ column: col, code: "FORMULA_INJECTION" });
      }
      return cell.value;
    };

    const invoiceNumber = readCell("invoiceNumber");
    const documentDate = readCell("documentDate");
    const taxPeriod = readCell("taxPeriod");
    const documentTypeRaw = readCell("documentType").toUpperCase();
    const taxFamilyRaw = readCell("taxFamily").toUpperCase();
    const counterpartyName = readCell("counterpartyName");
    const counterpartyIdentity = readCell("counterpartyIdentity");
    const description = readCell("description");
    const lineDescription = readCell("lineDescription");
    const quantity = readCell("quantity");
    const unitPrice = readCell("unitPrice");
    const currency = readCell("currency").toUpperCase();

    if (merged.invoiceNumber && (!invoiceNumber || invoiceNumber.length > 64)) {
      issues.push({ column: "invoiceNumber", code: "INVALID_INVOICE_NUMBER" });
    }
    if (merged.documentDate) {
      if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(documentDate)) {
        issues.push({ column: "documentDate", code: "INVALID_DATE" });
      } else {
        const parsedDate = new Date(`${documentDate}T00:00:00.000Z`);
        if (
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== documentDate
        ) {
          issues.push({ column: "documentDate", code: "INVALID_DATE" });
        } else if (documentDate < "2000-01-01") {
          issues.push({ column: "documentDate", code: "DATE_TOO_OLD" });
        } else if (documentDate > maxDate) {
          issues.push({ column: "documentDate", code: "FUTURE_DATE" });
        }
      }
    }
    if (merged.taxPeriod && !/^\d{4}-(0[1-9]|1[0-2])$/.test(taxPeriod)) {
      issues.push({ column: "taxPeriod", code: "INVALID_PERIOD" });
    }

    const validDocType = (documentTypes as readonly string[]).includes(
      documentTypeRaw,
    )
      ? (documentTypeRaw as (typeof documentTypes)[number])
      : "";
    if (merged.documentType && !validDocType) {
      issues.push({ column: "documentType", code: "INVALID_DOCUMENT_TYPE" });
    }

    let validFamily: (typeof intakeFamilies)[number] | "" = "";
    if (merged.taxFamily) {
      if ((intakeFamilies as readonly string[]).includes(taxFamilyRaw)) {
        validFamily = taxFamilyRaw as (typeof intakeFamilies)[number];
      } else if (
        (blockedIntakeFamilies as readonly string[]).includes(taxFamilyRaw)
      ) {
        issues.push({ column: "taxFamily", code: "BLOCKED_TAX_FAMILY" });
      } else {
        issues.push({ column: "taxFamily", code: "INVALID_TAX_FAMILY" });
      }
    }

    if (validFamily && validDocType) {
      if (
        (validFamily === "PPN_FAKTUR_KELUARAN" &&
          validDocType !== "SALES_INVOICE") ||
        ((validFamily === "PPH_UNIFIKASI_BPPU" ||
          validFamily === "PPH_UNIFIKASI_BPNR") &&
          validDocType !== "SUPPLIER_INVOICE")
      ) {
        issues.push({ column: "documentType", code: "FAMILY_DOCUMENT_TYPE" });
      }
    }

    let matchedCounterparty: (typeof counterparties)[number] | undefined;
    if (counterpartyIdentity) {
      for (const kind of ["NPWP", "NIK", "FOREIGN_TIN"] as const) {
        const norm = validateIdentity(kind, counterpartyIdentity);
        if (norm) {
          const idx = crypto.index(
            organizationId,
            `COUNTERPARTY_${kind}`,
            norm,
          );
          const candidate = byIdentity.get(`${kind}:${idx}`);
          if (candidate) {
            matchedCounterparty = candidate;
            break;
          }
        }
      }
      if (!matchedCounterparty) {
        issues.push({
          column: "counterpartyIdentity",
          code: "UNKNOWN_COUNTERPARTY",
        });
      }
    } else if (merged.counterpartyName) {
      const candidates = byName.get(normalizeName(counterpartyName)) ?? [];
      if (candidates.length === 0) {
        issues.push({
          column: "counterpartyName",
          code: "UNKNOWN_COUNTERPARTY",
        });
      } else if (candidates.length > 1) {
        issues.push({
          column: "counterpartyName",
          code: "AMBIGUOUS_COUNTERPARTY",
        });
      } else {
        matchedCounterparty = candidates[0];
      }
    }

    if (matchedCounterparty && validDocType) {
      if (
        (validDocType === "SUPPLIER_INVOICE" &&
          matchedCounterparty.kind === "CUSTOMER") ||
        (validDocType === "SALES_INVOICE" &&
          matchedCounterparty.kind === "VENDOR")
      ) {
        issues.push({
          column: "counterpartyName",
          code: "COUNTERPARTY_KIND",
        });
      }
    }

    if (description.length > 1000) {
      issues.push({ column: "description", code: "INVALID_DESCRIPTION" });
    }
    if (
      merged.lineDescription &&
      (!lineDescription || lineDescription.length > 500)
    ) {
      issues.push({
        column: "lineDescription",
        code: "INVALID_LINE_DESCRIPTION",
      });
    }

    let computedTotal: string | null = null;
    const qtyOk =
      Boolean(merged.quantity) &&
      quantityPattern.test(quantity) &&
      Number(quantity) > 0;
    const priceOk = Boolean(merged.unitPrice) && amountPattern.test(unitPrice);
    if (merged.quantity && !qtyOk) {
      issues.push({ column: "quantity", code: "INVALID_QUANTITY" });
    }
    if (merged.unitPrice && !priceOk) {
      issues.push({ column: "unitPrice", code: "INVALID_UNIT_PRICE" });
    }
    if (qtyOk && priceOk) {
      computedTotal = lineAmount(quantity, unitPrice);
      if (!computedTotal) {
        issues.push({ column: "unitPrice", code: "LINE_PRECISION" });
      }
    }
    if (merged.currency && currency !== "IDR") {
      issues.push({ column: "currency", code: "INVALID_CURRENCY" });
    }

    if (matchedCounterparty && invoiceNumber) {
      const pairKey = `${matchedCounterparty.id}:${normalizeInvoiceNumber(invoiceNumber)}`;
      if (seenInFile.has(pairKey)) {
        issues.push({ column: "invoiceNumber", code: "DUPLICATE_IN_FILE" });
      } else {
        seenInFile.set(pairKey, rawRow.rowNumber);
      }
    }

    const duplicates: EvaluatedImportRow["duplicates"] = [];
    let fingerprint: string | null = null;

    if (
      issues.length === 0 &&
      matchedCounterparty &&
      validDocType &&
      validFamily &&
      computedTotal
    ) {
      const normalizedNumber = normalizeInvoiceNumber(invoiceNumber);
      const dateObj = new Date(`${documentDate}T00:00:00.000Z`);
      const existing = await tx.transaction.findMany({
        where: {
          organizationId,
          status: { not: "VOIDED" },
          OR: [
            {
              counterpartyId: matchedCounterparty.id,
              invoiceNumberNormalized: normalizedNumber,
            },
            {
              companyId,
              counterpartyId: matchedCounterparty.id,
              documentDate: dateObj,
              totalAmount: computedTotal,
            },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          documentDate: true,
          totalAmount: true,
        },
        take: 5,
      });
      for (const item of existing) {
        duplicates.push({
          id: item.id,
          invoiceNumber: item.invoiceNumber,
          documentDate: item.documentDate.toISOString().slice(0, 10),
          totalAmount: item.totalAmount.toFixed(2),
          exactAmount: item.totalAmount.toFixed(2) === computedTotal,
        });
      }
      const canonicalPayload = {
        companyId,
        counterpartyId: matchedCounterparty.id,
        taxFamily: validFamily,
        documentType: validDocType,
        invoiceNumber,
        invoiceNumberNormalized: normalizedNumber,
        documentDate,
        taxPeriod,
        currency: "IDR" as const,
        description: description || null,
        totalAmount: computedTotal,
        lines: [
          {
            position: 1,
            description: lineDescription,
            quantity: canonicalFixed(quantity, QUANTITY_SCALE),
            unitPrice: canonicalFixed(unitPrice, AMOUNT_SCALE),
            amount: computedTotal,
          },
        ],
      };
      fingerprint = createHash("sha256")
        .update(JSON.stringify(canonicalPayload))
        .digest("hex");
    }

    rows.push({
      rowNumber: rawRow.rowNumber,
      status: issues.length === 0 ? "VALID" : "INVALID",
      invoiceNumber,
      documentDate,
      taxPeriod,
      documentType: validDocType,
      taxFamily: validFamily,
      counterpartyId: matchedCounterparty?.id ?? null,
      counterpartyName: matchedCounterparty?.name ?? counterpartyName,
      description: description || null,
      lineDescription,
      quantity,
      unitPrice,
      totalAmount: computedTotal,
      currency,
      issues,
      duplicates,
      fingerprint,
    });
  }

  const validRows = rows.filter((r) => r.status === "VALID").length;
  const invalidRows = rows.length - validRows;
  const duplicateRows = rows.filter(
    (r) => r.status === "VALID" && r.duplicates.length > 0,
  ).length;

  let quotaBlockReason: ImportPreviewResult["quotaBlockReason"] = null;
  if (validRows === 0) quotaBlockReason = "NO_VALID_ROWS";
  else if (entitlementError) quotaBlockReason = entitlementError;
  else if (entitlement) {
    // Subscription: every valid row may be committed within the monthly cap.
    if (
      entitlement.remainingThisMonth !== null &&
      validRows > entitlement.remainingThisMonth
    )
      quotaBlockReason = "MONTHLY_LIMIT";
  } else if (trial.state !== "ACTIVE") quotaBlockReason = trial.state;
  else if (validRows > trial.remainingToday || validRows > 1)
    quotaBlockReason = "TRIAL_SINGLE_ROW_LIMIT";

  return {
    fileName,
    fileSha256: sheet.sha256,
    format: sheet.format,
    headers: sheet.headers,
    mapping: merged,
    mappingComplete,
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    rows,
    trial,
    entitlement,
    eligibleToCommit:
      mappingComplete &&
      quotaBlockReason === null &&
      (entitlement ? validRows >= 1 : validRows === 1),
    quotaBlockReason,
    errorReportCsv: buildErrorCsv(rows),
  };
}

export function importBatchService(db: PrismaClient, crypto: TaxCrypto) {
  const trials = trialService(db);

  async function preview(
    sessionId: string,
    input: {
      companyId: string;
      fileName: string;
      bytes: Uint8Array;
      mapping?: Partial<Record<ImportColumn, string>>;
    },
  ) {
    const cleanName = sanitizeFileName(input.fileName) ?? "import.csv";
    const sheet = parseSpreadsheet({ bytes: input.bytes, fileName: cleanName });
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;

    return db.$transaction(async (tx) => {
      await lockWorkspace(tx, organizationId);
      const { session } = await requireMembership(
        tx,
        sessionId,
        organizationId,
        "draft.prepare",
      );
      if (session.activeOrganizationId !== organizationId)
        throw new AccessError("CONFLICT");
      return evaluateSheet(
        tx,
        organizationId,
        session.userId,
        input.companyId,
        cleanName,
        sheet,
        input.mapping,
        crypto,
      );
    });
  }

  /**
   * Commits valid rows from a spreadsheet import.
   * - Idempotent per (organizationId, idempotencyKey) bound to the exact file hash,
   *   companyId and mapping.
   * - Trial workspaces: the account trial allows at most 1 new transaction per
   *   Jakarta calendar day, so any file with >1 valid row is rejected up front
   *   with TRIAL_SINGLE_ROW_LIMIT; no partial or hidden override ever occurs.
   * - Subscription workspaces (verified license): all valid rows commit
   *   atomically within the signed MONTHLY_TRANSACTIONS cap, or none do.
   * - Persists the rows and the ImportBatch record inside
   *   `trialService.createMany`'s single transaction callback.
   */
  async function commit(
    sessionId: string,
    input: {
      idempotencyKey: string;
      companyId: string;
      fileName: string;
      bytes: Uint8Array;
      mapping?: Partial<Record<ImportColumn, string>>;
      acknowledgeDuplicates: boolean;
    },
  ) {
    const cleanName = sanitizeFileName(input.fileName) ?? "import.csv";
    const sheet = parseSpreadsheet({ bytes: input.bytes, fileName: cleanName });
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;

    const evaluated = await db.$transaction(async (tx) => {
      await lockWorkspace(tx, organizationId);
      const { session } = await requireMembership(
        tx,
        sessionId,
        organizationId,
        "draft.prepare",
      );
      if (session.activeOrganizationId !== organizationId)
        throw new AccessError("CONFLICT");
      const result = await evaluateSheet(
        tx,
        organizationId,
        session.userId,
        input.companyId,
        cleanName,
        sheet,
        input.mapping,
        crypto,
      );
      const requestHash = createHash("sha256")
        .update(
          JSON.stringify([
            organizationId,
            input.companyId,
            sheet.sha256,
            result.mapping,
          ]),
        )
        .digest("hex");
      const existingBatch = await tx.importBatch.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      return { result, requestHash, existingBatch };
    });

    if (evaluated.existingBatch) {
      if (evaluated.existingBatch.requestHash !== evaluated.requestHash)
        throw new ImportBatchError("IDEMPOTENCY_CONFLICT");
      return {
        batchId: evaluated.existingBatch.id,
        transactionIds: evaluated.existingBatch.transactionIds as string[],
        createdCount: evaluated.existingBatch.createdCount,
        invalidRows: evaluated.existingBatch.invalidRows,
        replay: true,
      };
    }

    const { result, requestHash } = evaluated;
    if (!result.mappingComplete)
      throw new ImportBatchError("MAPPING_INCOMPLETE", result);

    const valid = result.rows.filter((r) => r.status === "VALID");
    if (valid.length === 0) throw new ImportBatchError("NO_VALID_ROWS", result);
    if (
      valid.some((r) => r.duplicates.length > 0) &&
      !input.acknowledgeDuplicates
    )
      throw new ImportBatchError("DUPLICATE_WARNING", result);
    // Trial workspaces may commit exactly one row; subscription workspaces may
    // commit every valid row (the monthly cap is enforced again under lock).
    if (valid.length > 1 && !result.entitlement)
      throw new ImportBatchError("TRIAL_SINGLE_ROW_LIMIT", result);

    let committedBatchId = "";

    const created = await trials.createMany(
      sessionId,
      valid.map((row) => ({
        idempotencyKey: deriveChildUuid(input.idempotencyKey, row.rowNumber),
        payloadFingerprint: row.fingerprint!,
      })),
      async (tx, context) => {
        const rechecked = await evaluateSheet(
          tx,
          context.organizationId,
          context.userId,
          input.companyId,
          cleanName,
          sheet,
          input.mapping,
          crypto,
        );
        const recheckedValid = rechecked.rows.filter(
          (r) => r.status === "VALID",
        );
        if (recheckedValid.length === 0)
          throw new ImportBatchError("NO_VALID_ROWS", rechecked);
        // The rows must be exactly those fingerprinted before the lock was taken.
        if (
          recheckedValid.length !== valid.length ||
          recheckedValid.some((r, i) => r.fingerprint !== valid[i].fingerprint)
        )
          throw new ImportBatchError("IDEMPOTENCY_CONFLICT", rechecked);
        if (recheckedValid.length > 1 && !rechecked.entitlement)
          throw new ImportBatchError("TRIAL_SINGLE_ROW_LIMIT", rechecked);
        if (
          recheckedValid.some((r) => r.duplicates.length > 0) &&
          !input.acknowledgeDuplicates
        )
          throw new ImportBatchError("DUPLICATE_WARNING", rechecked);

        const batchId = randomUUID();
        const txIds = recheckedValid.map(() => randomUUID());
        committedBatchId = batchId;

        await tx.importBatch.create({
          data: {
            id: batchId,
            organizationId: context.organizationId,
            companyId: input.companyId,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            fileName: cleanName,
            fileSha256: sheet.sha256,
            format: sheet.format,
            totalRows: rechecked.totalRows,
            validRows: rechecked.validRows,
            invalidRows: rechecked.invalidRows,
            duplicateRows: rechecked.duplicateRows,
            createdCount: txIds.length,
            transactionIds: txIds,
            rowSummary: rechecked.rows.map((r) => ({
              rowNumber: r.rowNumber,
              status: r.status,
              invoiceNumber: r.invoiceNumber,
              counterpartyName: r.counterpartyName,
              totalAmount: r.totalAmount,
              issues: r.issues,
              duplicates: r.duplicates.map((d) => d.invoiceNumber),
            })),
            createdBy: context.userId,
            createdAt: context.createdAt,
          },
        });

        for (const [index, target] of recheckedValid.entries()) {
          await tx.transaction.create({
            data: {
              id: txIds[index],
              organizationId: context.organizationId,
              companyId: input.companyId,
              counterpartyId: target.counterpartyId!,
              importBatchId: batchId,
              taxFamily: target.taxFamily as (typeof intakeFamilies)[number],
              documentType:
                target.documentType as (typeof documentTypes)[number],
              source: "SPREADSHEET",
              status: "DRAFT",
              invoiceNumber: target.invoiceNumber,
              invoiceNumberNormalized: normalizeInvoiceNumber(
                target.invoiceNumber,
              ),
              documentDate: new Date(`${target.documentDate}T00:00:00.000Z`),
              taxPeriod: target.taxPeriod,
              currency: "IDR",
              description: target.description,
              totalAmount: target.totalAmount!,
              createdBy: context.userId,
              createdAt: context.createdAt,
              lines: {
                create: [
                  {
                    position: 1,
                    description: target.lineDescription,
                    quantity: canonicalFixed(target.quantity, QUANTITY_SCALE),
                    unitPrice: canonicalFixed(target.unitPrice, AMOUNT_SCALE),
                    amount: target.totalAmount!,
                  },
                ],
              },
              events: {
                create: {
                  actorId: context.userId,
                  action: "DRAFT_IMPORTED",
                  changes: {
                    importBatchId: batchId,
                    fileName: cleanName,
                    fileSha256: sheet.sha256,
                    rowNumber: target.rowNumber,
                    invoiceNumber: target.invoiceNumber,
                    totalAmount: target.totalAmount,
                  },
                  createdAt: context.createdAt,
                },
              },
            },
          });
        }

        await tx.workspaceAudit.create({
          data: {
            organizationId: context.organizationId,
            actorId: context.userId,
            action: "IMPORT_BATCH_COMMITTED",
            targetId: batchId,
          },
        });

        return { ids: txIds };
      },
    );

    if (!committedBatchId) {
      const existing = await db.importBatch.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      committedBatchId = existing?.id ?? "";
    }

    return {
      batchId: committedBatchId,
      transactionIds: created.transactionIds,
      createdCount: created.transactionIds.length,
      invalidRows: result.invalidRows,
      replay: created.replay,
    };
  }

  /** Import history; with `batchId` returns that batch including row summary. */
  async function listBatches(sessionId: string, batchId?: string) {
    const initial = await requireActor(db, sessionId);
    if (!initial.activeOrganizationId) throw new AccessError("NO_WORKSPACE");
    const organizationId = initial.activeOrganizationId;

    return db.$transaction(async (tx) => {
      await lockWorkspace(tx, organizationId);
      const { membership } = await requireMembership(
        tx,
        sessionId,
        organizationId,
      );
      const batches = await tx.importBatch.findMany({
        where: { organizationId, ...(batchId ? { id: batchId } : {}) },
        orderBy: { createdAt: "desc" },
        take: batchId ? 1 : 200,
      });
      const creators = await tx.user.findMany({
        where: { id: { in: [...new Set(batches.map((b) => b.createdBy))] } },
        select: { id: true, name: true },
      });
      const creatorName = new Map(creators.map((u) => [u.id, u.name]));
      return {
        role: membership.role,
        batches: batches.map((b) => ({
          id: b.id,
          companyId: b.companyId,
          fileName: b.fileName,
          fileSha256: b.fileSha256,
          format: b.format,
          totalRows: b.totalRows,
          validRows: b.validRows,
          invalidRows: b.invalidRows,
          duplicateRows: b.duplicateRows,
          createdCount: b.createdCount,
          transactionIds: b.transactionIds as string[],
          createdAt: b.createdAt.toISOString(),
          createdBy: creatorName.get(b.createdBy) ?? null,
          ...(batchId ? { rowSummary: b.rowSummary } : {}),
        })),
      };
    });
  }

  return { preview, commit, listBatches };
}
