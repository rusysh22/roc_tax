import { describe, expect, it } from "vitest";
import {
  familiesWithSerializer,
  familyReadiness,
  readinessGates,
} from "../../apps/web/src/lib/export/family-readiness";
import {
  PpnTemplateUnverifiedError,
  serializePpnFakturXml,
  validatePpnFaktur,
  type PpnFaktur,
} from "../../apps/web/src/lib/export/ppn-faktur";
import { exportCapableFamilies } from "../../apps/web/src/lib/export/bppu-spec";

const hash = "a".repeat(64);
const verifiedTemplate = {
  status: "VERIFIED" as const,
  sourceSha256: hash,
  xsdSchemaHash: hash,
  fixtureVerified: true,
};

const faktur: PpnFaktur = {
  seller: {
    npwp: "0".repeat(16),
    nitku: "0".repeat(22),
    name: "PT Penjual Sintetis",
  },
  buyer: {
    identityType: "NPWP",
    identity: "1".repeat(16),
    name: "PT Pembeli Sintetis",
    address: "Jl. Contoh No. 1, Jakarta",
  },
  invoiceDate: "2026-11-16",
  transactionCode: "SME",
  lines: [
    {
      kind: "SERVICES",
      itemCode: "SINTETIS",
      name: "Jasa konsultasi",
      unitCode: "UNIT",
      unitPrice: "1000000.00",
      quantity: "1",
      discount: "0.00",
      taxBase: "1000000.00",
      vatAmount: "110000.00",
      luxuryTaxRate: "0.00",
      luxuryTaxAmount: "0.00",
    },
  ],
};

describe("PPN (Faktur Pajak) framework — fail-closed", () => {
  it("BPPU is the only family with a serializer and export capability", () => {
    expect(familiesWithSerializer).toEqual(["PPH_UNIFIKASI_BPPU"]);
    expect([...exportCapableFamilies]).toEqual(["PPH_UNIFIKASI_BPPU"]);
  });

  it("PPN stays locked even with a verified template and SME rules (no serializer)", () => {
    const result = familyReadiness("PPN_FAKTUR_KELUARAN", {
      templates: [verifiedTemplate],
      hasApprovedRule: true,
    });
    expect(result.gates.SERIALIZER).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("reports every missing gate for a family with nothing registered", () => {
    const result = familyReadiness("PPN_FAKTUR_KELUARAN", {
      templates: [],
      hasApprovedRule: false,
    });
    expect(readinessGates.filter((g) => !result.gates[g])).toEqual([
      "OFFICIAL_TEMPLATE",
      "SOURCE_HASH",
      "XSD_ORDER",
      "SERIALIZER",
      "FIXTURE_TESTS",
      "SME_RULES",
    ]);
  });

  it("BPPU is ready only when all gates pass", () => {
    expect(
      familyReadiness("PPH_UNIFIKASI_BPPU", {
        templates: [verifiedTemplate],
        hasApprovedRule: true,
      }).ready,
    ).toBe(true);
    expect(
      familyReadiness("PPH_UNIFIKASI_BPPU", {
        templates: [verifiedTemplate],
        hasApprovedRule: false,
      }).ready,
    ).toBe(false);
    expect(
      familyReadiness("PPH_UNIFIKASI_BPPU", {
        templates: [{ ...verifiedTemplate, status: "UNVERIFIED" }],
        hasApprovedRule: true,
      }).ready,
    ).toBe(false);
  });

  it("validates Faktur Pajak data completeness", () => {
    expect(validatePpnFaktur(faktur)).toEqual({ ok: true, issues: [] });
    const bad = validatePpnFaktur({
      ...faktur,
      seller: { ...faktur.seller, npwp: "123" },
      lines: [],
    });
    expect(bad.ok).toBe(false);
    expect(bad.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(["seller.npwp", "lines"]),
    );
  });

  it("the PPN serializer always refuses until a verified spec exists", () => {
    expect(() => serializePpnFakturXml(faktur)).toThrow(
      PpnTemplateUnverifiedError,
    );
  });
});
