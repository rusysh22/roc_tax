"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { ocrMessages } from "@/i18n/ocr";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";

type AllowedProvider = {
  slug: string;
  displayName: string;
  adapterKey: "NONE" | "SYNTHETIC_TEST" | "EXTERNAL_NOT_CONFIGURED";
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
  usageThisMonth: {
    pagesUsed: number;
    spendIdr: string;
    jobCount: number;
  };
};

export function OrgOcrSettingsView({ locale }: { locale: Locale }) {
  const t = ocrMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];
  const [data, setData] = useState<OrgOcrPayload | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("none");
  const [consent, setConsent] = useState(false);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

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
      else setFeedback(formatOcrError(error));
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
      await apiPost("/api/ocr/settings", {
        providerSlug: selectedSlug,
        externalAiConsent: selectedSlug === "none" ? false : consent,
      });
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatOcrError(error));
    } finally {
      setBusy(false);
    }
  }

  if (noWorkspace) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t.settingsTitle}</h1>
        <p>{acc.noWorkspace}</p>
        <Link className="underline" href={`/${locale}/app/settings`}>
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }
  if (!data) return <Skeleton className="h-48 w-full" />;

  const canManage = can(data.role, "team.manage");
  const chosenProvider = data.allowedProviders.find(
    (p) => p.slug === selectedSlug,
  );

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-2">
        <Link className="text-sm underline" href={`/${locale}/app/settings`}>
          {site.settings}
        </Link>
        <h1 className="text-2xl font-semibold">{t.settingsTitle}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t.settingsIntro}
        </p>
        <p className="rounded-md border bg-muted/30 p-3 text-xs leading-6">
          {t.productionBoundary}
        </p>
      </header>

      <section className="space-y-3 rounded-lg border p-5 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-semibold">{t.effectiveStatus}</span>
          <StatusBadge active={data.effectiveStatus === "READY"}>
            {t.effectiveStatuses[data.effectiveStatus]}
          </StatusBadge>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          {t.modelLabel}: {data.current.model} · {t.regionLabel}:{" "}
          {data.current.region}
        </p>
        <div className="border-t pt-3">
          <p className="font-semibold">{t.monthlyUsage}</p>
          <p className="mt-1 font-mono text-xs">
            {t.pagesUsed}: {data.usageThisMonth.pagesUsed} · {t.spendUsed}:{" "}
            {formatAmountString(data.usageThisMonth.spendIdr, locale)} ·{" "}
            {t.jobsCount}: {data.usageThisMonth.jobCount}
          </p>
        </div>
      </section>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-3 text-sm"
        >
          {feedback}
        </p>
      )}

      {!canManage ? (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          {t.managerOnly}
        </p>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-xl border bg-surface p-5 shadow-xs"
        >
          <label className="block space-y-2 text-sm font-medium">
            <span>{t.chooseProvider}</span>
            <select
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                if (e.target.value === "none") setConsent(false);
              }}
              className="field-control"
            >
              <option value="none">{t.noneOption}</option>
              {data.allowedProviders.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.displayName} ({p.adapterKey}) · {p.region}
                </option>
              ))}
            </select>
          </label>

          {chosenProvider && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-xs leading-6">
              <p>
                <strong>{t.modelLabel}:</strong> {chosenProvider.model} ·{" "}
                <strong>{t.regionLabel}:</strong> {chosenProvider.region} ·{" "}
                <strong>{t.retentionLabel}:</strong>{" "}
                {chosenProvider.retentionPolicy}
              </p>
              <p>
                <strong>{t.capLabel}:</strong> {chosenProvider.monthlyPageCap}{" "}
                pages /{" "}
                {formatAmountString(chosenProvider.monthlySpendCapIdr, locale)}
              </p>
              {chosenProvider.processorNotice && (
                <p>{chosenProvider.processorNotice}</p>
              )}
              {!chosenProvider.vendorApproved && (
                <p role="alert" className="font-semibold">
                  {t.errors.VENDOR_NOT_APPROVED}
                </p>
              )}
            </div>
          )}

          {selectedSlug !== "none" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1"
              />
              <span>{t.consentLabel}</span>
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <Submit busy={busy}>{t.saveSettings}</Submit>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void load()}
            >
              {site.refresh}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
