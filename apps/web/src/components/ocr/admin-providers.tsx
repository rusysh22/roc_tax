"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { ocrMessages } from "@/i18n/ocr";
import { ocrAdapterKeys, type OcrAdapterKey } from "@/lib/intake/ocr";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type ProviderItem = {
  id: string;
  slug: string;
  displayName: string;
  adapterKey: OcrAdapterKey;
  endpointUrl: string | null;
  secretRef: string | null;
  secretConfigured: boolean;
  model: string;
  region: string;
  maxPages: number;
  timeoutMs: number;
  monthlyPageCap: number;
  monthlySpendCapIdr: string;
  estimatedCostPerPageIdr: string;
  retentionPolicy: string;
  processorNotice: string;
  vendorApproved: boolean;
  enabled: boolean;
};

export function AdminOcrProvidersView({ locale }: { locale: Locale }) {
  const t = ocrMessages[locale];
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [health, setHealth] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [slug, setSlug] = useState("synthetic-test");
  const [displayName, setDisplayName] = useState("Synthetic Test OCR");
  const [adapterKey, setAdapterKey] = useState<OcrAdapterKey>("SYNTHETIC_TEST");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [secretRef, setSecretRef] = useState("");
  const [model, setModel] = useState("synthetic-invoice-v1");
  const [region, setRegion] = useState("id-jakarta");
  const [maxPages, setMaxPages] = useState("10");
  const [timeoutMs, setTimeoutMs] = useState("15000");
  const [monthlyPageCap, setMonthlyPageCap] = useState("500");
  const [monthlySpendCapIdr, setMonthlySpendCapIdr] = useState("0.00");
  const [estimatedCostPerPageIdr, setEstimatedCostPerPageIdr] =
    useState("0.00");
  const [retentionPolicy, setRetentionPolicy] = useState(
    "ZERO_RETENTION_REQUIRED",
  );
  const [processorNotice, setProcessorNotice] = useState("");
  const [vendorApproved, setVendorApproved] = useState(false);
  const [enabled, setEnabled] = useState(false);

  function formatAdminError(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    try {
      const data = await apiGet<{
        providers: ProviderItem[];
        jobHealth: Record<string, number>;
      }>("/api/admin/ocr-providers");
      setProviders(data.providers);
      setHealth(data.jobHealth);
    } catch (error) {
      setFeedback(formatAdminError(error));
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
      await apiPost("/api/admin/ocr-providers", {
        action: "upsert",
        slug,
        displayName,
        adapterKey,
        endpointUrl: endpointUrl || undefined,
        secretRef: secretRef || undefined,
        model,
        region,
        maxPages: Number(maxPages),
        timeoutMs: Number(timeoutMs),
        monthlyPageCap: Number(monthlyPageCap),
        monthlySpendCapIdr,
        estimatedCostPerPageIdr,
        retentionPolicy,
        processorNotice,
        vendorApproved,
        enabled,
      });
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatAdminError(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.adminTitle}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t.adminIntro}
        </p>
      </header>

      <section className="rounded-lg border p-5 text-sm">
        <h2 className="font-semibold">{t.jobHealthTitle}</h2>
        <div className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
          {Object.entries(health).length === 0 ? (
            <span>0</span>
          ) : (
            Object.entries(health).map(([k, v]) => (
              <span key={k}>
                {k}: {v}
              </span>
            ))
          )}
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

      {providers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-3 font-semibold">Slug</th>
                <th className="p-3 font-semibold">{t.adapterKeyLabel}</th>
                <th className="p-3 font-semibold">{t.modelLabel}</th>
                <th className="p-3 font-semibold">{t.regionLabel}</th>
                <th className="p-3 font-semibold">{t.secretRefLabel}</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {providers.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-mono font-medium">{p.slug}</td>
                  <td className="p-3 font-mono">{p.adapterKey}</td>
                  <td className="p-3 font-mono">{p.model}</td>
                  <td className="p-3 font-mono">{p.region}</td>
                  <td className="p-3 font-mono">
                    {p.secretRef
                      ? `${p.secretRef} (${p.secretConfigured ? t.secretReady : t.secretMissing})`
                      : t.noSecretNeeded}
                  </td>
                  <td className="p-3">
                    <StatusBadge active={p.enabled && p.vendorApproved}>
                      {p.enabled && p.vendorApproved ? "ACTIVE" : "BLOCKED"}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">{t.upsertProvider}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t.slugLabel}
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
          <Field
            label={t.displayNameLabel}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          <label className="block space-y-2 text-sm font-medium">
            <span>{t.adapterKeyLabel}</span>
            <select
              value={adapterKey}
              onChange={(e) => setAdapterKey(e.target.value as OcrAdapterKey)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              {ocrAdapterKeys.map((k) => (
                <option key={k} value={k}>
                  {t.adapterKeys[k]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t.endpointUrlLabel}
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
          />
          <Field
            label={t.secretRefLabel}
            value={secretRef}
            onChange={(e) => setSecretRef(e.target.value)}
          />
          <Field
            label={t.modelLabel}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
          />
          <Field
            label={t.regionLabel}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            required
          />
          <Field
            label={t.maxPagesLabel}
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
            required
          />
          <Field
            label={t.timeoutMsLabel}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
            required
          />
          <Field
            label={t.monthlyPageCapLabel}
            value={monthlyPageCap}
            onChange={(e) => setMonthlyPageCap(e.target.value)}
            required
          />
          <Field
            label={t.monthlySpendCapLabel}
            value={monthlySpendCapIdr}
            onChange={(e) => setMonthlySpendCapIdr(e.target.value)}
            required
          />
          <Field
            label={t.costPerPageLabel}
            value={estimatedCostPerPageIdr}
            onChange={(e) => setEstimatedCostPerPageIdr(e.target.value)}
            required
          />
          <label className="block space-y-2 text-sm font-medium">
            <span>{t.retentionPolicyLabel}</span>
            <select
              value={retentionPolicy}
              onChange={(e) => setRetentionPolicy(e.target.value)}
              className="min-h-11 w-full rounded-md border bg-background px-3"
            >
              <option value="ZERO_RETENTION_REQUIRED">
                ZERO_RETENTION_REQUIRED
              </option>
              <option value="EPHEMERAL_PROCESSING_ONLY">
                EPHEMERAL_PROCESSING_ONLY
              </option>
              <option value="LOCAL_ONLY">LOCAL_ONLY</option>
            </select>
          </label>
        </div>
        <Field
          label={t.processorNoticeLabel}
          value={processorNotice}
          onChange={(e) => setProcessorNotice(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vendorApproved}
            onChange={(e) => setVendorApproved(e.target.checked)}
          />
          <span>{t.vendorApprovedLabel}</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          <span>{t.enabledLabel}</span>
        </label>
        <Submit busy={busy}>{t.upsertProvider}</Submit>
      </form>
    </div>
  );
}
