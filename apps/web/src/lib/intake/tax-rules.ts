import { z } from "zod";
import { AMOUNT_SCALE, formatFixed, parseFixed } from "./decimal";
import {
  bppuGovTreasurerOpts,
  bppuReferenceDocTypes,
  bppuTaxCertificates,
} from "../export/bppu-constants";
import { documentTypes, intakeFamilies } from "./schemas";

export const allTaxFamilies = [
  ...intakeFamilies,
  "PPH21_BP21",
  "PPH21_BPMP",
  "PPH21_BPA1",
  "PPH21_BPA2",
  "PPH26_BP26",
] as const;

export const taxRuleStatuses = [
  "DRAFT",
  "SME_APPROVED",
  "NON_PRODUCTION_TEST",
  "RETIRED",
] as const;
export type TaxRuleStatus = (typeof taxRuleStatuses)[number];

export const taxRoundingModes = ["HALF_UP", "FLOOR", "CEIL"] as const;
export type TaxRoundingMode = (typeof taxRoundingModes)[number];

export const segregationPolicies = [
  "STRICT_SEPARATION",
  "SOLE_USER_EXCEPTION",
] as const;
export type SegregationPolicy = (typeof segregationPolicies)[number];

export type TaxBlockerCode =
  | "UNCLASSIFIED_FAMILY"
  | "PPH21_PAYROLL_REQUIRED"
  | "PPH26_TREATY_REQUIRED"
  | "MISSING_OBJECT_CODE"
  | "NO_MATCHING_RULE"
  | "COUNTERPARTY_IDENTITY_REQUIRED"
  | "RULE_NOT_SME_APPROVED";

export type TaxBlocker = {
  code: TaxBlockerCode;
  field: string;
};

/**
 * Deterministic bigint fixed-point tax calculation:
 * `taxMinor = round((dppMinor * rateNumerator) / rateDenominator, roundingMode)`
 * Never uses binary floating-point arithmetic.
 */
export function calculateTaxAmount(input: {
  dppAmount: string;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
}): string {
  if (
    !Number.isInteger(input.rateNumerator) ||
    !Number.isInteger(input.rateDenominator) ||
    input.rateNumerator < 0 ||
    input.rateDenominator <= 0 ||
    input.rateNumerator > input.rateDenominator
  ) {
    throw new RangeError("INVALID_TAX_RATE");
  }
  const dppMinor = parseFixed(input.dppAmount, AMOUNT_SCALE);
  const num = BigInt(input.rateNumerator);
  const den = BigInt(input.rateDenominator);
  const product = dppMinor * num;
  const quotient = product / den;
  const remainder = product % den;

  let rounded = quotient;
  if (remainder > BigInt(0)) {
    if (input.roundingMode === "CEIL") {
      rounded = quotient + BigInt(1);
    } else if (
      input.roundingMode === "HALF_UP" &&
      remainder * BigInt(2) >= den
    ) {
      rounded = quotient + BigInt(1);
    }
  }
  return formatFixed(rounded, AMOUNT_SCALE);
}

export function formatRationalRate(numerator: number, denominator: number) {
  if (denominator <= 0) return "0%";
  const scaled = (BigInt(numerator) * BigInt(10000)) / BigInt(denominator);
  const whole = scaled / BigInt(100);
  const frac = (scaled % BigInt(100)).toString().padStart(2, "0");
  return frac === "00" ? `${whole}%` : `${whole}.${frac}%`;
}

export const taxRuleCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9_-]{3,40}$/),
      version: z.coerce.number().int().min(1).max(1000),
      taxFamily: z.enum(allTaxFamilies),
      documentType: z.enum(documentTypes),
      objectCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{2,32}$/),
      name: z.string().trim().min(2).max(150),
      jurisdiction: z.literal("ID").default("ID"),
      effectiveFrom: z.iso.date(),
      effectiveTo: z.iso.date().optional(),
      rateNumerator: z.coerce.number().int().min(0).max(1000000),
      rateDenominator: z.coerce.number().int().min(1).max(1000000),
      roundingMode: z.enum(taxRoundingModes).default("HALF_UP"),
      requireCounterpartyIdentity: z.boolean().default(true),
      requirePayrollEvidence: z.boolean().default(false),
      requireTreatyEvidence: z.boolean().default(false),
      sourceCitation: z.string().trim().min(3).max(300),
      catalogStatus: z
        .enum(["DRAFT", "NON_PRODUCTION_TEST", "SME_APPROVED"])
        .default("DRAFT"),
      smeReviewedBy: z.string().trim().max(120).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("set_status"),
      ruleId: z.string().trim().min(1).max(100),
      catalogStatus: z.enum(taxRuleStatuses),
      smeReviewedBy: z.string().trim().max(120).optional(),
    })
    .strict(),
]);

export const taxPolicyCommandSchema = z
  .object({
    segregationPolicy: z.enum(segregationPolicies),
  })
  .strict();

export const reviewCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("evaluate"),
      taxFamily: z.enum(allTaxFamilies).optional(),
      objectCode: z
        .string()
        .trim()
        .toUpperCase()
        .max(32)
        .optional()
        .transform((v) => (v ? v : undefined)),
      payrollEvidenceRef: z
        .string()
        .trim()
        .max(120)
        .optional()
        .transform((v) => (v ? v : undefined)),
      treatyCertificateRef: z
        .string()
        .trim()
        .max(120)
        .optional()
        .transform((v) => (v ? v : undefined)),
      treatyCountryCode: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/)
        .optional(),
      smeOverrideNote: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => (v ? v : undefined)),
      recipientTku: z
        .string()
        .trim()
        .max(22)
        .optional()
        .transform((v) => (v ? v.replace(/[\s.-]/g, "") : undefined))
        .refine((v) => !v || /^\d{22}$/.test(v), {
          message: "INVALID_RECIPIENT_TKU",
        }),
      taxCertificate: z.enum(bppuTaxCertificates).optional(),
      referenceDocType: z.enum(bppuReferenceDocTypes).optional(),
      govTreasurerOpt: z.enum(bppuGovTreasurerOpts).optional(),
      sp2dNumber: z
        .string()
        .trim()
        .max(100)
        .optional()
        .transform((v) => (v ? v : undefined)),
      withholdingDate: z.iso.date().optional(),
      allowNonProductionPreview: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("submit"),
      version: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal("request_changes"),
      version: z.number().int().positive(),
      reason: z.string().trim().min(2).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      version: z.number().int().positive(),
      soleUserOverrideAck: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      action: z.literal("reopen"),
      version: z.number().int().positive(),
      reason: z.string().trim().min(2).max(1000),
    })
    .strict(),
]);
