import {
  calculateTaxAmount,
  formatRationalRate,
  type TaxBlocker,
  type TaxRoundingMode,
  type TaxRuleStatus,
} from "../../lib/intake/tax-rules";

export type RuleCandidate = {
  id: string;
  code: string;
  version: number;
  taxFamily: string;
  documentType: string;
  objectCode: string;
  name: string;
  jurisdiction: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
  requireCounterpartyIdentity: boolean;
  requirePayrollEvidence: boolean;
  requireTreatyEvidence: boolean;
  sourceCitation: string;
  catalogStatus: TaxRuleStatus;
  smeReviewedBy: string | null;
};

export type EvaluationInput = {
  taxFamily: string;
  documentType: string;
  documentDate: string;
  dppAmount: string;
  counterpartyIdentityType: string;
  counterpartyCountryCode: string;
  objectCode?: string | null;
  payrollEvidenceRef?: string | null;
  treatyCertificateRef?: string | null;
  treatyCountryCode?: string | null;
  smeOverrideNote?: string | null;
  allowNonProductionPreview?: boolean;
};

export type EvaluationOutput = {
  matchedRule: RuleCandidate | null;
  taxFamily: string;
  objectCode: string | null;
  dppAmount: string;
  taxAmount: string;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
  blockers: TaxBlocker[];
  productionApprovedRule: boolean;
  evidence: {
    evaluatedFamily: string;
    documentType: string;
    documentDate: string;
    counterpartyIdentityType: string;
    counterpartyCountryCode: string;
    objectCode: string | null;
    ruleCode: string | null;
    ruleVersion: number | null;
    catalogStatus: TaxRuleStatus | null;
    sourceCitation: string | null;
    effectiveWindow: string | null;
    rateDisplay: string | null;
    roundingMode: TaxRoundingMode;
    smeOverrideNote: string | null;
    nonProductionWarning: boolean;
  };
};

const pph21Families = new Set([
  "PPH21_BP21",
  "PPH21_BPMP",
  "PPH21_BPA1",
  "PPH21_BPA2",
]);

/**
 * Pure deterministic tax evaluation engine.
 * - Never guesses a rate or object code silently.
 * - Enforces effective-date matching on `documentDate`.
 * - Enforces payroll evidence for PPh 21 and treaty/SKD evidence for PPh 26.
 * - Flags `NON_PRODUCTION_TEST` / `DRAFT` rules so production approval stays blocked.
 */
export function evaluateDeterministicTax(
  input: EvaluationInput,
  rules: readonly RuleCandidate[],
): EvaluationOutput {
  const blockers: TaxBlocker[] = [];
  const objectCode = input.objectCode?.trim().toUpperCase() || null;

  if (input.taxFamily === "UNCLASSIFIED") {
    blockers.push({ code: "UNCLASSIFIED_FAMILY", field: "taxFamily" });
  }
  if (pph21Families.has(input.taxFamily) && !input.payrollEvidenceRef) {
    blockers.push({
      code: "PPH21_PAYROLL_REQUIRED",
      field: "payrollEvidenceRef",
    });
  }
  if (
    input.taxFamily === "PPH26_BP26" &&
    (!input.treatyCertificateRef || !input.treatyCountryCode)
  ) {
    blockers.push({
      code: "PPH26_TREATY_REQUIRED",
      field: "treatyCertificateRef",
    });
  }
  if (input.taxFamily !== "UNCLASSIFIED" && !objectCode) {
    blockers.push({ code: "MISSING_OBJECT_CODE", field: "objectCode" });
  }

  const eligibleStatuses: TaxRuleStatus[] = input.allowNonProductionPreview
    ? ["SME_APPROVED", "NON_PRODUCTION_TEST"]
    : ["SME_APPROVED"];

  const matching = rules
    .filter(
      (r) =>
        eligibleStatuses.includes(r.catalogStatus) &&
        r.taxFamily === input.taxFamily &&
        r.documentType === input.documentType &&
        (!objectCode || r.objectCode === objectCode) &&
        r.effectiveFrom <= input.documentDate &&
        (r.effectiveTo === null || input.documentDate <= r.effectiveTo),
    )
    .sort((a, b) => {
      // Prefer SME_APPROVED over NON_PRODUCTION_TEST, then latest effectiveFrom and version.
      if (a.catalogStatus !== b.catalogStatus) {
        return a.catalogStatus === "SME_APPROVED" ? -1 : 1;
      }
      if (a.effectiveFrom !== b.effectiveFrom) {
        return a.effectiveFrom > b.effectiveFrom ? -1 : 1;
      }
      return b.version - a.version;
    });

  const matchedRule =
    input.taxFamily !== "UNCLASSIFIED" && objectCode
      ? (matching[0] ?? null)
      : null;

  if (input.taxFamily !== "UNCLASSIFIED" && objectCode && !matchedRule) {
    blockers.push({ code: "NO_MATCHING_RULE", field: "objectCode" });
  }

  if (matchedRule) {
    if (
      matchedRule.requireCounterpartyIdentity &&
      input.counterpartyIdentityType === "NONE"
    ) {
      blockers.push({
        code: "COUNTERPARTY_IDENTITY_REQUIRED",
        field: "counterpartyId",
      });
    }
    if (matchedRule.requirePayrollEvidence && !input.payrollEvidenceRef) {
      if (!blockers.some((b) => b.code === "PPH21_PAYROLL_REQUIRED")) {
        blockers.push({
          code: "PPH21_PAYROLL_REQUIRED",
          field: "payrollEvidenceRef",
        });
      }
    }
    if (
      matchedRule.requireTreatyEvidence &&
      (!input.treatyCertificateRef || !input.treatyCountryCode)
    ) {
      if (!blockers.some((b) => b.code === "PPH26_TREATY_REQUIRED")) {
        blockers.push({
          code: "PPH26_TREATY_REQUIRED",
          field: "treatyCertificateRef",
        });
      }
    }
    if (matchedRule.catalogStatus !== "SME_APPROVED") {
      blockers.push({ code: "RULE_NOT_SME_APPROVED", field: "taxFamily" });
    }
  }

  const taxAmount = matchedRule
    ? calculateTaxAmount({
        dppAmount: input.dppAmount,
        rateNumerator: matchedRule.rateNumerator,
        rateDenominator: matchedRule.rateDenominator,
        roundingMode: matchedRule.roundingMode,
      })
    : "0.00";

  return {
    matchedRule,
    taxFamily: input.taxFamily,
    objectCode,
    dppAmount: input.dppAmount,
    taxAmount,
    rateNumerator: matchedRule?.rateNumerator ?? 0,
    rateDenominator: matchedRule?.rateDenominator ?? 1,
    roundingMode: matchedRule?.roundingMode ?? "HALF_UP",
    blockers,
    productionApprovedRule: matchedRule?.catalogStatus === "SME_APPROVED",
    evidence: {
      evaluatedFamily: input.taxFamily,
      documentType: input.documentType,
      documentDate: input.documentDate,
      counterpartyIdentityType: input.counterpartyIdentityType,
      counterpartyCountryCode: input.counterpartyCountryCode,
      objectCode,
      ruleCode: matchedRule?.code ?? null,
      ruleVersion: matchedRule?.version ?? null,
      catalogStatus: matchedRule?.catalogStatus ?? null,
      sourceCitation: matchedRule?.sourceCitation ?? null,
      effectiveWindow: matchedRule
        ? `${matchedRule.effectiveFrom}..${matchedRule.effectiveTo ?? "open"}`
        : null,
      rateDisplay: matchedRule
        ? formatRationalRate(
            matchedRule.rateNumerator,
            matchedRule.rateDenominator,
          )
        : null,
      roundingMode: matchedRule?.roundingMode ?? "HALF_UP",
      smeOverrideNote: input.smeOverrideNote ?? null,
      nonProductionWarning:
        matchedRule !== null && matchedRule.catalogStatus !== "SME_APPROVED",
    },
  };
}
