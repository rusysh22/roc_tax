"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { taxMessages } from "@/i18n/tax";
import type {
  SegregationPolicy,
  TaxBlocker,
  TaxRoundingMode,
  TaxRuleStatus,
} from "@/lib/intake/tax-rules";
import type { TransactionStatus } from "@/lib/intake/state";
import type { Role } from "@/server/workspaces/policy";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

export type EvaluationItem = {
  id: string;
  transactionVersion: number;
  ruleCode: string | null;
  ruleVersion: number | null;
  catalogStatus: TaxRuleStatus | null;
  taxFamily: string;
  objectCode: string | null;
  dppAmount: string;
  taxAmount: string;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
  blockers: TaxBlocker[];
  evidence: {
    sourceCitation?: string | null;
    effectiveWindow?: string | null;
    nonProductionWarning?: boolean;
    diff?: {
      previousTaxAmount: string;
      previousObjectCode: string | null;
    } | null;
  };
  evaluatedBy: string;
  evaluatedAt: string;
};

export type SnapshotItem = {
  id: string;
  transactionVersion: number;
  ruleCode: string;
  ruleVersion: number;
  sourceCitation: string;
  objectCode: string;
  dppAmount: string;
  taxAmount: string;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
  segregationPolicy: SegregationPolicy;
  soleUserExceptionUsed: boolean;
  approvedBy: string;
  approvedAt: string;
};

export type RuleOption = {
  id: string;
  code: string;
  version: number;
  taxFamily: string;
  documentType: string;
  objectCode: string;
  name: string;
  catalogStatus: TaxRuleStatus;
};

export type ReviewPayload = {
  role: Role;
  segregationPolicy: SegregationPolicy;
  taxInput: {
    objectCode: string | null;
    payrollEvidenceRef: string | null;
    treatyCertificateRef: string | null;
    treatyCountryCode: string | null;
    smeOverrideNote: string | null;
  } | null;
  availableRules?: RuleOption[];
  evaluations: EvaluationItem[];
  snapshots: SnapshotItem[];
};

export type ReviewInputs = {
  taxFamily: string;
  objectCode: string;
  payrollRef: string;
  treatyRef: string;
  treatyCountry: string;
  overrideNote: string;
};

/**
 * Tax review state shared by the transaction form header (workflow buttons)
 * and the Tax tab (evaluation inputs, result, snapshots).
 */
export function useTransactionReview({
  locale,
  transactionId,
  version,
  status,
  family,
  onChanged,
}: {
  locale: Locale;
  transactionId: string | null;
  version: number;
  status: TransactionStatus;
  family: string;
  onChanged: () => Promise<void>;
}) {
  const t = taxMessages[locale];
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [inputs, setInputs] = useState<ReviewInputs>({
    taxFamily: family,
    objectCode: "",
    payrollRef: "",
    treatyRef: "",
    treatyCountry: "",
    overrideNote: "",
  });
  const [busy, setBusy] = useState(false);
  const edited = useRef(false);

  const formatError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiFailure) {
        const map = t.errors as Record<string, string>;
        if (map[error.code]) return map[error.code];
      }
      return formatFailure(error, locale);
    },
    [t, locale],
  );

  const load = useCallback(async () => {
    if (!transactionId) return;
    const next = await apiGet<ReviewPayload>(
      `/api/transactions/${transactionId}/review`,
    );
    setData(next);
    // Never overwrite inputs the user is editing during a background reload.
    if (edited.current) return;
    setInputs({
      taxFamily: family,
      objectCode: next.taxInput?.objectCode ?? "",
      payrollRef: next.taxInput?.payrollEvidenceRef ?? "",
      treatyRef: next.taxInput?.treatyCertificateRef ?? "",
      treatyCountry: next.taxInput?.treatyCountryCode ?? "",
      overrideNote: next.taxInput?.smeOverrideNote ?? "",
    });
  }, [transactionId, family]);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, version]);

  function setInput(patch: Partial<ReviewInputs>) {
    edited.current = true;
    setInputs((current) => ({ ...current, ...patch }));
  }

  /** Runs a review command; resolves to an error message or null. */
  async function run(payload: Record<string, unknown>): Promise<string | null> {
    if (!transactionId) return null;
    setBusy(true);
    try {
      await apiPost(`/api/transactions/${transactionId}/review`, payload);
      edited.current = false;
      await onChanged();
      await load();
      return null;
    } catch (error) {
      return formatError(error);
    } finally {
      setBusy(false);
    }
  }

  const evaluate = () =>
    run({
      action: "evaluate",
      taxFamily: inputs.taxFamily,
      objectCode: inputs.objectCode || undefined,
      payrollEvidenceRef: inputs.payrollRef || undefined,
      treatyCertificateRef: inputs.treatyRef || undefined,
      treatyCountryCode: inputs.treatyCountry || undefined,
      smeOverrideNote: inputs.overrideNote || undefined,
      allowNonProductionPreview: true,
    });

  const role = data?.role;
  const can = {
    evaluate:
      (role === "PREPARER" || role === "REVIEWER") &&
      [
        "DRAFT",
        "NEEDS_REVIEW",
        "CHANGES_REQUESTED",
        "VALIDATED",
        "SUBMITTED",
      ].includes(status),
    submit: role === "PREPARER" && status === "VALIDATED",
    requestChanges:
      (role === "REVIEWER" || role === "APPROVER") &&
      ["SUBMITTED", "VALIDATED"].includes(status),
    approve: role === "APPROVER" && status === "SUBMITTED",
    reopen:
      (role === "REVIEWER" || role === "APPROVER") &&
      ["APPROVED", "CORETAX_REJECTED"].includes(status),
  };

  return {
    data,
    inputs,
    setInput,
    busy,
    run,
    evaluate,
    can,
    formatError,
    reload: load,
  };
}
