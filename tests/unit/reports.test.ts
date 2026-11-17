import { describe, expect, it } from "vitest";
import { reportMessages } from "../../apps/web/src/i18n/reports";
import {
  classifyReconciliationDiscrepancy,
  reconciliationQuerySchema,
  supportAccessGrantCommandSchema,
} from "../../apps/web/src/lib/reports/schemas";

describe("reconciliation classification, support access schemas & bilingual parity", () => {
  it("classifies every transaction & Coretax manual reconciliation state accurately", () => {
    expect(
      classifyReconciliationDiscrepancy({
        status: "DRAFT",
        hasEvaluation: false,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: false,
        hasExportItem: false,
        latestOutcome: null,
      }),
    ).toBe("NOT_EVALUATED");

    expect(
      classifyReconciliationDiscrepancy({
        status: "DRAFT",
        hasEvaluation: true,
        evaluationBlockersCount: 1,
        hasCurrentSnapshot: false,
        hasExportItem: false,
        latestOutcome: null,
      }),
    ).toBe("HAS_BLOCKERS");

    expect(
      classifyReconciliationDiscrepancy({
        status: "APPROVED",
        hasEvaluation: true,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: true,
        hasExportItem: false,
        latestOutcome: null,
      }),
    ).toBe("EXPORT_PENDING");

    expect(
      classifyReconciliationDiscrepancy({
        status: "EXPORTED",
        hasEvaluation: true,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: true,
        hasExportItem: true,
        latestOutcome: null,
      }),
    ).toBe("OUTCOME_UNRECORDED");

    expect(
      classifyReconciliationDiscrepancy({
        status: "EXPORTED",
        hasEvaluation: true,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: true,
        hasExportItem: true,
        latestOutcome: "CORETAX_SUBMITTED",
      }),
    ).toBe("NONE");

    expect(
      classifyReconciliationDiscrepancy({
        status: "CORETAX_ACCEPTED",
        hasEvaluation: true,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: true,
        hasExportItem: true,
        latestOutcome: "CORETAX_ACCEPTED",
      }),
    ).toBe("NONE");

    expect(
      classifyReconciliationDiscrepancy({
        status: "CORETAX_REJECTED",
        hasEvaluation: true,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: true,
        hasExportItem: true,
        latestOutcome: "CORETAX_REJECTED",
      }),
    ).toBe("CORETAX_REJECTED");

    expect(
      classifyReconciliationDiscrepancy({
        status: "CHANGES_REQUESTED",
        hasEvaluation: true,
        evaluationBlockersCount: 0,
        hasCurrentSnapshot: false,
        hasExportItem: true,
        latestOutcome: "CORETAX_REJECTED",
      }),
    ).toBe("REOPENED_AFTER_EXPORT");
  });

  it("validates query filters and bounded support access grant durations", () => {
    const parsed = reconciliationQuerySchema.parse({
      discrepancyOnly: "true",
      page: "2",
      pageSize: "25",
    });
    expect(parsed.discrepancyOnly).toBe(true);
    expect(parsed.page).toBe(2);

    expect(
      supportAccessGrantCommandSchema.safeParse({
        action: "grant",
        reason: "Investigating XML mismatch",
        durationMinutes: 60,
      }).success,
    ).toBe(true);
    expect(
      supportAccessGrantCommandSchema.safeParse({
        action: "grant",
        reason: "Too long window",
        durationMinutes: 999,
      }).success,
    ).toBe(false);
  });

  it("keeps bilingual report & superadmin messages aligned", () => {
    expect(Object.keys(reportMessages.id).sort()).toEqual(
      Object.keys(reportMessages.en).sort(),
    );
    expect(Object.keys(reportMessages.id.cards).sort()).toEqual(
      Object.keys(reportMessages.en.cards).sort(),
    );
    expect(Object.keys(reportMessages.id.discrepancies).sort()).toEqual(
      Object.keys(reportMessages.en.discrepancies).sort(),
    );
    expect(Object.keys(reportMessages.id.columns).sort()).toEqual(
      Object.keys(reportMessages.en.columns).sort(),
    );
    expect(Object.keys(reportMessages.id.adminLinks).sort()).toEqual(
      Object.keys(reportMessages.en.adminLinks).sort(),
    );
  });
});
