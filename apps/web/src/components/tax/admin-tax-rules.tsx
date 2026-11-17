"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { taxMessages } from "@/i18n/tax";
import { intakeMessages } from "@/i18n/intake";
import { documentTypes } from "@/lib/intake/schemas";
import {
  allTaxFamilies,
  formatRationalRate,
  taxRoundingModes,
  type TaxRoundingMode,
  type TaxRuleStatus,
} from "@/lib/intake/tax-rules";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type RuleItem = {
  id: string;
  code: string;
  version: number;
  taxFamily: string;
  documentType: string;
  objectCode: string;
  name: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  rateNumerator: number;
  rateDenominator: number;
  roundingMode: TaxRoundingMode;
  sourceCitation: string;
  catalogStatus: TaxRuleStatus;
  smeReviewedBy: string | null;
};

export function AdminTaxRulesView({ locale }: { locale: Locale }) {
  const t = taxMessages[locale];
  const intake = intakeMessages[locale];
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [code, setCode] = useState("SYNTH-BPPU-01");
  const [version, setVersion] = useState("1");
  const [taxFamily, setTaxFamily] = useState<string>("PPH_UNIFIKASI_BPPU");
  const [documentType, setDocumentType] =
    useState<(typeof documentTypes)[number]>("SUPPLIER_INVOICE");
  const [objectCode, setObjectCode] = useState("TEST-OBJ-01");
  const [name, setName] = useState("Synthetic Non-Production Test Rule");
  const [effectiveFrom, setEffectiveFrom] = useState("2026-01-01");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [rateNumerator, setRateNumerator] = useState("2");
  const [rateDenominator, setRateDenominator] = useState("100");
  const [roundingMode, setRoundingMode] = useState<TaxRoundingMode>("HALF_UP");
  const [sourceCitation, setSourceCitation] = useState(
    "NON_PRODUCTION synthetic reference fixture",
  );
  const [catalogStatus, setCatalogStatus] = useState<
    "DRAFT" | "NON_PRODUCTION_TEST" | "SME_APPROVED"
  >("NON_PRODUCTION_TEST");
  const [smeReviewedBy, setSmeReviewedBy] = useState("");
  const [reqIdentity, setReqIdentity] = useState(true);
  const [reqPayroll, setReqPayroll] = useState(false);
  const [reqTreaty, setReqTreaty] = useState(false);

  function formatRuleError(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    try {
      const res = await apiGet<{ rules: RuleItem[] }>("/api/admin/tax-rules");
      setRules(res.rules);
    } catch (error) {
      setFeedback(formatRuleError(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/admin/tax-rules", {
        action: "create",
        code,
        version: Number(version),
        taxFamily,
        documentType,
        objectCode,
        name,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        rateNumerator: Number(rateNumerator),
        rateDenominator: Number(rateDenominator),
        roundingMode,
        requireCounterpartyIdentity: reqIdentity,
        requirePayrollEvidence: reqPayroll,
        requireTreatyEvidence: reqTreaty,
        sourceCitation,
        catalogStatus,
        smeReviewedBy: smeReviewedBy || undefined,
      });
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatRuleError(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.adminRulesTitle}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t.adminRulesIntro}
        </p>
      </header>
      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-3 text-sm"
        >
          {feedback}
        </p>
      )}
      {rules.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-3 font-semibold">{t.codeLabel}</th>
                <th className="p-3 font-semibold">{t.taxFamilyLabel}</th>
                <th className="p-3 font-semibold">{t.objectCodeLabel}</th>
                <th className="p-3 font-semibold">{t.rateLabel}</th>
                <th className="p-3 font-semibold">{t.effectiveLabel}</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="p-3 font-mono font-medium">
                    {r.code} v{r.version}
                  </td>
                  <td className="p-3">{r.taxFamily}</td>
                  <td className="p-3 font-mono">{r.objectCode}</td>
                  <td className="p-3 font-mono">
                    {formatRationalRate(r.rateNumerator, r.rateDenominator)} (
                    {r.roundingMode})
                  </td>
                  <td className="p-3 font-mono">
                    {r.effectiveFrom}..{r.effectiveTo ?? "open"}
                  </td>
                  <td className="p-3">
                    <StatusBadge active={r.catalogStatus === "SME_APPROVED"}>
                      {t.ruleStatuses[r.catalogStatus]}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">{t.createRuleButton}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.codeLabel}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Field
            label={t.versionLabel}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            required
          />
          <label className="block space-y-2 text-sm font-medium">
            <span>{t.taxFamilyLabel}</span>
            <select
              value={taxFamily}
              onChange={(e) => setTaxFamily(e.target.value)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {allTaxFamilies
                .filter((f) => f !== "UNCLASSIFIED")
                .map((f) => (
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
          <label className="block space-y-2 text-sm font-medium">
            <span>{intake.documentType}</span>
            <select
              value={documentType}
              onChange={(e) =>
                setDocumentType(
                  e.target.value as (typeof documentTypes)[number],
                )
              }
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {documentTypes.map((d) => (
                <option key={d} value={d}>
                  {intake.documentTypes[d]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t.objectCodeLabel}
            value={objectCode}
            onChange={(e) => setObjectCode(e.target.value)}
            required
          />
          <Field
            label={t.nameLabel}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Field
            label={t.effectiveFromLabel}
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            required
          />
          <Field
            label={t.effectiveToLabel}
            type="date"
            value={effectiveTo}
            onChange={(e) => setEffectiveTo(e.target.value)}
          />
          <Field
            label={t.numeratorLabel}
            value={rateNumerator}
            onChange={(e) => setRateNumerator(e.target.value)}
            required
          />
          <Field
            label={t.denominatorLabel}
            value={rateDenominator}
            onChange={(e) => setRateDenominator(e.target.value)}
            required
          />
          <label className="block space-y-2 text-sm font-medium">
            <span>{t.roundingLabel}</span>
            <select
              value={roundingMode}
              onChange={(e) =>
                setRoundingMode(e.target.value as TaxRoundingMode)
              }
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {taxRoundingModes.map((m) => (
                <option key={m} value={m}>
                  {t.roundingModes[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Status</span>
            <select
              value={catalogStatus}
              onChange={(e) =>
                setCatalogStatus(
                  e.target.value as
                    "DRAFT" | "NON_PRODUCTION_TEST" | "SME_APPROVED",
                )
              }
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="NON_PRODUCTION_TEST">
                {t.ruleStatuses.NON_PRODUCTION_TEST}
              </option>
              <option value="DRAFT">{t.ruleStatuses.DRAFT}</option>
              <option value="SME_APPROVED">
                {t.ruleStatuses.SME_APPROVED}
              </option>
            </select>
          </label>
        </div>
        <Field
          label={t.citationLabel}
          value={sourceCitation}
          onChange={(e) => setSourceCitation(e.target.value)}
          required
        />
        <Field
          label={t.smeReviewerLabel}
          value={smeReviewedBy}
          onChange={(e) => setSmeReviewedBy(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reqIdentity}
            onChange={(e) => setReqIdentity(e.target.checked)}
          />
          <span>{t.requireIdentityLabel}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reqPayroll}
            onChange={(e) => setReqPayroll(e.target.checked)}
          />
          <span>{t.requirePayrollLabel}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={reqTreaty}
            onChange={(e) => setReqTreaty(e.target.checked)}
          />
          <span>{t.requireTreatyLabel}</span>
        </label>
        <Submit busy={busy}>{t.createRuleButton}</Submit>
      </form>
    </div>
  );
}
