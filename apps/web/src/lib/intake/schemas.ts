import { z } from "zod";
import { amountPattern, quantityPattern } from "./decimal";
import { identityTypes } from "./identity";
import { transactionStatuses } from "./state";

/**
 * Families selectable for invoice intake. PPh 21 and PPh 26 families need payroll
 * or treaty facts that an invoice cannot supply (PRD FR-007), so they stay
 * unavailable for manual invoice intake. Selecting a family is a draft label only;
 * it does not imply a verified tax classification or an available XML export.
 */
export const intakeFamilies = [
  "UNCLASSIFIED",
  "PPH_UNIFIKASI_BPPU",
  "PPN_FAKTUR_KELUARAN",
  "PPH_UNIFIKASI_BPNR",
] as const;
export const blockedIntakeFamilies = [
  "PPH21_BP21",
  "PPH21_BPMP",
  "PPH21_BPA1",
  "PPH21_BPA2",
  "PPH26_BP26",
] as const;
export const documentTypes = ["SUPPLIER_INVOICE", "SALES_INVOICE"] as const;
export const transactionSources = [
  "MANUAL",
  "SPREADSHEET",
  "OCR",
  "ERP",
] as const;
export const counterpartyKinds = ["VENDOR", "CUSTOMER", "BOTH"] as const;
export const MAX_LINES = 100;

const id = z.string().min(1).max(100);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const companyInputSchema = z
  .object({
    name: text(100),
    legalName: text(200),
    npwp: optionalText(32),
    nitku: optionalText(40),
    address: optionalText(500),
  })
  .strict();

export const companyCommandSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("create"), company: companyInputSchema })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      id,
      company: companyInputSchema,
      clearNpwp: z.boolean().optional(),
      clearNitku: z.boolean().optional(),
    })
    .strict(),
  z.object({ action: z.literal("archive"), id }).strict(),
  // Hard delete is only allowed while nothing references the company.
  z.object({ action: z.literal("delete"), id }).strict(),
]);

export const counterpartyInputSchema = z
  .object({
    kind: z.enum(counterpartyKinds),
    name: text(200),
    identityType: z.enum(identityTypes),
    identity: optionalText(64),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/),
    address: optionalText(500),
  })
  .strict();

export const counterpartyCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      counterparty: counterpartyInputSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("update"),
      id,
      counterparty: counterpartyInputSchema,
    })
    .strict(),
  // Toggles archived state; archived counterparties cannot be used on new drafts.
  z.object({ action: z.literal("archive"), id }).strict(),
  // Hard delete is only allowed while no transaction references it.
  z.object({ action: z.literal("delete"), id }).strict(),
]);

export const lineInputSchema = z
  .object({
    description: text(500),
    quantity: z.string().trim().regex(quantityPattern),
    unitPrice: z.string().trim().regex(amountPattern),
  })
  .strict();

export const draftInputSchema = z
  .object({
    companyId: id,
    counterpartyId: id,
    taxFamily: z.enum(intakeFamilies),
    documentType: z.enum(documentTypes),
    invoiceNumber: text(64),
    documentDate: z.iso.date(),
    taxPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    // Foreign-currency invoices need an approved exchange-rate policy (open item).
    currency: z.literal("IDR"),
    description: optionalText(1000),
    lines: z.array(lineInputSchema).min(1).max(MAX_LINES),
  })
  .strict();
export type DraftInput = z.input<typeof draftInputSchema>;

export const transactionCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      idempotencyKey: z.uuid(),
      draft: draftInputSchema,
      acknowledgeDuplicates: z.boolean().default(false),
    })
    .strict(),
  z.object({ action: z.literal("check"), draft: draftInputSchema }).strict(),
]);

export const transactionUpdateSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update"),
      version: z.number().int().positive(),
      draft: draftInputSchema,
      acknowledgeDuplicates: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("void"),
      version: z.number().int().positive(),
      reason: text(500),
    })
    .strict(),
  z.object({ action: z.literal("comment"), body: text(2000) }).strict(),
]);

/** Comma-separated multi-value query parameter, validated per item. */
function csvParam<T extends string>(item: z.ZodType<T, string>) {
  return z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(item).max(50));
}

export const transactionSortFields = [
  "created",
  "date",
  "invoice",
  "amount",
  "status",
  "period",
] as const;
const sortPattern = new RegExp(
  "^(" + transactionSortFields.join("|") + "):(asc|desc)$",
);

export const transactionQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(transactionStatuses).optional(),
    taxFamily: z.enum(intakeFamilies).optional(),
    // Multi-value filters used by the standard list view.
    statuses: csvParam(z.enum(transactionStatuses)),
    excludeStatuses: csvParam(z.enum(transactionStatuses)),
    families: csvParam(z.enum([...intakeFamilies, ...blockedIntakeFamilies])),
    sources: csvParam(z.enum(transactionSources)),
    companyIds: csvParam(z.string().min(1).max(100)),
    counterpartyIds: csvParam(z.string().min(1).max(100)),
    invoice: z.string().trim().max(100).optional(),
    counterparty: z.string().trim().max(100).optional(),
    dateFrom: z.iso.date().optional(),
    dateTo: z.iso.date().optional(),
    taxPeriod: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .optional(),
    taxPeriods: csvParam(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)),
    sort: z
      .union([
        z.enum(["created_desc", "date_desc", "date_asc"]),
        z.string().regex(sortPattern),
      ])
      .default("created_desc"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => [20, 50, 80].includes(value))
      .default(20),
  })
  .strict();

export const counterpartyQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    id: z.string().min(1).max(100).optional(),
    archived: z.enum(["exclude", "include", "only"]).default("exclude"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => [50, 500].includes(value))
      .default(50),
  })
  .strict();

/** Field-level issue codes understood by the bilingual UI. */
export type IssueCode =
  | "INVALID"
  | "REQUIRED"
  | "LINE_PRECISION"
  | "TOTAL_TOO_LARGE"
  | "FUTURE_DATE"
  | "DATE_TOO_OLD"
  | "UNKNOWN_COMPANY"
  | "ARCHIVED_COMPANY"
  | "ARCHIVED_COUNTERPARTY"
  | "UNKNOWN_COUNTERPARTY"
  | "COUNTERPARTY_KIND"
  | "FAMILY_DOCUMENT_TYPE"
  | "INVALID_NPWP"
  | "INVALID_NIK"
  | "INVALID_FOREIGN_TIN"
  | "INVALID_NITKU"
  | "IDENTITY_NOT_ALLOWED";
export type FieldIssue = { path: string; code: IssueCode };
