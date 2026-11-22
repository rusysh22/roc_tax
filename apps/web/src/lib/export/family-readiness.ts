import type { allTaxFamilies } from "../intake/tax-rules";

export type TaxFamily = (typeof allTaxFamilies)[number];

/**
 * Readiness gates for producing Coretax XML for a tax family. Export opens
 * only when EVERY gate passes — this keeps unverified families (PPN, PPh 21,
 * PPh 26, …) fail-closed until official DJP material and Tax SME approval
 * exist. See core_docs/14_UI_STANDARDS.md and 13_DECISIONS for the policy.
 */
export const readinessGates = [
  "OFFICIAL_TEMPLATE",
  "SOURCE_HASH",
  "XSD_ORDER",
  "SERIALIZER",
  "FIXTURE_TESTS",
  "SME_RULES",
] as const;
export type ReadinessGate = (typeof readinessGates)[number];

/**
 * Families with a source-verified XML serializer in code. A serializer is only
 * added after the official DJP template/XSD for that family is in hand and
 * fixture tests compare the output with the official sample.
 */
export const familiesWithSerializer: readonly TaxFamily[] = [
  "PPH_UNIFIKASI_BPPU",
];

export type ReadinessTemplate = {
  status: "UNVERIFIED" | "VERIFIED" | "RETIRED";
  sourceSha256: string;
  xsdSchemaHash: string;
  fixtureVerified: boolean;
};

export type FamilyReadiness = {
  taxFamily: TaxFamily;
  gates: Record<ReadinessGate, boolean>;
  ready: boolean;
};

const sha256 = /^[a-f0-9]{64}$/;

export function familyReadiness(
  taxFamily: TaxFamily,
  input: {
    /** Registered templates for this family (any status). */
    templates: ReadinessTemplate[];
    /** True when at least one tax rule for this family is SME-approved. */
    hasApprovedRule: boolean;
  },
): FamilyReadiness {
  const verified = input.templates.filter((t) => t.status === "VERIFIED");
  const gates: Record<ReadinessGate, boolean> = {
    OFFICIAL_TEMPLATE: verified.length > 0,
    SOURCE_HASH: verified.some((t) => sha256.test(t.sourceSha256)),
    XSD_ORDER: verified.some((t) => sha256.test(t.xsdSchemaHash)),
    SERIALIZER: familiesWithSerializer.includes(taxFamily),
    FIXTURE_TESTS: verified.some((t) => t.fixtureVerified),
    SME_RULES: input.hasApprovedRule,
  };
  return {
    taxFamily,
    gates,
    ready: readinessGates.every((gate) => gates[gate]),
  };
}
