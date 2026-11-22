"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Power, PowerOff, ScanText } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { ocrMessages } from "@/i18n/ocr";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { ocrAdapterKeys, type OcrAdapterKey } from "@/lib/intake/ocr";
import { Combobox } from "@/components/ui/combobox";
import {
  Checkbox,
  FieldGroup,
  FormField,
  ReadValue,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { MenuItem } from "@/components/ui/menu";
import { Badge, Notice } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { FormBody, FormPage, SheetTitle } from "@/components/views/form-view";
import { ListPage, type ListAction } from "@/components/views/list-page";
import { comboLabels } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { Preset, ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
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
type Payload = { providers: ProviderItem[]; jobHealth: Record<string, number> };

function providerError(error: unknown, locale: Locale) {
  if (error instanceof ApiFailure) {
    const map = ocrMessages[locale].errors as Record<string, string>;
    if (map[error.code]) return map[error.code];
  }
  return formatFailure(error, locale);
}

function toCommand(p: Omit<ProviderItem, "id" | "secretConfigured">) {
  return {
    action: "upsert",
    slug: p.slug,
    displayName: p.displayName,
    adapterKey: p.adapterKey,
    endpointUrl: p.endpointUrl || undefined,
    secretRef: p.secretRef || undefined,
    model: p.model,
    region: p.region,
    maxPages: Number(p.maxPages),
    timeoutMs: Number(p.timeoutMs),
    monthlyPageCap: Number(p.monthlyPageCap),
    monthlySpendCapIdr: p.monthlySpendCapIdr,
    estimatedCostPerPageIdr: p.estimatedCostPerPageIdr,
    retentionPolicy: p.retentionPolicy,
    processorNotice: p.processorNotice,
    vendorApproved: p.vendorApproved,
    enabled: p.enabled,
  };
}

const setEnabled = (p: ProviderItem, enabled: boolean) =>
  apiPost("/api/admin/ocr-providers", toCommand({ ...p, enabled }));

export function OcrProvidersList({ locale }: { locale: Locale }) {
  const t = ocrMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const { data, reload } = useResource(() =>
    apiGet<Payload>("/api/admin/ocr-providers"),
  );
  const fields = useMemo<ViewField<ProviderItem>[]>(
    () => [
      {
        name: "displayName",
        label: t.displayNameLabel,
        type: "text",
        value: (p) => p.displayName,
        searchable: true,
        sortable: true,
      },
      {
        name: "slug",
        label: t.slugLabel,
        type: "text",
        value: (p) => p.slug,
        searchable: true,
      },
      {
        name: "adapterKey",
        label: t.adapterKeyLabel,
        type: "enum",
        value: (p) => p.adapterKey,
        display: (p) => t.adapterKeys[p.adapterKey],
        filterable: true,
        groupable: true,
      },
      {
        name: "region",
        label: t.regionLabel,
        type: "enum",
        value: (p) => p.region,
        filterable: true,
      },
      {
        name: "vendorApproved",
        label: t.vendorApprovedLabel,
        type: "enum",
        value: (p) => (p.vendorApproved ? "yes" : "no"),
        options: [
          { value: "yes", label: v.yes },
          { value: "no", label: v.no },
        ],
        filterable: true,
      },
    ],
    [t, v],
  );
  const presets = useMemo<Preset<ProviderItem>[]>(
    () => [
      {
        id: "enabled",
        label: t.enabledLabel,
        group: "state",
        predicate: (p) => p.enabled,
      },
      {
        id: "disabled",
        label: v.archived,
        group: "state",
        predicate: (p) => !p.enabled,
      },
    ],
    [t, v],
  );
  const columns: Column<ProviderItem>[] = [
    {
      key: "name",
      header: t.displayNameLabel,
      sortField: "displayName",
      primary: true,
      cell: (p) => p.displayName,
    },
    {
      key: "slug",
      header: t.slugLabel,
      cell: (p) => <span className="font-mono text-xs">{p.slug}</span>,
      hideBelow: "lg",
    },
    {
      key: "adapter",
      header: t.adapterKeyLabel,
      cell: (p) => <span className="font-mono text-xs">{p.adapterKey}</span>,
    },
    {
      key: "secret",
      header: t.secretRefLabel,
      cell: (p) =>
        p.secretRef
          ? p.secretConfigured
            ? t.secretReady
            : t.secretMissing
          : t.noSecretNeeded,
      hideBelow: "xl",
    },
    {
      key: "state",
      header: t.enabledLabel,
      cell: (p) =>
        p.enabled ? (
          <Badge tone="solid" dot>
            {v.active}
          </Badge>
        ) : (
          <Badge tone="muted">{v.archived}</Badge>
        ),
    },
  ];
  const actions: ListAction<ProviderItem>[] = [
    {
      id: "disable",
      label: v.archive,
      icon: <PowerOff />,
      visible: (rows) => rows.some((p) => p.enabled),
      run: async (rows) => {
        try {
          for (const p of rows.filter((r) => r.enabled))
            await setEnabled(p, false);
          return v.archivedDone;
        } catch (error) {
          throw new Error(providerError(error, locale), { cause: error });
        }
      },
    },
    {
      id: "enable",
      label: v.unarchive,
      icon: <Power />,
      visible: (rows) => rows.some((p) => !p.enabled),
      run: async (rows) => {
        try {
          for (const p of rows.filter((r) => !r.enabled))
            await setEnabled(p, true);
          return v.unarchivedDone;
        } catch (error) {
          throw new Error(providerError(error, locale), { cause: error });
        }
      },
    },
  ];
  const health = data?.jobHealth ?? {};
  return (
    <ListPage
      locale={locale}
      title={s.menuOcrProviders}
      model="ocr-providers"
      fields={fields}
      presets={presets}
      columns={columns}
      records={data?.providers ?? null}
      getId={(p) => p.id}
      href={(p) => `/${locale}/admin/ocr-providers/${p.id}`}
      rowLabel={(p) => p.displayName}
      createHref={`/${locale}/admin/ocr-providers/new`}
      actions={actions}
      onActionDone={reload}
      emptyIcon={<ScanText />}
      banner={
        <div className="space-y-3">
          <Notice>{t.adminIntro}</Notice>
          {Object.keys(health).length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="font-semibold">{t.jobHealthTitle}:</span>
              {Object.entries(health).map(([status, count]) => (
                <Badge key={status} tone="outline">
                  {status} · {count}
                </Badge>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}

const blank: Omit<ProviderItem, "id" | "secretConfigured"> = {
  slug: "",
  displayName: "",
  adapterKey: "SYNTHETIC_TEST",
  endpointUrl: "",
  secretRef: "",
  model: "",
  region: "id-jakarta",
  maxPages: 10,
  timeoutMs: 15000,
  monthlyPageCap: 500,
  monthlySpendCapIdr: "0.00",
  estimatedCostPerPageIdr: "0.00",
  retentionPolicy: "ZERO_RETENTION_REQUIRED",
  processorNotice: "",
  vendorApproved: false,
  enabled: false,
};

export function OcrProviderForm({
  locale,
  providerId,
}: {
  locale: Locale;
  providerId: string | null;
}) {
  const t = ocrMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const creating = providerId === null;
  const { data, reload } = useResource(
    () => apiGet<Payload>("/api/admin/ocr-providers"),
    [providerId],
  );
  const record = data?.providers.find((p) => p.id === providerId) ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof blank>) =>
    setDraft((d) => ({ ...d, ...patch }));
  const mode = creating ? "create" : editing ? "edit" : "read";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/admin/ocr-providers", toCommand(draft));
      toast.success(t.saved);
      if (creating) router.replace(`/${locale}/admin/ocr-providers`);
      else {
        await reload();
        setEditing(false);
      }
    } catch (failure) {
      setError(providerError(failure, locale));
    } finally {
      setSaving(false);
    }
  }

  const textField = (
    key: keyof typeof blank,
    label: string,
    props: Record<string, unknown> = {},
  ) => (
    <FormField label={label} layout="inline">
      <TextInput
        value={String(draft[key] ?? "")}
        onChange={(e) =>
          set({ [key]: e.target.value } as Partial<typeof blank>)
        }
        {...props}
      />
    </FormField>
  );
  const readField = (label: string, value: React.ReactNode, mono = false) => (
    <FormField label={label} layout="inline">
      <ReadValue mono={mono}>{value}</ReadValue>
    </FormField>
  );

  return (
    <FormPage
      locale={locale}
      model="ocr-providers"
      breadcrumbs={[
        { label: s.menuOcrProviders, href: `/${locale}/admin/ocr-providers` },
        {
          label: creating
            ? v.new
            : (record?.displayName ?? (data ? v.notFound : "…")),
        },
      ]}
      recordId={providerId ?? undefined}
      hrefFor={(id) => `/${locale}/admin/ocr-providers/${id}`}
      mode={mode}
      dirty={
        creating
          ? draft.slug !== ""
          : JSON.stringify(draft) !== JSON.stringify(record)
      }
      saving={saving}
      canEdit={Boolean(record)}
      onEdit={() => {
        if (!record) return;
        const { id: _id, secretConfigured: _s, ...rest } = record;
        void _id;
        void _s;
        setDraft({
          ...rest,
          endpointUrl: rest.endpointUrl ?? "",
          secretRef: rest.secretRef ?? "",
        });
        setEditing(true);
      }}
      onDiscard={() =>
        creating
          ? router.push(`/${locale}/admin/ocr-providers`)
          : setEditing(false)
      }
      ribbon={record && !record.enabled ? v.archived : undefined}
      loading={!creating && data === null}
      gear={
        record
          ? (close) => (
              <MenuItem
                icon={record.enabled ? <PowerOff /> : <Power />}
                onSelect={async () => {
                  close();
                  try {
                    await setEnabled(record, !record.enabled);
                    await reload();
                    toast.success(
                      record.enabled ? v.archivedDone : v.unarchivedDone,
                    );
                  } catch (failure) {
                    toast.error(providerError(failure, locale));
                  }
                }}
              >
                {record.enabled ? v.archive : v.unarchive}
              </MenuItem>
            )
          : undefined
      }
    >
      {!creating && data && !record ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : mode === "read" && record ? (
        <div className="space-y-8">
          <SheetTitle
            label={t.displayNameLabel}
            aside={
              record.enabled ? (
                <Badge tone="solid" dot>
                  {v.active}
                </Badge>
              ) : (
                <Badge tone="muted">{v.archived}</Badge>
              )
            }
          >
            {record.displayName}
          </SheetTitle>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              {readField(t.slugLabel, record.slug, true)}
              {readField(t.adapterKeyLabel, t.adapterKeys[record.adapterKey])}
              {readField(t.endpointUrlLabel, record.endpointUrl, true)}
              {readField(
                t.secretRefLabel,
                record.secretRef
                  ? `${record.secretRef} · ${record.secretConfigured ? t.secretReady : t.secretMissing}`
                  : t.noSecretNeeded,
                true,
              )}
              {readField(t.modelLabel, record.model, true)}
              {readField(t.regionLabel, record.region, true)}
            </FieldGroup>
            <FieldGroup title={t.monthlyPageCapLabel}>
              {readField(t.maxPagesLabel, record.maxPages)}
              {readField(t.timeoutMsLabel, record.timeoutMs)}
              {readField(t.monthlyPageCapLabel, record.monthlyPageCap)}
              {readField(
                t.monthlySpendCapLabel,
                record.monthlySpendCapIdr,
                true,
              )}
              {readField(
                t.costPerPageLabel,
                record.estimatedCostPerPageIdr,
                true,
              )}
              {readField(t.retentionPolicyLabel, record.retentionPolicy, true)}
              {readField(
                t.vendorApprovedLabel,
                record.vendorApproved ? v.yes : v.no,
              )}
            </FieldGroup>
          </div>
          {record.processorNotice && (
            <Notice title={t.processorNoticeLabel}>
              {record.processorNotice}
            </Notice>
          )}
        </div>
      ) : (
        <FormBody
          model="ocr-providers"
          onSubmit={() => void save()}
          disabled={saving}
        >
          {error && (
            <Notice tone="strong" role="alert">
              {error}
            </Notice>
          )}
          <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              {textField("slug", t.slugLabel, {
                maxLength: 60,
                className: "font-mono",
                readOnly: !creating,
                autoFocus: creating,
              })}
              {textField("displayName", t.displayNameLabel, { maxLength: 120 })}
              <FormField label={t.adapterKeyLabel} layout="inline">
                <Combobox
                  value={draft.adapterKey}
                  onChange={(value) =>
                    value && set({ adapterKey: value as OcrAdapterKey })
                  }
                  options={ocrAdapterKeys.map((k) => ({
                    value: k,
                    label: t.adapterKeys[k],
                  }))}
                  labels={comboLabels(locale)}
                />
              </FormField>
              {textField("endpointUrl", t.endpointUrlLabel, {
                maxLength: 300,
                type: "url",
              })}
              {textField("secretRef", t.secretRefLabel, {
                maxLength: 64,
                className: "font-mono",
              })}
              {textField("model", t.modelLabel, { maxLength: 80 })}
              {textField("region", t.regionLabel, { maxLength: 40 })}
            </FieldGroup>
            <FieldGroup title={t.monthlyPageCapLabel}>
              {textField("maxPages", t.maxPagesLabel, {
                type: "number",
                min: 1,
              })}
              {textField("timeoutMs", t.timeoutMsLabel, {
                type: "number",
                min: 1000,
              })}
              {textField("monthlyPageCap", t.monthlyPageCapLabel, {
                type: "number",
                min: 0,
              })}
              {textField("monthlySpendCapIdr", t.monthlySpendCapLabel, {
                className: "font-mono",
              })}
              {textField("estimatedCostPerPageIdr", t.costPerPageLabel, {
                className: "font-mono",
              })}
              {textField("retentionPolicy", t.retentionPolicyLabel, {
                maxLength: 60,
                className: "font-mono",
              })}
            </FieldGroup>
          </div>
          <FormField label={t.processorNoticeLabel}>
            <TextArea
              value={draft.processorNotice}
              onChange={(e) => set({ processorNotice: e.target.value })}
              maxLength={1000}
              rows={3}
            />
          </FormField>
          <div className="flex flex-col gap-2.5">
            <Checkbox
              label={t.vendorApprovedLabel}
              checked={draft.vendorApproved}
              onChange={(e) => set({ vendorApproved: e.target.checked })}
            />
            <Checkbox
              label={t.enabledLabel}
              checked={draft.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
          </div>
        </FormBody>
      )}
    </FormPage>
  );
}
