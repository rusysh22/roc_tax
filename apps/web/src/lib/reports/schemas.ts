import { z } from "zod";
import { transactionSources } from "../intake/schemas";
import { allTaxFamilies } from "../intake/tax-rules";

export const discrepancyCodes = [
  "NONE",
  "NOT_EVALUATED",
  "HAS_BLOCKERS",
  "UNAPPROVED_DRAFT",
  "EXPORT_PENDING",
  "OUTCOME_UNRECORDED",
  "CORETAX_REJECTED",
  "REOPENED_AFTER_EXPORT",
  "VOIDED",
] as const;
export type DiscrepancyCode = (typeof discrepancyCodes)[number];

export const reconciliationQuerySchema = z.object({
  companyId: z.string().trim().max(100).optional().default(""),
  taxPeriod: z
    .string()
    .trim()
    .regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/)
    .optional()
    .default(""),
  taxFamily: z
    .union([z.enum(allTaxFamilies), z.literal("")])
    .optional()
    .default(""),
  source: z
    .union([z.enum(transactionSources), z.literal("")])
    .optional()
    .default(""),
  search: z.string().trim().max(80).optional().default(""),
  discrepancyOnly: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => v === true || v === "true")
    .default(false),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type ReconciliationQuery = z.infer<typeof reconciliationQuerySchema>;

export function classifyReconciliationDiscrepancy(input: {
  status: string;
  hasEvaluation: boolean;
  evaluationBlockersCount: number;
  hasCurrentSnapshot: boolean;
  hasExportItem: boolean;
  latestOutcome: string | null;
}): DiscrepancyCode {
  if (input.status === "VOIDED") return "VOIDED";
  if (input.status === "CHANGES_REQUESTED" && input.hasExportItem) {
    return "REOPENED_AFTER_EXPORT";
  }
  if (
    input.status === "CORETAX_REJECTED" ||
    input.latestOutcome === "CORETAX_REJECTED"
  ) {
    return "CORETAX_REJECTED";
  }
  if (input.status === "EXPORTED") {
    return input.latestOutcome ? "NONE" : "OUTCOME_UNRECORDED";
  }
  if (input.status === "CORETAX_ACCEPTED") {
    return "NONE";
  }
  if (input.status === "APPROVED") {
    return input.hasExportItem ? "OUTCOME_UNRECORDED" : "EXPORT_PENDING";
  }
  if (!input.hasEvaluation) return "NOT_EVALUATED";
  if (input.evaluationBlockersCount > 0) return "HAS_BLOCKERS";
  return "UNAPPROVED_DRAFT";
}

export const supportAccessGrantCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("grant"),
      reason: z.string().trim().min(5).max(400),
      durationMinutes: z.coerce.number().int().min(15).max(120).default(60),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke"),
      grantId: z.string().trim().min(1).max(100),
    })
    .strict(),
]);
export type SupportAccessGrantCommand = z.infer<
  typeof supportAccessGrantCommandSchema
>;

export const adminOverviewQuerySchema = z.object({
  orgPage: z.coerce.number().int().min(1).max(1000).default(1),
  jobPage: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  jobStatus: z
    .enum([
      "",
      "QUEUED",
      "RUNNING",
      "SUCCEEDED",
      "FAILED_RETRYABLE",
      "DEAD_LETTER",
      "CANCELLED",
    ])
    .optional()
    .default(""),
});
export type AdminOverviewQuery = z.infer<typeof adminOverviewQuerySchema>;

export const superadminSupportInspectSchema = z
  .object({
    organizationId: z.string().trim().min(1).max(100),
    grantId: z.string().trim().min(1).max(100),
    reason: z.string().trim().min(5).max(400),
  })
  .strict();
export type SuperadminSupportInspectInput = z.infer<
  typeof superadminSupportInspectSchema
>;
