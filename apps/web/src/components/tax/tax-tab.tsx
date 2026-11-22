"use client";
import { Calculator, Lock } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { taxMessages } from "@/i18n/tax";
import { intakeMessages } from "@/i18n/intake";
import { formatDate } from "@/i18n/format";
import { allTaxFamilies, formatRationalRate } from "@/lib/intake/tax-rules";
import type { TransactionStatus } from "@/lib/intake/state";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { FieldGroup, FormField, TextInput } from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/status";
import { comboLabels } from "@/components/views/page-state";
import { formatAmountString } from "@/components/intake/client";
import type { useTransactionReview } from "./use-review";

type Review = ReturnType<typeof useTransactionReview>;

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-lg border bg-surface-2 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          strong ? "font-mono text-lg font-semibold" : "font-mono text-sm"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function TaxTab({
  locale,
  review,
  status,
  onEvaluate,
}: {
  locale: Locale;
  review: Review;
  status: TransactionStatus;
  onEvaluate: () => void;
}) {
  const t = taxMessages[locale];
  const intake = intakeMessages[locale];
  const { data, inputs, setInput, can, busy } = review;
  if (!data) return <p className="text-sm text-muted-foreground">…</p>;
  const latest = data.evaluations[0] ?? null;
  const rules = (data.availableRules ?? []).filter(
    (rule) => rule.taxFamily === inputs.taxFamily,
  );
  const ruleOptions = [
    ...new Map(
      rules.map((rule) => [
        rule.objectCode,
        {
          value: rule.objectCode,
          label: rule.objectCode,
          description: `${rule.name} · ${rule.code} v${rule.version} · ${rule.catalogStatus}`,
        },
      ]),
    ).values(),
  ];
  // Keep a manually saved code selectable even if no rule lists it.
  if (
    inputs.objectCode &&
    !ruleOptions.some((o) => o.value === inputs.objectCode)
  )
    ruleOptions.unshift({
      value: inputs.objectCode,
      label: inputs.objectCode,
      description: "",
    });

  return (
    <div className="space-y-8">
      <Notice>{t.panelNotice}</Notice>

      {latest ? (
        <section aria-label={t.ruleLabel} className="space-y-4">
          {latest.evidence.nonProductionWarning && (
            <Notice tone="strong" role="alert">
              {t.nonProductionBanner}
            </Notice>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t.dppLabel}
              value={formatAmountString(latest.dppAmount, locale)}
            />
            <Metric
              label={t.taxAmountLabel}
              value={formatAmountString(latest.taxAmount, locale)}
              strong
            />
            <Metric
              label={t.ruleLabel}
              value={
                latest.ruleCode
                  ? `${latest.ruleCode} v${latest.ruleVersion}`
                  : "—"
              }
            />
            <Metric
              label={t.rateLabel}
              value={`${formatRationalRate(latest.rateNumerator, latest.rateDenominator)} (${latest.roundingMode})`}
            />
          </div>
          {latest.evidence.sourceCitation && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {t.citationLabel}:
              </span>{" "}
              {latest.evidence.sourceCitation} (
              {latest.evidence.effectiveWindow})
            </p>
          )}
          {latest.evidence.diff && (
            <p className="font-mono text-xs text-muted-foreground">
              {t.diffLabel}:{" "}
              {formatAmountString(
                latest.evidence.diff.previousTaxAmount,
                locale,
              )}{" "}
              → {formatAmountString(latest.taxAmount, locale)}
            </p>
          )}
          {latest.blockers.length > 0 ? (
            <Notice tone="warning" title={t.blockersTitle} role="alert">
              <ul className="list-disc space-y-1 pl-4">
                {latest.blockers.map((b, i) => (
                  <li key={i}>
                    <span className="font-mono">{b.field}:</span>{" "}
                    {t.blockers[b.code]}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium">
              <Badge tone="solid" dot>
                OK
              </Badge>
              {t.noBlockers}
            </p>
          )}
        </section>
      ) : null}

      {can.evaluate && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onEvaluate();
          }}
          className="space-y-5"
        >
          <FieldGroup title={t.panelTitle} columns={2}>
            <FormField label={t.taxFamilyLabel} layout="inline">
              <Combobox
                value={inputs.taxFamily}
                onChange={(value) =>
                  value && setInput({ taxFamily: value, objectCode: "" })
                }
                options={allTaxFamilies.map((f) => ({
                  value: f,
                  label: intake.families[f as keyof typeof intake.families],
                }))}
                disabled={status === "SUBMITTED" || busy}
                labels={comboLabels(locale)}
              />
            </FormField>
            <FormField label={t.objectCodeLabel} layout="inline">
              <Combobox
                value={inputs.objectCode || null}
                onChange={(value) => setInput({ objectCode: value ?? "" })}
                options={ruleOptions}
                clearable
                disabled={busy}
                labels={comboLabels(locale)}
              />
            </FormField>
            <FormField label={t.payrollRefLabel} layout="inline">
              <TextInput
                value={inputs.payrollRef}
                onChange={(e) => setInput({ payrollRef: e.target.value })}
                maxLength={120}
                disabled={busy}
              />
            </FormField>
            <FormField label={t.treatyRefLabel} layout="inline">
              <TextInput
                value={inputs.treatyRef}
                onChange={(e) => setInput({ treatyRef: e.target.value })}
                maxLength={120}
                disabled={busy}
              />
            </FormField>
            <FormField label={t.treatyCountryLabel} layout="inline">
              <TextInput
                value={inputs.treatyCountry}
                onChange={(e) =>
                  setInput({ treatyCountry: e.target.value.toUpperCase() })
                }
                maxLength={2}
                className="w-24 font-mono uppercase"
                disabled={busy}
              />
            </FormField>
            <FormField label={t.overrideNoteLabel} layout="inline">
              <TextInput
                value={inputs.overrideNote}
                onChange={(e) => setInput({ overrideNote: e.target.value })}
                maxLength={500}
                disabled={busy}
              />
            </FormField>
          </FieldGroup>
          <p className="text-xs text-muted-foreground">
            {t.pph21Requirement} {t.pph26Requirement}
          </p>
          <Button type="submit" variant="outline" disabled={busy}>
            <Calculator aria-hidden="true" />
            <span>{t.evaluateButton}</span>
          </Button>
        </form>
      )}

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Lock aria-hidden="true" className="size-4" />
          {t.snapshotsTitle}
        </h3>
        {data.snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noSnapshots}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.snapshots.map((s) => (
              <li key={s.id} className="space-y-1 px-4 py-3 text-sm">
                <p className="font-mono font-semibold">
                  {s.ruleCode} v{s.ruleVersion} · {s.objectCode} ·{" "}
                  {formatAmountString(s.taxAmount, locale)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.sourceCitation} · {s.approvedBy} ·{" "}
                  {formatDate(new Date(s.approvedAt), locale)}
                  {s.soleUserExceptionUsed ? " · SOLE_USER_EXCEPTION" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
