"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, ScanText, Save } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { adminMessages } from "@/i18n/admin";
import { codeLabel } from "@/i18n/codes";
import { ocrMessages } from "@/i18n/ocr";
import { siteMessages } from "@/i18n/site";
import type { OcrAdapterKey } from "@/lib/intake/ocr";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox, FormField } from "@/components/ui/field";
import { Badge, Notice, Skeleton } from "@/components/ui/status";
import { comboLabels } from "@/components/views/page-state";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";
import { cn } from "@/lib/utils";

type AllowedProvider = {
  slug: string;
  displayName: string;
  adapterKey: OcrAdapterKey;
  model: string;
  region: string;
  maxPages: number;
  monthlyPageCap: number;
  monthlySpendCapIdr: string;
  retentionPolicy: string;
  processorNotice: string;
  vendorApproved: boolean;
  secretReady: boolean;
};
type OrgOcrPayload = {
  role: Role;
  effectiveStatus:
    | "NONE_MANUAL"
    | "READY"
    | "NOT_CONFIGURED"
    | "CONSENT_REQUIRED"
    | "VENDOR_NOT_APPROVED";
  current: {
    providerSlug: string;
    displayName: string;
    adapterKey: string;
    model: string;
    region: string;
    externalAiConsent: boolean;
    consentedAt: string | null;
  };
  allowedProviders: AllowedProvider[];
  usageThisMonth: { pagesUsed: number; spendIdr: string; jobCount: number };
};

const statusTone = {
  READY: "green",
  NONE_MANUAL: "gray",
  NOT_CONFIGURED: "red",
  CONSENT_REQUIRED: "amber",
  VENDOR_NOT_APPROVED: "red",
} as const;

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

export function OrgOcrSettingsView({ locale }: { locale: Locale }) {
  const t = ocrMessages[locale];
  const a = adminMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];
  const [data, setData] = useState<OrgOcrPayload | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("none");
  const [consent, setConsent] = useState(false);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  function formatOcrError(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    try {
      const next = await apiGet<OrgOcrPayload>("/api/ocr/settings");
      setData(next);
      setSelectedSlug(next.current.providerSlug);
      setConsent(next.current.externalAiConsent);
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
      else setFeedback({ ok: false, text: formatOcrError(error) });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await apiPost("/api/ocr/settings", {
        providerSlug: selectedSlug,
        externalAiConsent: selectedSlug === "none" ? false : consent,
      });
      await load();
      setFeedback({ ok: true, text: t.saved });
    } catch (error) {
      setFeedback({ ok: false, text: formatOcrError(error) });
    } finally {
      setBusy(false);
    }
  }

  if (noWorkspace)
    return (
      <div className="max-w-xl space-y-4 rounded-xl border bg-surface p-6">
        <h1 className="text-2xl font-semibold">{a.ocrTitle}</h1>
        <p className="text-sm text-muted-foreground">{acc.noWorkspace}</p>
        <Button asChild variant="outline">
          <Link href={`/${locale}/app/settings`}>{site.manageWorkspace}</Link>
        </Button>
      </div>
    );
  if (!data) return <Skeleton className="h-64 w-full" />;

  const canManage = can(data.role, "team.manage");
  const chosen = data.allowedProviders.find((p) => p.slug === selectedSlug);
  const ready = data.effectiveStatus === "READY";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{a.ocrTitle}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{a.ocrIntro}</p>
      </div>
      {feedback && (
        <Notice tone={feedback.ok ? "success" : "danger"} role="status">
          {feedback.text}
        </Notice>
      )}

      {/* Header: current status and usage at a glance. */}
      <div className="grid gap-4 rounded-xl border bg-surface p-5 shadow-xs lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              ready
                ? "bg-success-soft text-success-fg"
                : "bg-muted text-muted-foreground",
            )}
          >
            <ScanText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm text-muted-foreground">{a.ocrStatusTitle}</p>
            <Badge tone={statusTone[data.effectiveStatus]} dot>
              {t.effectiveStatuses[data.effectiveStatus]}
            </Badge>
            {data.current.providerSlug !== "none" && (
              <p className="text-sm font-medium">
                {data.current.displayName}{" "}
                <span className="text-xs text-muted-foreground">
                  · {codeLabel(locale, "ocrAdapter", data.current.adapterKey)} ·{" "}
                  {data.current.region}
                </span>
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [a.ocrPages, String(data.usageThisMonth.pagesUsed)],
            [
              a.ocrSpend,
              formatAmountString(data.usageThisMonth.spendIdr, locale),
            ],
            [a.ocrJobs, String(data.usageThisMonth.jobCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border bg-surface-2 px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums">
                {value}
              </p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground sm:col-span-3">
            {a.ocrUsageTitle}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-xl border bg-surface p-5 shadow-xs sm:p-6">
          {!canManage ? (
            <Notice tone="info">{a.ocrManagerOnly}</Notice>
          ) : (
            <form onSubmit={submit}>
              <fieldset disabled={busy} className="min-w-0 space-y-5">
                <Section title={a.ocrChooseTitle} intro={a.ocrChooseIntro}>
                  <FormField
                    field="ocr.provider"
                    label={t.chooseProvider}
                    required
                  >
                    <Combobox
                      value={selectedSlug}
                      onChange={(value) => {
                        const next = value ?? "none";
                        setSelectedSlug(next);
                        if (next === "none") setConsent(false);
                      }}
                      options={[
                        { value: "none", label: t.noneOption },
                        ...data.allowedProviders.map((p) => ({
                          value: p.slug,
                          label: p.displayName,
                          description: `${codeLabel(locale, "ocrAdapter", p.adapterKey)} · ${p.region}`,
                        })),
                      ]}
                      labels={comboLabels(locale)}
                    />
                  </FormField>
                  {chosen && (
                    <div className="space-y-3 rounded-lg border bg-surface-2 p-4">
                      <p className="text-sm font-semibold">
                        {a.ocrProviderDetails}
                      </p>
                      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
                        <dt className="text-muted-foreground">{a.ocrModel}</dt>
                        <dd className="font-mono text-xs">{chosen.model}</dd>
                        <dt className="text-muted-foreground">{a.ocrRegion}</dt>
                        <dd>{chosen.region}</dd>
                        <dt className="text-muted-foreground">
                          {a.ocrRetention}
                        </dt>
                        <dd>
                          {codeLabel(
                            locale,
                            "retentionPolicy",
                            chosen.retentionPolicy,
                          )}
                        </dd>
                        <dt className="text-muted-foreground">
                          {a.ocrMaxPages}
                        </dt>
                        <dd className="font-mono">{chosen.maxPages}</dd>
                        <dt className="text-muted-foreground">
                          {a.ocrMonthlyCap}
                        </dt>
                        <dd>
                          <span className="font-mono">
                            {chosen.monthlyPageCap}
                          </span>{" "}
                          ·{" "}
                          {formatAmountString(
                            chosen.monthlySpendCapIdr,
                            locale,
                          )}
                        </dd>
                      </dl>
                      {chosen.processorNotice && (
                        <p className="text-xs text-muted-foreground">
                          {chosen.processorNotice}
                        </p>
                      )}
                      {!chosen.vendorApproved && (
                        <Notice tone="danger" role="alert">
                          {t.errors.VENDOR_NOT_APPROVED}
                        </Notice>
                      )}
                      {!chosen.secretReady && (
                        <Notice tone="warning">
                          {t.errors.OCR_SECRET_MISSING}
                        </Notice>
                      )}
                    </div>
                  )}
                  {selectedSlug !== "none" && (
                    <Checkbox
                      label={t.consentLabel}
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                  )}
                </Section>
                <div className="flex justify-end border-t pt-4">
                  <Button type="submit" disabled={busy}>
                    <Save aria-hidden="true" />
                    <span>{t.saveSettings}</span>
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
        </div>

        <aside className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs">
          <h2 className="text-base font-semibold">{a.ocrHowTitle}</h2>
          <ol className="space-y-3 text-sm">
            {[a.ocrHow1, a.ocrHow2, a.ocrHow3, a.ocrHow4].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${locale}/app/transactions`}>
              <span>{a.ocrGoTransactions}</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <p className="border-t pt-3 text-xs text-muted-foreground">
            {t.productionBoundary}
          </p>
        </aside>
      </div>
    </div>
  );
}
