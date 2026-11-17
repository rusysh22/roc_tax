import { describe, expect, it } from "vitest";
import {
  calculateTaxAmount,
  formatRationalRate,
} from "../../apps/web/src/lib/intake/tax-rules";
import {
  evaluateDeterministicTax,
  type RuleCandidate,
} from "../../apps/web/src/server/tax/engine";
import { canTransition } from "../../apps/web/src/lib/intake/state";
import { taxMessages } from "../../apps/web/src/i18n/tax";

const syntheticRule: RuleCandidate = {
  id: "r1",
  code: "SYNTH-BPPU",
  version: 1,
  taxFamily: "PPH_UNIFIKASI_BPPU",
  documentType: "SUPPLIER_INVOICE",
  objectCode: "TEST-01",
  name: "Synthetic Test Fixture",
  jurisdiction: "ID",
  effectiveFrom: "2026-01-01",
  effectiveTo: "2026-12-31",
  rateNumerator: 2,
  rateDenominator: 100,
  roundingMode: "HALF_UP",
  requireCounterpartyIdentity: true,
  requirePayrollEvidence: false,
  requireTreatyEvidence: false,
  sourceCitation: "NON_PRODUCTION synthetic fixture",
  catalogStatus: "NON_PRODUCTION_TEST",
  smeReviewedBy: null,
};

describe("deterministic tax engine & rounding", () => {
  it("computes decimal-safe tax amounts with documented rounding modes", () => {
    // 100.05 * 1 / 200 = 0.50025 -> 0.50
    // 101.00 * 1 / 200 = 0.505 -> HALF_UP: 0.51, FLOOR: 0.50, CEIL: 0.51
    expect(
      calculateTaxAmount({
        dppAmount: "101.00",
        rateNumerator: 1,
        rateDenominator: 200,
        roundingMode: "HALF_UP",
      }),
    ).toBe("0.51");
    expect(
      calculateTaxAmount({
        dppAmount: "101.00",
        rateNumerator: 1,
        rateDenominator: 200,
        roundingMode: "FLOOR",
      }),
    ).toBe("0.50");
    expect(
      calculateTaxAmount({
        dppAmount: "100.01",
        rateNumerator: 1,
        rateDenominator: 200,
        roundingMode: "CEIL",
      }),
    ).toBe("0.51");
    expect(
      calculateTaxAmount({
        dppAmount: "120000000000000.00",
        rateNumerator: 11,
        rateDenominator: 120,
        roundingMode: "HALF_UP",
      }),
    ).toBe("11000000000000.00");
    expect(formatRationalRate(2, 100)).toBe("2%");
    expect(formatRationalRate(15, 1000)).toBe("1.50%");
  });

  it("blocks unclassified, PPh21 without payroll, PPh26 without treaty, and out-of-date rules", () => {
    const unclassified = evaluateDeterministicTax(
      {
        taxFamily: "UNCLASSIFIED",
        documentType: "SUPPLIER_INVOICE",
        documentDate: "2026-11-16",
        dppAmount: "100000.00",
        counterpartyIdentityType: "NPWP",
        counterpartyCountryCode: "ID",
      },
      [syntheticRule],
    );
    expect(unclassified.blockers.map((b) => b.code)).toContain(
      "UNCLASSIFIED_FAMILY",
    );
    expect(unclassified.taxAmount).toBe("0.00");

    const pph21 = evaluateDeterministicTax(
      {
        taxFamily: "PPH21_BP21",
        documentType: "SUPPLIER_INVOICE",
        documentDate: "2026-11-16",
        dppAmount: "100000.00",
        counterpartyIdentityType: "NIK",
        counterpartyCountryCode: "ID",
        objectCode: "TEST-21",
      },
      [],
    );
    expect(pph21.blockers.map((b) => b.code)).toContain(
      "PPH21_PAYROLL_REQUIRED",
    );

    const pph26 = evaluateDeterministicTax(
      {
        taxFamily: "PPH26_BP26",
        documentType: "SUPPLIER_INVOICE",
        documentDate: "2026-11-16",
        dppAmount: "100000.00",
        counterpartyIdentityType: "FOREIGN_TIN",
        counterpartyCountryCode: "SG",
        objectCode: "TEST-26",
      },
      [],
    );
    expect(pph26.blockers.map((b) => b.code)).toContain(
      "PPH26_TREATY_REQUIRED",
    );

    const expiredWindow = evaluateDeterministicTax(
      {
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        documentDate: "2027-01-01",
        dppAmount: "100000.00",
        counterpartyIdentityType: "NPWP",
        counterpartyCountryCode: "ID",
        objectCode: "TEST-01",
        allowNonProductionPreview: true,
      },
      [syntheticRule],
    );
    expect(expiredWindow.blockers.map((b) => b.code)).toContain(
      "NO_MATCHING_RULE",
    );
  });

  it("labels NON_PRODUCTION_TEST fixtures and blocks production approval until SME_APPROVED", () => {
    const nonProd = evaluateDeterministicTax(
      {
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        documentDate: "2026-11-16",
        dppAmount: "100000.00",
        counterpartyIdentityType: "NPWP",
        counterpartyCountryCode: "ID",
        objectCode: "TEST-01",
        allowNonProductionPreview: true,
      },
      [syntheticRule],
    );
    expect(nonProd.taxAmount).toBe("2000.00");
    expect(nonProd.productionApprovedRule).toBe(false);
    expect(nonProd.evidence.nonProductionWarning).toBe(true);
    expect(nonProd.blockers.map((b) => b.code)).toEqual([
      "RULE_NOT_SME_APPROVED",
    ]);

    const approvedRule: RuleCandidate = {
      ...syntheticRule,
      version: 2,
      catalogStatus: "SME_APPROVED",
      smeReviewedBy: "SME Test",
    };
    const prod = evaluateDeterministicTax(
      {
        taxFamily: "PPH_UNIFIKASI_BPPU",
        documentType: "SUPPLIER_INVOICE",
        documentDate: "2026-11-16",
        dppAmount: "100000.00",
        counterpartyIdentityType: "NPWP",
        counterpartyCountryCode: "ID",
        objectCode: "TEST-01",
      },
      [syntheticRule, approvedRule],
    );
    expect(prod.productionApprovedRule).toBe(true);
    expect(prod.blockers).toEqual([]);
    expect(canTransition("APPROVED", "CHANGES_REQUESTED")).toBe(true);
    expect(canTransition("APPROVED", "DRAFT")).toBe(false);
  });

  it("keeps bilingual tax messages aligned", () => {
    expect(Object.keys(taxMessages.id).sort()).toEqual(
      Object.keys(taxMessages.en).sort(),
    );
    expect(Object.keys(taxMessages.id.blockers).sort()).toEqual(
      Object.keys(taxMessages.en.blockers).sort(),
    );
    expect(Object.keys(taxMessages.id.errors).sort()).toEqual(
      Object.keys(taxMessages.en.errors).sort(),
    );
    expect(Object.keys(taxMessages.id.segregationPolicies).sort()).toEqual(
      Object.keys(taxMessages.en.segregationPolicies).sort(),
    );
  });
});
