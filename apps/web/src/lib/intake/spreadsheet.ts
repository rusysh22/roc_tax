import { z } from "zod";
import { intakeFamilies } from "./schemas";

export const importColumns = [
  "invoiceNumber",
  "documentDate",
  "taxPeriod",
  "documentType",
  "taxFamily",
  "counterpartyName",
  "counterpartyIdentity",
  "description",
  "lineDescription",
  "quantity",
  "unitPrice",
  "currency",
] as const;
export type ImportColumn = (typeof importColumns)[number];

export const requiredImportColumns: readonly ImportColumn[] = [
  "invoiceNumber",
  "documentDate",
  "taxPeriod",
  "documentType",
  "taxFamily",
  "counterpartyName",
  "lineDescription",
  "quantity",
  "unitPrice",
  "currency",
];

/** Canonical template headers (row 1) for CSV and XLSX downloads. */
export const templateHeaders: Record<ImportColumn, string> = {
  invoiceNumber: "invoice_number",
  documentDate: "document_date",
  taxPeriod: "tax_period",
  documentType: "document_type",
  taxFamily: "tax_family",
  counterpartyName: "counterparty_name",
  counterpartyIdentity: "counterparty_tax_id",
  description: "description",
  lineDescription: "line_description",
  quantity: "quantity",
  unitPrice: "unit_price",
  currency: "currency",
};

const headerAliases: Record<string, ImportColumn> = {
  invoicenumber: "invoiceNumber",
  nomorinvoice: "invoiceNumber",
  documentdate: "documentDate",
  invoicedate: "documentDate",
  tanggaldokumen: "documentDate",
  taxperiod: "taxPeriod",
  masapajak: "taxPeriod",
  documenttype: "documentType",
  jenisdokumen: "documentType",
  taxfamily: "taxFamily",
  keluargadokumen: "taxFamily",
  counterpartyname: "counterpartyName",
  counterparty: "counterpartyName",
  lawantransaksi: "counterpartyName",
  counterpartytaxid: "counterpartyIdentity",
  counterpartyidentity: "counterpartyIdentity",
  npwplawan: "counterpartyIdentity",
  description: "description",
  keterangan: "description",
  linedescription: "lineDescription",
  uraianbaris: "lineDescription",
  quantity: "quantity",
  qty: "quantity",
  kuantitas: "quantity",
  unitprice: "unitPrice",
  hargasatuan: "unitPrice",
  currency: "currency",
  matauang: "currency",
};

export function guessColumnMapping(
  headers: readonly string[],
): Partial<Record<ImportColumn, string>> {
  const result: Partial<Record<ImportColumn, string>> = {};
  for (const header of headers) {
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = headerAliases[key];
    if (match && !result[match]) result[match] = header;
  }
  return result;
}

const formulas = new Set(["=", "+", "-", "@"]);

/**
 * Neutralizes spreadsheet formulas in CSV/XLSX exports (OWASP CSV Injection).
 * Any value starting with =, +, -, @, tab, CR or LF (even after leading spaces)
 * is prefixed with a single quote so spreadsheet apps treat it as literal text.
 */
export function sanitizeExportCell(value: string): string {
  if (!value) return "";
  const first = value[0];
  const trimmedFirst = value.trimStart()[0];
  if (
    first === "\t" ||
    first === "\r" ||
    first === "\n" ||
    (trimmedFirst && formulas.has(trimmedFirst))
  ) {
    return `'${value}`;
  }
  return value;
}

/**
 * Rejects spreadsheet formula strings in untrusted imports.
 * Numeric columns never allow negative values; text columns must not start
 * with `=`, `+`, `-`, `@`, tab or CR/LF so formulas are never stored or echoed.
 */
export function isFormulaText(value: string): boolean {
  if (!value) return false;
  const first = value[0];
  const trimmedFirst = value.trimStart()[0];
  return (
    first === "\t" ||
    first === "\r" ||
    first === "\n" ||
    (Boolean(trimmedFirst) && formulas.has(trimmedFirst))
  );
}

export const columnMappingSchema = z
  .object({
    invoiceNumber: z.string().trim().min(1).max(120),
    documentDate: z.string().trim().min(1).max(120),
    taxPeriod: z.string().trim().min(1).max(120),
    documentType: z.string().trim().min(1).max(120),
    taxFamily: z.string().trim().min(1).max(120),
    counterpartyName: z.string().trim().min(1).max(120),
    counterpartyIdentity: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v ? v : undefined)),
    description: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => (v ? v : undefined)),
    lineDescription: z.string().trim().min(1).max(120),
    quantity: z.string().trim().min(1).max(120),
    unitPrice: z.string().trim().min(1).max(120),
    currency: z.string().trim().min(1).max(120),
  })
  .strict();
export type ColumnMapping = z.infer<typeof columnMappingSchema>;

export const importTemplateQuerySchema = z
  .object({
    format: z.enum(["csv", "xlsx"]).default("csv"),
    family: z.enum(intakeFamilies).default("UNCLASSIFIED"),
  })
  .strict();

export type ImportIssueCode =
  | "FORMULA_INJECTION"
  | "MISSING_COLUMN"
  | "INVALID_INVOICE_NUMBER"
  | "INVALID_DATE"
  | "FUTURE_DATE"
  | "DATE_TOO_OLD"
  | "INVALID_PERIOD"
  | "INVALID_DOCUMENT_TYPE"
  | "BLOCKED_TAX_FAMILY"
  | "INVALID_TAX_FAMILY"
  | "FAMILY_DOCUMENT_TYPE"
  | "UNKNOWN_COUNTERPARTY"
  | "AMBIGUOUS_COUNTERPARTY"
  | "COUNTERPARTY_KIND"
  | "INVALID_DESCRIPTION"
  | "INVALID_LINE_DESCRIPTION"
  | "INVALID_QUANTITY"
  | "INVALID_UNIT_PRICE"
  | "LINE_PRECISION"
  | "INVALID_CURRENCY"
  | "DUPLICATE_IN_FILE";

export type ImportRowIssue = {
  column: ImportColumn;
  code: ImportIssueCode;
};
