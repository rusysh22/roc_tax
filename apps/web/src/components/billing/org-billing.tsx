"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  CreditCard,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldOff,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { billingMessages } from "@/i18n/billing";
import { codeEntry } from "@/i18n/codes";
import { formatDate } from "@/i18n/format";
import { siteMessages } from "@/i18n/site";
import { viewMessages } from "@/i18n/views";
import type {
  BerlangganCatalogPlan,
  BillingAdapterMode,
  LicenseStatus,
} from "@/lib/billing/schemas";
import { paidEntitlementKeys } from "@/lib/billing/schemas";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import {
  FieldGroup,
  FormField,
  ReadValue,
  TextInput,
} from "@/components/ui/field";
import { Badge, Notice, Skeleton } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { InfoTip } from "@/components/ui/tooltip";
import { TrialStrip } from "@/components/account/trial-strip";
import { Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";
import { cn } from "@/lib/utils";

type OrgBillingPayload = {
  role: Role;
  compatibilityGate: {
    adapterMode: BillingAdapterMode;
    saasLicensingApproved: boolean;
    compatibilityNote: string;
    storefrontUrl: string | null;
    catalogPlans: BerlangganCatalogPlan[];
  };
  trial: {
    activatedAt: string;
    expiresAt: string;
    usedTotal: number;
    maxTotal: number;
    maxPerJakartaDay: number;
  } | null;
  license: {
    licenseKeyHint: string | null;
    fingerprint: string;
    status: LicenseStatus;
    rawStatus: LicenseStatus;
    planCode: string | null;
    lastErrorCode: string | null;
    tokenExpiresAt: string | null;
    licenseExpiresAt: string | null;
    lastValidatedAt: string | null;
  } | null;
  entitlementSummary: {
    adapterMode: BillingAdapterMode;
    saasLicensingApproved: boolean;
    paidAccessEnabled: boolean;
    nonProductionTestActive: boolean;
    licenseStatus: LicenseStatus;
    planCode: string | null;
    entitlements: Record<string, string | number | boolean | null>;
    usage: {
      companiesCount: number;
      membersCount: number;
      monthTransactionsCount: number;
      monthXmlExportsCount: number;
    };
  };
};

type State = "paid" | "trial" | "attention" | "none";

function Section({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-0.5 border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** One usage KPI: bold number, plan limit and a coloured progress bar. */
function UsageCard({
  label,
  help,
  used,
  limit,
  p,
}: {
  label: string;
  help: string;
  used: number;
  limit: number | null;
  p: (typeof billingMessages)["en"]["page"];
}) {
  const ratio = limit ? Math.min(1, used / limit) : 0;
  const tone =
    ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-success";
  return (
    <div className="space-y-2 rounded-lg border bg-surface-2 px-4 py-3">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        <InfoTip functional={help} label={label} />
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums">
        {used}
        {limit !== null && (
          <span className="text-sm font-semibold text-muted-foreground">
            {" "}
            / {limit}
          </span>
        )}
      </p>
      {limit !== null ? (
        <>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={used}
          >
            <div
              className={cn("h-full rounded-full", tone)}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {p.remaining}:{" "}
            <span className="font-semibold text-foreground">
              {Math.max(0, limit - used)}
            </span>
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{p.noLimit}</p>
      )}
    </div>
  );
}

export function OrgBillingView({ locale }: { locale: Locale }) {
  const t = billingMessages[locale];
  const p = t.page;
  const site = siteMessages[locale];
  const v = viewMessages[locale];
  const [data, setData] = useState<OrgBillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function formatErr(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    setLoading(true);
    try {
      const payload = await apiGet<OrgBillingPayload>("/api/billing");
      setData(payload);
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE") {
        setNoWorkspace(true);
      } else {
        setFeedback({ ok: false, text: formatErr(error) });
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiPost("/api/billing", body);
      await load();
      setFeedback({ ok: true, text: t.savedOk });
      return true;
    } catch (error) {
      setFeedback({ ok: false, text: formatErr(error) });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onActivate(event: FormEvent) {
    event.preventDefault();
    const ok = await run({
      action: "activate",
      licenseKey,
      ...(fingerprint.trim() ? { fingerprint: fingerprint.trim() } : {}),
    });
    if (ok) setLicenseKey("");
  }

  if (loading && !data) return <Skeleton className="h-64 w-full" />;

  if (noWorkspace) {
    return (
      <div className="max-w-xl space-y-4 rounded-xl border bg-surface p-6">
        <h1 className="text-2xl font-semibold">{t.orgTitle}</h1>
        <p className="text-sm text-muted-foreground">{site.noActiveBody}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/app/settings`}>{site.manageWorkspace}</Link>
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <Notice tone="danger" role="alert" className="max-w-xl">
        {feedback?.text || site.appError}
      </Notice>
    );
  }

  const canManage = can(data.role, "team.manage");
  const gate = data.compatibilityGate;
  const summary = data.entitlementSummary;
  const usage = summary.usage;
  const ent = summary.entitlements;
  const licenseActive = ["ACTIVE", "GRACE"].includes(summary.licenseStatus);
  const trialActive =
    data.trial !== null && new Date(data.trial.expiresAt) > new Date();
  const state: State =
    licenseActive &&
    (summary.paidAccessEnabled || summary.nonProductionTestActive)
      ? "paid"
      : data.license &&
          !licenseActive &&
          summary.licenseStatus !== "NOT_CONFIGURED"
        ? "attention"
        : trialActive
          ? "trial"
          : "none";
  const stateText: Record<State, [string, string, string]> = {
    paid: [p.statePaid, p.statePaidBody, "bg-success-soft text-success-fg"],
    trial: [p.stateTrial, p.stateTrialBody, "bg-info-soft text-info-fg"],
    attention: [
      p.stateAttention,
      p.stateAttentionBody,
      "bg-danger-soft text-danger-fg",
    ],
    none: [p.stateNone, p.stateNoneBody, "bg-muted text-muted-foreground"],
  };
  const [stateTitle, stateBody, stateTone] = stateText[state];
  const numberOrNull = (key: string) =>
    typeof ent[key] === "number" ? (ent[key] as number) : null;
  const planName =
    gate.catalogPlans.find((plan) => plan.slug === summary.planCode)?.name ??
    summary.planCode;
  const formatValue = (value: string | number | boolean | null) =>
    value === true
      ? p.yes
      : value === false
        ? p.no
        : value === null
          ? "—"
          : String(value);
  const benefitRows = Object.entries(ent);
  const lastProblem = data.license?.lastErrorCode
    ? ((t.errors as Record<string, string>)[data.license.lastErrorCode] ??
      site.appError)
    : null;

  /* ---------- Overview ---------- */
  const overviewTab = (
    <Section title={p.usageTitle} intro={p.usageIntro}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["MONTHLY_TRANSACTIONS", usage.monthTransactionsCount],
            ["MONTHLY_XML_EXPORTS", usage.monthXmlExportsCount],
            ["MAX_COMPANIES", usage.companiesCount],
            ["MAX_MEMBERS", usage.membersCount],
          ] as const
        ).map(([key, used]) => {
          const entry = codeEntry(locale, "entitlement", key);
          return (
            <UsageCard
              key={key}
              label={entry.label}
              help={entry.help}
              used={used}
              limit={numberOrNull(key)}
              p={p}
            />
          );
        })}
      </div>
    </Section>
  );

  /* ---------- Plan & benefits ---------- */
  const planTab = (
    <div className="space-y-8">
      <Section title={p.benefitsTitle} intro={p.benefitsIntro}>
        {benefitRows.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {p.noBenefits}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {p.benefit}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {p.value}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ...paidEntitlementKeys.filter((k) => k in ent),
                  ...benefitRows
                    .map(([k]) => k)
                    .filter(
                      (k) =>
                        !(paidEntitlementKeys as readonly string[]).includes(k),
                    ),
                ].map((key) => {
                  const entry = codeEntry(locale, "entitlement", key);
                  return (
                    <tr key={key}>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 font-medium">
                          {entry.label}
                          <InfoTip
                            functional={entry.help}
                            technical={key}
                            label={v.information}
                            technicalLabel={v.technicalName}
                          />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                        {formatValue(ent[key])}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {gate.catalogPlans.length > 0 && (
        <Section title={p.catalogTitle}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {gate.catalogPlans.map((plan) => (
              <div
                key={plan.slug}
                className={cn(
                  "space-y-2 rounded-lg border p-4",
                  plan.slug === summary.planCode &&
                    "border-primary bg-info-soft",
                )}
              >
                <p className="flex items-center justify-between gap-2 font-semibold">
                  {plan.name}
                  {plan.slug === summary.planCode && (
                    <Badge tone="green" dot>
                      {p.statePaid}
                    </Badge>
                  )}
                </p>
                <p className="font-mono text-lg font-bold">
                  {plan.currency} {String(plan.price)}
                  <span className="text-xs font-medium text-muted-foreground">
                    {" "}
                    / {plan.interval}
                  </span>
                </p>
                {plan.description && (
                  <p className="text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );

  /* ---------- Trial ---------- */
  const trialTab = (
    <Section title={p.tabs.trial} intro={p.trialIntro}>
      <Notice tone="info" title={p.trialRulesTitle}>
        {p.trialRules}
      </Notice>
      <TrialStrip locale={locale} />
    </Section>
  );

  /* ---------- License key ---------- */
  const licenseTab = (
    <div className="space-y-8">
      <Section title={p.currentLicense}>
        {data.license ? (
          <div className="space-y-4">
            <FieldGroup columns={2}>
              <FormField field="billing.status" layout="inline">
                <ReadValue>
                  <CodeBadge
                    domain="licenseStatus"
                    code={summary.licenseStatus}
                  />
                </ReadValue>
              </FormField>
              <FormField field="billing.plan" layout="inline">
                <ReadValue>{planName ?? p.noPlan}</ReadValue>
              </FormField>
              <FormField
                field="billing.licenseKey"
                label={p.keyHint}
                layout="inline"
              >
                <ReadValue mono>{data.license.licenseKeyHint}</ReadValue>
              </FormField>
              <FormField field="billing.validUntil" layout="inline">
                <ReadValue>
                  {data.license.licenseExpiresAt
                    ? formatDate(
                        new Date(data.license.licenseExpiresAt),
                        locale,
                      )
                    : null}
                </ReadValue>
              </FormField>
              <FormField field="billing.lastValidatedAt" layout="inline">
                <ReadValue>
                  {data.license.lastValidatedAt
                    ? formatDate(new Date(data.license.lastValidatedAt), locale)
                    : null}
                </ReadValue>
              </FormField>
              {lastProblem && (
                <FormField field="billing.lastProblem" layout="inline">
                  <ReadValue className="text-danger-fg">
                    {lastProblem}
                  </ReadValue>
                </FormField>
              )}
            </FieldGroup>
            {canManage && (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void run({ action: "validate" })}
                >
                  <RefreshCw aria-hidden="true" />
                  <span>{t.validateButton}</span>
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(p.deactivateConfirm))
                      void run({ action: "deactivate" });
                  }}
                >
                  <ShieldOff aria-hidden="true" />
                  <span>{t.deactivateButton}</span>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{p.noLicense}</p>
        )}
      </Section>

      <Section title={p.enterKey}>
        {!canManage ? (
          <Notice tone="info">{t.ownerOnlyNotice}</Notice>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <ol className="space-y-3 text-sm">
              <li className="font-semibold">{p.stepsTitle}</li>
              {[p.step1, p.step2, p.step3].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <form onSubmit={onActivate} className="space-y-3">
              <FormField
                field="billing.licenseKey"
                label={t.licenseKeyLabel}
                required
              >
                <TextInput
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  autoComplete="off"
                  className="font-mono"
                />
              </FormField>
              <details className="rounded-lg border px-3 py-2 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  {p.advanced}
                </summary>
                <div className="pt-3">
                  <FormField
                    field="billing.fingerprint"
                    label={t.fingerprintLabel}
                  >
                    <TextInput
                      value={fingerprint}
                      onChange={(e) => setFingerprint(e.target.value)}
                      className="font-mono"
                    />
                  </FormField>
                </div>
              </details>
              <div className="flex justify-end">
                <Submit busy={busy}>
                  <KeyRound aria-hidden="true" />
                  <span>{t.activateButton}</span>
                </Submit>
              </div>
            </form>
          </div>
        )}
      </Section>

      {canManage && (
        <details className="rounded-lg border px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-muted-foreground">
            {p.technical}
          </summary>
          <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{p.billingMode}</dt>
            <dd>
              <CodeBadge domain="billingMode" code={gate.adapterMode} />
            </dd>
            <dt className="text-muted-foreground">{p.providerApproval}</dt>
            <dd>
              <Badge tone={gate.saasLicensingApproved ? "green" : "amber"} dot>
                {gate.saasLicensingApproved ? p.approved : p.pending}
              </Badge>
            </dd>
            {data.license && (
              <>
                <dt className="text-muted-foreground">{t.fingerprintLabel}</dt>
                <dd className="font-mono text-xs break-all">
                  {data.license.fingerprint}
                </dd>
              </>
            )}
            {gate.compatibilityNote && (
              <>
                <dt className="text-muted-foreground">{p.notes}</dt>
                <dd className="text-xs">{gate.compatibilityNote}</dd>
              </>
            )}
          </dl>
        </details>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.orgTitle}</h1>
        <p className="text-sm text-muted-foreground">{p.subtitle}</p>
      </div>

      {feedback && (
        <Notice tone={feedback.ok ? "success" : "danger"} role="status">
          {feedback.text}
        </Notice>
      )}

      {/* Header: the subscription state in one glance. */}
      <div
        className="flex flex-col gap-4 rounded-xl border bg-surface p-5 shadow-xs sm:flex-row sm:items-center"
        data-billing-compatibility={
          gate.saasLicensingApproved ? "APPROVED" : "PENDING"
        }
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-xl",
              stateTone,
            )}
          >
            <CreditCard className="size-6" />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{stateTitle}</span>
              {planName && (
                <Badge tone="blue">{`${p.plan}: ${planName}`}</Badge>
              )}
              {data.license && (
                <CodeBadge
                  domain="licenseStatus"
                  code={summary.licenseStatus}
                />
              )}
            </p>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {stateBody}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {gate.storefrontUrl ? (
            <Button asChild>
              <a
                href={gate.storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden="true" />
                <span>{p.buyPlan}</span>
              </a>
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{p.purchaseClosed}</p>
          )}
        </div>
      </div>

      {summary.nonProductionTestActive ? (
        <Notice tone="warning" title={p.testModeTitle}>
          {p.testModeBody}
        </Notice>
      ) : (
        !summary.paidAccessEnabled && (
          <Notice tone="info" title={p.paidClosedTitle}>
            {p.paidClosedBody}
          </Notice>
        )
      )}

      <fieldset
        disabled={busy}
        className="min-w-0 rounded-xl border bg-surface p-4 shadow-xs sm:p-6"
      >
        <Tabs
          label={t.orgTitle}
          items={[
            { id: "overview", label: p.tabs.overview, content: overviewTab },
            { id: "plan", label: p.tabs.plan, content: planTab },
            { id: "trial", label: p.tabs.trial, content: trialTab },
            { id: "license", label: p.tabs.license, content: licenseTab },
          ]}
        />
      </fieldset>
    </div>
  );
}
