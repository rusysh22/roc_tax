"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck, CreditCard, RefreshCw, Save } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { adminMessages } from "@/i18n/admin";
import { billingMessages } from "@/i18n/billing";
import { codeOptions } from "@/i18n/codes";
import { formatDate } from "@/i18n/format";
import { viewMessages } from "@/i18n/views";
import {
  billingAdapterModes,
  type BillingAdapterMode,
} from "@/lib/billing/schemas";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Combobox } from "@/components/ui/combobox";
import {
  Checkbox,
  FormField,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { Badge, Notice, Skeleton } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { comboLabels } from "@/components/views/page-state";
import { PagedFooter, usePaged } from "@/components/views/paged";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";

type CatalogPlan = {
  slug?: string;
  name?: string;
  price?: string | number;
  currency?: string;
  interval?: string;
};
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
    catalogSnapshot: CatalogPlan[] | null;
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

function SecretState({
  configured,
  labels,
}: {
  configured: boolean;
  labels: { ok: string; missing: string };
}) {
  return configured ? (
    <Badge tone="green" dot>
      {labels.ok}
    </Badge>
  ) : (
    <Badge tone="amber" dot>
      {labels.missing}
    </Badge>
  );
}

export function AdminBillingView({ locale }: { locale: Locale }) {
  const t = billingMessages[locale];
  const a = adminMessages[locale];
  const v = viewMessages[locale];
  const [data, setData] = useState<AdminBillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [form, setForm] = useState({
    adapterMode: "NOT_CONFIGURED" as BillingAdapterMode,
    apiBaseUrl: "",
    productSlug: "",
    storefrontUrl: "",
    productSecretRef: "",
    webhookSecretRef: "",
    ed25519PublicKey: "",
    saasLicensingApproved: false,
    compatibilityNote: "",
  });
  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }));
  const webhooksPage = usePaged(data?.webhookHealth.recent ?? []);

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
      const c = payload.config;
      if (c)
        setForm({
          adapterMode: c.adapterMode,
          apiBaseUrl: c.apiBaseUrl ?? "",
          productSlug: c.productSlug ?? "",
          storefrontUrl: c.storefrontUrl ?? "",
          productSecretRef: c.productSecretRef ?? "",
          webhookSecretRef: c.webhookSecretRef ?? "",
          ed25519PublicKey: c.ed25519PublicKey ?? "",
          saasLicensingApproved: c.saasLicensingApproved,
          compatibilityNote: c.compatibilityNote ?? "",
        });
    } catch (error) {
      setFeedback({ ok: false, text: formatErr(error) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(body: unknown, okText: string) {
    setBusy(true);
    setFeedback(null);
    try {
      await apiPost("/api/admin/billing", body);
      await load();
      setFeedback({ ok: true, text: okText });
    } catch (error) {
      setFeedback({ ok: false, text: formatErr(error) });
    } finally {
      setBusy(false);
    }
  }

  function onSave(event: FormEvent) {
    event.preventDefault();
    void run(
      {
        action: "configure",
        adapterMode: form.adapterMode,
        apiBaseUrl: form.apiBaseUrl.trim() || null,
        productSlug: form.productSlug.trim() || null,
        storefrontUrl: form.storefrontUrl.trim() || null,
        productSecretRef: form.productSecretRef.trim() || null,
        webhookSecretRef: form.webhookSecretRef.trim() || null,
        ed25519PublicKey: form.ed25519PublicKey.trim() || null,
        saasLicensingApproved: form.saasLicensingApproved,
        compatibilityNote: form.compatibilityNote.trim(),
      },
      t.configSavedOk,
    );
  }

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  const c = data?.config ?? null;
  const health = data?.webhookHealth;
  const secretLabels = { ok: a.secretReady, missing: a.secretMissing };
  const catalog = (c?.catalogSnapshot ?? []) as CatalogPlan[];

  const configTab = (
    <form onSubmit={onSave} className="space-y-8">
      <Section title={a.connectionTitle} intro={a.connectionIntro}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            field="billing.adapterMode"
            label={t.adapterModeLabel}
            required
          >
            <Combobox
              value={form.adapterMode}
              onChange={(value) =>
                value && set({ adapterMode: value as BillingAdapterMode })
              }
              options={codeOptions(locale, "billingMode", billingAdapterModes)}
              labels={comboLabels(locale)}
            />
          </FormField>
          <FormField field="billing.apiBaseUrl" label={t.apiBaseUrlLabel}>
            <TextInput
              type="url"
              value={form.apiBaseUrl}
              onChange={(e) => set({ apiBaseUrl: e.target.value })}
            />
          </FormField>
          <FormField field="billing.productSlug" label={t.productSlugLabel}>
            <TextInput
              value={form.productSlug}
              onChange={(e) => set({ productSlug: e.target.value })}
              className="font-mono"
            />
          </FormField>
          <FormField field="billing.storefrontUrl" label={t.storefrontUrlLabel}>
            <TextInput
              type="url"
              value={form.storefrontUrl}
              onChange={(e) => set({ storefrontUrl: e.target.value })}
            />
          </FormField>
        </div>
      </Section>

      <Section title={a.secretsTitle} intro={a.secretsIntro}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            field="billing.productSecretRef"
            label={t.productSecretRefLabel}
          >
            <div className="space-y-1.5">
              <TextInput
                value={form.productSecretRef}
                onChange={(e) => set({ productSecretRef: e.target.value })}
                className="font-mono"
              />
              {c?.productSecretRef && (
                <SecretState
                  configured={c.productSecretConfigured}
                  labels={secretLabels}
                />
              )}
            </div>
          </FormField>
          <FormField
            field="billing.webhookSecretRef"
            label={t.webhookSecretRefLabel}
          >
            <div className="space-y-1.5">
              <TextInput
                value={form.webhookSecretRef}
                onChange={(e) => set({ webhookSecretRef: e.target.value })}
                className="font-mono"
              />
              {c?.webhookSecretRef && (
                <SecretState
                  configured={c.webhookSecretConfigured}
                  labels={secretLabels}
                />
              )}
            </div>
          </FormField>
        </div>
      </Section>

      <Section title={a.verificationTitle} intro={a.verificationIntro}>
        <FormField field="billing.ed25519Key" label={t.ed25519KeyLabel}>
          <TextArea
            value={form.ed25519PublicKey}
            onChange={(e) => set({ ed25519PublicKey: e.target.value })}
            rows={4}
            className="font-mono text-xs"
          />
        </FormField>
      </Section>

      <Section title={a.approvalTitle} intro={a.approvalIntro}>
        <Checkbox
          label={t.saasApprovedLabel}
          checked={form.saasLicensingApproved}
          onChange={(e) => set({ saasLicensingApproved: e.target.checked })}
        />
        <FormField
          field="billing.compatibilityNote"
          label={t.compatibilityNoteLabel}
        >
          <TextArea
            value={form.compatibilityNote}
            onChange={(e) => set({ compatibilityNote: e.target.value })}
            rows={3}
          />
        </FormField>
      </Section>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={busy}>
          <Save aria-hidden="true" />
          <span>{t.saveConfigButton}</span>
        </Button>
      </div>
    </form>
  );

  const webhookTab = (
    <Section title={a.webhookTitle} intro={a.webhookIntro}>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [v.total, health?.total ?? 0, ""],
          [a.webhookValid, health?.valid ?? 0, "text-success-fg"],
          [
            a.webhookRejected,
            health?.rejected ?? 0,
            (health?.rejected ?? 0) > 0 ? "text-danger-fg" : "",
          ],
        ].map(([label, value, tone]) => (
          <div
            key={String(label)}
            className="rounded-lg border bg-surface-2 px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p
              className={`mt-1 font-mono text-2xl font-bold tabular-nums ${tone}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
      {webhooksPage.total === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {a.noWebhooks}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {a.webhookReceived}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {a.webhookEvent}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {a.webhookStatus}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {webhooksPage.rows.map((evt) => (
                  <tr key={evt.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatDate(new Date(evt.receivedAt), locale)}
                    </td>
                    <td className="px-3 py-2.5">
                      {/* Provider event identifiers are shown as-is for support (ui-standards-allow: provider ids). */}
                      <p className="font-mono text-xs">{evt.eventType}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {evt.eventId}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      {evt.signatureValid ? (
                        <Badge tone="green" dot>
                          <CircleCheck aria-hidden="true" className="size-3" />
                          {a.webhookValid}
                        </Badge>
                      ) : (
                        <Badge tone="red" dot>
                          {a.webhookRejected}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PagedFooter paged={webhooksPage} v={v} />
        </div>
      )}
    </Section>
  );

  const catalogTab = (
    <Section
      title={a.catalogTitle}
      intro={
        c?.catalogFetchedAt
          ? formatDate(new Date(c.catalogFetchedAt), locale)
          : undefined
      }
    >
      <div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run({ action: "fetch_catalog" }, t.catalogFetchedOk)
          }
        >
          <RefreshCw aria-hidden="true" />
          <span>{t.fetchCatalogButton}</span>
        </Button>
      </div>
      {catalog.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {a.noCatalog}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {catalog.map((plan, i) => (
            <div
              key={plan.slug ?? i}
              className="space-y-1 rounded-lg border p-4"
            >
              <p className="font-semibold">{plan.name ?? plan.slug}</p>
              <p className="font-mono text-lg font-bold">
                {plan.currency === "IDR" && plan.price !== undefined
                  ? formatAmountString(Number(plan.price).toFixed(2), locale)
                  : `${plan.currency ?? ""} ${plan.price ?? ""}`}
                {plan.interval && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {" "}
                    / {plan.interval}
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </Section>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{a.billingTitle}</h1>
        <p className="text-sm text-muted-foreground">{a.billingIntro}</p>
      </div>
      {feedback && (
        <Notice tone={feedback.ok ? "success" : "danger"} role="status">
          {feedback.text}
        </Notice>
      )}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-surface p-5 shadow-xs">
        <span className="flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning-fg">
          <CreditCard aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">{a.stateTitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <CodeBadge
              domain="billingMode"
              code={c?.adapterMode ?? "NOT_CONFIGURED"}
            />
            <Badge tone={c?.saasLicensingApproved ? "green" : "amber"} dot>
              {c?.saasLicensingApproved ? a.approved : a.notApproved}
            </Badge>
            {c?.updatedAt && (
              <span className="text-xs text-muted-foreground">
                {formatDate(new Date(c.updatedAt), locale)}
              </span>
            )}
          </div>
        </div>
      </div>
      <fieldset
        disabled={busy}
        className="min-w-0 rounded-xl border bg-surface p-4 shadow-xs sm:p-6"
      >
        <Tabs
          label={a.billingTitle}
          items={[
            { id: "config", label: a.connectionTitle, content: configTab },
            {
              id: "webhooks",
              label: a.webhookTitle,
              badge: health?.rejected || undefined,
              content: webhookTab,
            },
            { id: "catalog", label: a.catalogTitle, content: catalogTab },
          ]}
        />
      </fieldset>
    </div>
  );
}
