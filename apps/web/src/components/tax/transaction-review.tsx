"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { exportMessages } from "@/i18n/exports";
import { taxMessages } from "@/i18n/tax";
import { intakeMessages } from "@/i18n/intake";
import { formatDate } from "@/i18n/format";
import {
  allTaxFamilies,
  formatRationalRate,
  type SegregationPolicy,
  type TaxBlocker,
  type TaxRoundingMode,
  type TaxRuleStatus,
} from "@/lib/intake/tax-rules";
import type { TransactionStatus } from "@/lib/intake/state";
import type { Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";

type EvaluationItem = {
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

type SnapshotItem = {
  id: string;
  transactionVersion: number;
  ruleCode: string;
  ruleVersion: number;
  sourceCitation: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  taxFamily: string;
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

type ReviewPayload = {
  role: Role;
  segregationPolicy: SegregationPolicy;
  taxInput: {
    objectCode: string | null;
    payrollEvidenceRef: string | null;
    treatyCertificateRef: string | null;
    treatyCountryCode: string | null;
    smeOverrideNote: string | null;
  } | null;
  evaluations: EvaluationItem[];
  snapshots: SnapshotItem[];
};

export function TransactionReviewPanel({
  locale,
  transactionId,
  transactionVersion,
  transactionStatus,
  currentFamily,
  onChanged,
}: {
  locale: Locale;
  transactionId: string;
  transactionVersion: number;
  transactionStatus: TransactionStatus;
  currentFamily: string;
  onChanged: () => Promise<void>;
}) {
  const t = taxMessages[locale];
  const intake = intakeMessages[locale];
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [taxFamily, setTaxFamily] = useState(currentFamily);
  const [objectCode, setObjectCode] = useState("");
  const [payrollRef, setPayrollRef] = useState("");
  const [treatyRef, setTreatyRef] = useState("");
  const [treatyCountry, setTreatyCountry] = useState("");
  const [overrideNote, setOverrideNote] = useState("");
  const [reason, setReason] = useState("");
  const [soleAck, setSoleAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  function formatTaxError(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    try {
      const next = await apiGet<ReviewPayload>(
        `/api/transactions/${transactionId}/review`,
      );
      setData(next);
      setTaxFamily(currentFamily);
      setObjectCode(next.taxInput?.objectCode ?? "");
      setPayrollRef(next.taxInput?.payrollEvidenceRef ?? "");
      setTreatyRef(next.taxInput?.treatyCertificateRef ?? "");
      setTreatyCountry(next.taxInput?.treatyCountryCode ?? "");
      setOverrideNote(next.taxInput?.smeOverrideNote ?? "");
    } catch (error) {
      setFeedback(formatTaxError(error));
    }
  }

  useEffect(() => {
    void load();
  }, [transactionId, transactionVersion, currentFamily]);

  async function sendReview(payload: unknown) {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost(`/api/transactions/${transactionId}/review`, payload);
      setReason("");
      setSoleAck(false);
      await load();
      await onChanged();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatTaxError(error));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const latest = data.evaluations[0] ?? null;
  const canEvaluate =
    ["PREPARER", "REVIEWER"].includes(data.role) &&
    [
      "DRAFT",
      "NEEDS_REVIEW",
      "CHANGES_REQUESTED",
      "VALIDATED",
      "SUBMITTED",
    ].includes(transactionStatus);
  const canSubmit =
    data.role === "PREPARER" && transactionStatus === "VALIDATED";
  const canRequestChanges =
    ["REVIEWER", "APPROVER"].includes(data.role) &&
    ["SUBMITTED", "VALIDATED"].includes(transactionStatus);
  const canApprove =
    data.role === "APPROVER" && transactionStatus === "SUBMITTED";
  const canReopen =
    ["REVIEWER", "APPROVER"].includes(data.role) &&
    ["APPROVED", "CORETAX_REJECTED"].includes(transactionStatus);

  return (
    <section className="space-y-5 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t.panelTitle}</h2>
        <StatusBadge>
          {t.segregationPolicies[data.segregationPolicy].split(":")[0]}
        </StatusBadge>
      </div>
      <p className="rounded-md border bg-muted/30 p-3 text-xs leading-6">
        {t.panelNotice}
      </p>
      <p className="text-xs text-muted-foreground">
        {t.pph21Requirement} {t.pph26Requirement}
      </p>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-3 text-xs"
        >
          {feedback}
        </p>
      )}

      {latest && (
        <div className="space-y-3 rounded-md border p-4 text-xs">
          {latest.evidence.nonProductionWarning && (
            <p role="alert" className="rounded border p-2 font-semibold">
              {t.nonProductionBanner}
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <strong>{t.dppLabel}:</strong>{" "}
              <span className="font-mono">
                {formatAmountString(latest.dppAmount, locale)}
              </span>
            </div>
            <div>
              <strong>{t.taxAmountLabel}:</strong>{" "}
              <span className="font-mono font-semibold">
                {formatAmountString(latest.taxAmount, locale)}
              </span>
            </div>
            <div>
              <strong>{t.ruleLabel}:</strong>{" "}
              <span className="font-mono">
                {latest.ruleCode
                  ? `${latest.ruleCode} v${latest.ruleVersion}`
                  : "—"}
              </span>
            </div>
            <div>
              <strong>{t.rateLabel}:</strong>{" "}
              <span className="font-mono">
                {formatRationalRate(
                  latest.rateNumerator,
                  latest.rateDenominator,
                )}{" "}
                ({latest.roundingMode})
              </span>
            </div>
          </div>
          {latest.evidence.sourceCitation && (
            <p className="text-muted-foreground">
              <strong>{t.citationLabel}:</strong>{" "}
              {latest.evidence.sourceCitation} (
              {latest.evidence.effectiveWindow})
            </p>
          )}
          {latest.evidence.diff && (
            <p className="font-mono text-muted-foreground">
              {t.diffLabel}:{" "}
              {formatAmountString(
                latest.evidence.diff.previousTaxAmount,
                locale,
              )}{" "}
              → {formatAmountString(latest.taxAmount, locale)}
            </p>
          )}
          {latest.blockers.length > 0 ? (
            <div className="space-y-1 border-t pt-2">
              <p className="font-semibold">{t.blockersTitle}</p>
              <ul className="list-disc space-y-1 pl-4">
                {latest.blockers.map((b, idx) => (
                  <li key={idx}>
                    <span className="font-mono">{b.field}:</span>{" "}
                    {t.blockers[b.code]}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="font-medium">{t.noBlockers}</p>
          )}
        </div>
      )}

      {canEvaluate && (
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            void sendReview({
              action: "evaluate",
              taxFamily,
              objectCode: objectCode || undefined,
              payrollEvidenceRef: payrollRef || undefined,
              treatyCertificateRef: treatyRef || undefined,
              treatyCountryCode: treatyCountry || undefined,
              smeOverrideNote: overrideNote || undefined,
              allowNonProductionPreview: true,
            });
          }}
          className="space-y-3 border-t pt-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium">
              <span>{t.taxFamilyLabel}</span>
              <select
                value={taxFamily}
                onChange={(e) => setTaxFamily(e.target.value)}
                disabled={transactionStatus === "SUBMITTED"}
                className="min-h-11 w-full rounded-md border bg-background px-3 text-sm"
              >
                {allTaxFamilies.map((f) => (
                  <option key={f} value={f}>
                    {
                      intake.families[
                        f as keyof typeof intakeMessages.id.families
                      ]
                    }
                  </option>
                ))}
              </select>
            </label>
            <Field
              label={t.objectCodeLabel}
              value={objectCode}
              onChange={(e) => setObjectCode(e.target.value)}
              maxLength={32}
            />
            <Field
              label={t.payrollRefLabel}
              value={payrollRef}
              onChange={(e) => setPayrollRef(e.target.value)}
              maxLength={120}
            />
            <Field
              label={t.treatyRefLabel}
              value={treatyRef}
              onChange={(e) => setTreatyRef(e.target.value)}
              maxLength={120}
            />
            <Field
              label={t.treatyCountryLabel}
              value={treatyCountry}
              onChange={(e) => setTreatyCountry(e.target.value)}
              maxLength={2}
            />
            <Field
              label={t.overrideNoteLabel}
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              maxLength={500}
            />
          </div>
          <Submit busy={busy}>{t.evaluateButton}</Submit>
        </form>
      )}

      {["APPROVED", "EXPORTED", "CORETAX_REJECTED"].includes(
        transactionStatus,
      ) && (
        <div className="rounded-md border p-3 text-xs">
          <Link
            href={`/${locale}/app/exports`}
            className="font-medium underline"
          >
            {exportMessages[locale].pageTitle}
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t pt-4">
        {canSubmit && (
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void sendReview({ action: "submit", version: transactionVersion })
            }
          >
            {t.submitButton}
          </Button>
        )}
        {canApprove && (
          <div className="w-full space-y-3 rounded-md border p-4">
            {data.segregationPolicy === "SOLE_USER_EXCEPTION" && (
              <div className="space-y-2 text-xs">
                <p className="font-semibold">{t.soleUserWarning}</p>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={soleAck}
                    onChange={(e) => setSoleAck(e.target.checked)}
                  />
                  <span>{t.soleUserAckLabel}</span>
                </label>
              </div>
            )}
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                void sendReview({
                  action: "approve",
                  version: transactionVersion,
                  soleUserOverrideAck: soleAck,
                })
              }
            >
              {t.approveButton}
            </Button>
          </div>
        )}
      </div>

      {(canRequestChanges || canReopen) && (
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            void sendReview({
              action: canReopen ? "reopen" : "request_changes",
              version: transactionVersion,
              reason,
            });
          }}
          className="space-y-3 border-t pt-4"
        >
          <Field
            label={t.reasonLabel}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={2}
            maxLength={1000}
          />
          <Button type="submit" variant="outline" disabled={busy}>
            {canReopen ? t.reopenButton : t.requestChangesButton}
          </Button>
        </form>
      )}

      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">{t.snapshotsTitle}</h3>
        {data.snapshots.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.noSnapshots}</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {data.snapshots.map((s) => (
              <li key={s.id} className="rounded-md border p-3">
                <div className="font-mono font-semibold">
                  {s.ruleCode} v{s.ruleVersion} · {s.objectCode} ·{" "}
                  {formatAmountString(s.taxAmount, locale)}
                </div>
                <div className="text-muted-foreground">
                  {s.sourceCitation} · {s.approvedBy} ·{" "}
                  {formatDate(new Date(s.approvedAt), locale)}
                  {s.soleUserExceptionUsed ? " · SOLE_USER_EXCEPTION" : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
