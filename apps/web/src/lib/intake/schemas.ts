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

export const transactionQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(transactionStatuses).optional(),
    taxFamily: z.enum(intakeFamilies).optional(),
    sort: z
      .enum(["created_desc", "date_desc", "date_asc"])
      .default("created_desc"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => value === 20 || value === 50)
      .default(20),
  })
  .strict();

export const counterpartyQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
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
  | "UNKNOWN_COUNTERPARTY"
  | "COUNTERPARTY_KIND"
  | "FAMILY_DOCUMENT_TYPE"
  | "INVALID_NPWP"
  | "INVALID_NIK"
  | "INVALID_FOREIGN_TIN"
  | "INVALID_NITKU"
  | "IDENTITY_NOT_ALLOWED";
export type FieldIssue = { path: string; code: IssueCode };
