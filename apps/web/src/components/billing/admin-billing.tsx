"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { billingMessages } from "@/i18n/billing";
import { formatDate } from "@/i18n/format";
import {
  billingAdapterModes,
  type BillingAdapterMode,
} from "@/lib/billing/schemas";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type AdminBillingPayload = {
  config: {
    adapterMode: BillingAdapterMode;
    apiBaseUrl: string | null;
    productSlug: string | null;
    storefrontUrl: string | null;
    productSecretRef: string | null;
    productSecretConfigured: boolean;
    webhookSecretRef: string | null;
    webhookSecretConfigured: boolean;
    ed25519PublicKey: string | null;
    saasLicensingApproved: boolean;
    compatibilityNote: string;
    catalogSnapshot: unknown[] | null;
    catalogFetchedAt: string | null;
    updatedAt: string;
  } | null;
  webhookHealth: {
    total: number;
    valid: number;
    rejected: number;
    recent: {
      id: string;
      eventId: string;
      eventType: string;
      signatureValid: boolean;
      status: string;
      errorCode: string | null;
      receivedAt: string;
    }[];
  };
};

export function AdminBillingView({ locale }: { locale: Locale }) {
  const t = billingMessages[locale];
  const [data, setData] = useState<AdminBillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [adapterMode, setAdapterMode] =
    useState<BillingAdapterMode>("NOT_CONFIGURED");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [storefrontUrl, setStorefrontUrl] = useState("");
  const [productSecretRef, setProductSecretRef] = useState("");
  const [webhookSecretRef, setWebhookSecretRef] = useState("");
  const [ed25519PublicKey, setEd25519PublicKey] = useState("");
  const [saasLicensingApproved, setSaasLicensingApproved] = useState(false);
  const [compatibilityNote, setCompatibilityNote] = useState("");

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
      const payload = await apiGet<AdminBillingPayload>("/api/admin/billing");
      setData(payload);
      if (payload.config) {
        setAdapterMode(payload.config.adapterMode);
        setApiBaseUrl(payload.config.apiBaseUrl ?? "");
        setProductSlug(payload.config.productSlug ?? "");
        setStorefrontUrl(payload.config.storefrontUrl ?? "");
        setProductSecretRef(payload.config.productSecretRef ?? "");
        setWebhookSecretRef(payload.config.webhookSecretRef ?? "");
        setEd25519PublicKey(payload.config.ed25519PublicKey ?? "");
        setSaasLicensingApproved(payload.config.saasLicensingApproved);
        setCompatibilityNote(payload.config.compatibilityNote ?? "");
      }
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/admin/billing", {
        action: "configure",
        adapterMode,
        apiBaseUrl: apiBaseUrl.trim() || null,
        productSlug: productSlug.trim() || null,
        storefrontUrl: storefrontUrl.trim() || null,
        productSecretRef: productSecretRef.trim() || null,
        webhookSecretRef: webhookSecretRef.trim() || null,
        ed25519PublicKey: ed25519PublicKey.trim() || null,
        saasLicensingApproved,
        compatibilityNote: compatibilityNote.trim(),
      });
      await load();
      setFeedback(t.configSavedOk);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setBusy(false);
    }
  }

  async function onFetchCatalog() {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/admin/billing", { action: "fetch_catalog" });
      await load();
      setFeedback(t.catalogFetchedOk);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-44 w-full" />;

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t.adminTitle}</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          {t.adminIntro}
        </p>
      </div>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-4 text-sm"
        >
          {feedback}
        </p>
      )}

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-lg border p-6 text-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 font-medium">
            {t.adapterModeLabel}
            <select
              value={adapterMode}
              onChange={(e) =>
                setAdapterMode(e.target.value as BillingAdapterMode)
              }
              className="field-control w-auto"
            >
              {billingAdapterModes.map((m) => (
                <option key={m} value={m}>
                  {t.modes[m]}
                </option>
              ))}
            </select>
          </label>
          <Field
            label={t.apiBaseUrlLabel}
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
          />
          <Field
            label={t.productSlugLabel}
            value={productSlug}
            onChange={(e) => setProductSlug(e.target.value)}
          />
          <Field
            label={t.storefrontUrlLabel}
            value={storefrontUrl}
            onChange={(e) => setStorefrontUrl(e.target.value)}
          />
          <Field
            label={t.productSecretRefLabel}
            value={productSecretRef}
            onChange={(e) => setProductSecretRef(e.target.value)}
          />
          <Field
            label={t.webhookSecretRefLabel}
            value={webhookSecretRef}
            onChange={(e) => setWebhookSecretRef(e.target.value)}
          />
        </div>

        <Field
          label={t.ed25519KeyLabel}
          value={ed25519PublicKey}
          onChange={(e) => setEd25519PublicKey(e.target.value)}
        />
        <Field
          label={t.compatibilityNoteLabel}
          value={compatibilityNote}
          onChange={(e) => setCompatibilityNote(e.target.value)}
        />

        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={saasLicensingApproved}
            onChange={(e) => setSaasLicensingApproved(e.target.checked)}
          />
          <span>{t.saasApprovedLabel}</span>
        </label>

        <div className="flex flex-wrap gap-3">
          <Submit busy={busy}>{t.saveConfigButton}</Submit>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void onFetchCatalog()}
          >
            {t.fetchCatalogButton}
          </Button>
        </div>
      </form>

      {data && (
        <section className="space-y-3 rounded-lg border p-6 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t.webhookHealthTitle}</h2>
            <StatusBadge>
              total={data.webhookHealth.total} · valid=
              {data.webhookHealth.valid} · rejected=
              {data.webhookHealth.rejected}
            </StatusBadge>
          </div>
          {data.webhookHealth.recent.length > 0 && (
            <ul className="space-y-1 font-mono">
              {data.webhookHealth.recent.map((evt) => (
                <li key={evt.id}>
                  {evt.eventType} · {evt.eventId} · {evt.status} ·{" "}
                  {formatDate(new Date(evt.receivedAt), locale)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
