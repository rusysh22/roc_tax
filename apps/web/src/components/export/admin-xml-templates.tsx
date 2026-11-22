"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, BadgeCheck, Workflow } from "lucide-react";
import { codeLabel, codeOptions } from "@/i18n/codes";
import { CodeBadge } from "@/components/ui/code-badge";
import type { Locale } from "@/i18n/messages";
import { exportMessages } from "@/i18n/exports";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { allTaxFamilies } from "@/lib/intake/tax-rules";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Checkbox,
  FieldGroup,
  FormField,
  ReadValue,
  TextInput,
} from "@/components/ui/field";
import { MenuItem } from "@/components/ui/menu";
import { Notice } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import {
  FormBody,
  FormPage,
  SheetTitle,
  StatusBar,
} from "@/components/views/form-view";
import { ListPage, archivedPreset } from "@/components/views/list-page";
import { comboLabels } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type XmlTemplateStatus = "UNVERIFIED" | "VERIFIED" | "RETIRED";
type TemplateRow = {
  id: string;
  taxFamily: string;
  versionTag: string;
  sourceUrl: string;
  sourceLabel: string;
  sourcePublishedAt: string | null;
  sourceSha256: string;
  referenceUrl: string | null;
  referenceSha256: string | null;
  xsdSchemaHash: string;
  status: XmlTemplateStatus;
  fixtureVerified: boolean;
  notes: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

function templateError(error: unknown, locale: Locale) {
  if (error instanceof ApiFailure) {
    const map = exportMessages[locale].errors as Record<string, string>;
    if (map[error.code]) return map[error.code];
  }
  return formatFailure(error, locale);
}

const statusLabel = (locale: Locale, status: XmlTemplateStatus) =>
  codeLabel(locale, "xmlTemplateStatus", status);

function StatusPill({
  status,
}: {
  locale?: Locale;
  status: XmlTemplateStatus;
}) {
  return <CodeBadge domain="xmlTemplateStatus" code={status} />;
}

const setStatus = (templateId: string, status: XmlTemplateStatus) =>
  apiPost("/api/admin/xml-templates", {
    action: "set_status",
    templateId,
    status,
  });

export function XmlTemplatesList({ locale }: { locale: Locale }) {
  const t = exportMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const { data, reload } = useResource(() =>
    apiGet<{ templates: TemplateRow[] }>("/api/admin/xml-templates"),
  );
  const isArchived = (r: TemplateRow) => r.status === "RETIRED";
  const archive = useMemo(() => archivedPreset(locale, isArchived), [locale]);
  const fields = useMemo<ViewField<TemplateRow>[]>(
    () => [
      {
        name: "versionTag",
        label: t.versionTagLabel,
        type: "text",
        value: (r) => r.versionTag,
        searchable: true,
        sortable: true,
      },
      {
        name: "sourceLabel",
        label: t.sourceLabelField,
        type: "text",
        value: (r) => r.sourceLabel,
        searchable: true,
      },
      {
        name: "taxFamily",
        label: t.familyLabel,
        type: "enum",
        value: (r) => r.taxFamily,
        display: (r) => codeLabel(locale, "taxFamily", r.taxFamily),
        options: codeOptions(locale, "taxFamily", allTaxFamilies),
        filterable: true,
        groupable: true,
      },
      {
        name: "status",
        label: t.familyStatusTitle,
        type: "enum",
        value: (r) => r.status,
        display: (r) => statusLabel(locale, r.status),
        options: (["UNVERIFIED", "VERIFIED", "RETIRED"] as const).map((st) => ({
          value: st,
          label: statusLabel(locale, st),
        })),
        filterable: true,
        groupable: true,
      },
      {
        name: "createdAt",
        label: v.from,
        type: "date",
        value: (r) => r.createdAt,
        filterable: true,
        sortable: true,
      },
    ],
    [t, v, locale],
  );
  const columns: Column<TemplateRow>[] = [
    {
      key: "tag",
      header: t.versionTagLabel,
      sortField: "versionTag",
      primary: true,
      cell: (r) => <span className="font-mono">{r.versionTag}</span>,
    },
    {
      key: "family",
      header: t.familyLabel,
      cell: (r) => (
        <span className="text-xs">
          {codeLabel(locale, "taxFamily", r.taxFamily)}
        </span>
      ),
    },
    {
      key: "label",
      header: t.sourceLabelField,
      cell: (r) => (
        <span className="line-clamp-2 text-xs">{r.sourceLabel}</span>
      ),
      hideBelow: "lg",
    },
    {
      key: "fixture",
      header: t.fixtureVerifiedLabel,
      cell: (r) => (r.fixtureVerified ? v.yes : v.no),
      hideBelow: "md",
    },
    {
      key: "status",
      header: t.familyStatusTitle,
      cell: (r) => <StatusPill locale={locale} status={r.status} />,
    },
  ];
  return (
    <ListPage
      locale={locale}
      title={s.menuXmlTemplates}
      model="xml-templates"
      fields={fields}
      presets={archive.presets}
      baseline={archive.baseline}
      columns={columns}
      records={data?.templates ?? null}
      getId={(r) => r.id}
      href={(r) => `/${locale}/admin/xml-templates/${r.id}`}
      rowLabel={(r) => r.versionTag}
      createHref={`/${locale}/admin/xml-templates/new`}
      emptyIcon={<Workflow />}
      banner={<Notice>{t.adminIntro}</Notice>}
      actions={[
        {
          id: "retire",
          label: v.archive,
          icon: <Archive />,
          visible: (rows) => rows.some((r) => !isArchived(r)),
          confirm: {
            title: v.confirmArchiveTitle,
            body: v.confirmArchiveBody,
            tone: "warning",
          },
          run: async (rows) => {
            try {
              for (const r of rows.filter((r) => !isArchived(r)))
                await setStatus(r.id, "RETIRED");
              return v.archivedDone;
            } catch (error) {
              throw new Error(templateError(error, locale), { cause: error });
            }
          },
        },
      ]}
      onActionDone={reload}
    />
  );
}

export function XmlTemplateForm({
  locale,
  templateId,
}: {
  locale: Locale;
  templateId: string | null;
}) {
  const t = exportMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const creating = templateId === null;
  const { data, reload } = useResource(
    () => apiGet<{ templates: TemplateRow[] }>("/api/admin/xml-templates"),
    [templateId],
  );
  const record = data?.templates.find((r) => r.id === templateId) ?? null;
  const [draft, setDraft] = useState({
    taxFamily: "PPN_FAKTUR_KELUARAN",
    versionTag: "",
    sourceUrl:
      "https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml",
    sourceLabel: "",
    sourceSha256: "",
    xsdSchemaHash: "",
    fixtureVerified: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof draft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await apiPost("/api/admin/xml-templates", { action: "create", ...draft });
      toast.success(t.templateSaved);
      router.replace(`/${locale}/admin/xml-templates`);
    } catch (failure) {
      setError(templateError(failure, locale));
    } finally {
      setSaving(false);
    }
  }

  async function change(status: XmlTemplateStatus) {
    if (!record) return;
    try {
      await setStatus(record.id, status);
      await reload();
      toast.success(t.templateSaved);
    } catch (failure) {
      toast.error(templateError(failure, locale));
    }
  }

  return (
    <FormPage
      locale={locale}
      model="xml-templates"
      breadcrumbs={[
        { label: s.menuXmlTemplates, href: `/${locale}/admin/xml-templates` },
        {
          label: creating
            ? v.new
            : (record?.versionTag ?? (data ? v.notFound : "…")),
        },
      ]}
      recordId={templateId ?? undefined}
      hrefFor={(id) => `/${locale}/admin/xml-templates/${id}`}
      mode={creating ? "create" : "read"}
      dirty={creating && draft.versionTag !== ""}
      saving={saving}
      onDiscard={() => router.push(`/${locale}/admin/xml-templates`)}
      ribbon={
        record?.status === "RETIRED"
          ? statusLabel(locale, "RETIRED")
          : undefined
      }
      loading={!creating && data === null}
      statusBar={
        record ? (
          <StatusBar
            steps={(["UNVERIFIED", "VERIFIED", "RETIRED"] as const).map(
              (id) => ({ id, label: statusLabel(locale, id) }),
            )}
            current={record.status}
            label={t.familyStatusTitle}
            buttons={
              record.status === "UNVERIFIED" ? (
                <Button
                  type="button"
                  variant="success"
                  onClick={() => void change("VERIFIED")}
                >
                  <BadgeCheck aria-hidden="true" />
                  <span>{t.verifyButton}</span>
                </Button>
              ) : undefined
            }
          />
        ) : undefined
      }
      gear={
        record
          ? (close) => (
              <MenuItem
                icon={
                  record.status === "RETIRED" ? <ArchiveRestore /> : <Archive />
                }
                onSelect={() => {
                  close();
                  void change(
                    record.status === "RETIRED" ? "UNVERIFIED" : "RETIRED",
                  );
                }}
              >
                {record.status === "RETIRED" ? v.unarchive : t.retireButton}
              </MenuItem>
            )
          : undefined
      }
    >
      {!creating && data && !record ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : record ? (
        <div className="space-y-8">
          <SheetTitle
            label={t.versionTagLabel}
            aside={<StatusPill locale={locale} status={record.status} />}
          >
            <span className="font-mono">{record.versionTag}</span>
          </SheetTitle>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField
                field="xmlTemplate.taxFamily"
                label={t.familyLabel}
                layout="inline"
              >
                <ReadValue>
                  {codeLabel(locale, "taxFamily", record.taxFamily)}
                </ReadValue>
              </FormField>
              <FormField
                field="xmlTemplate.sourceLabel"
                label={t.sourceLabelField}
                layout="inline"
              >
                <ReadValue>{record.sourceLabel}</ReadValue>
              </FormField>
              <FormField
                field="xmlTemplate.sourceUrl"
                label={t.sourceUrlLabel}
                layout="inline"
              >
                <ReadValue className="break-all">
                  <a
                    className="underline"
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {record.sourceUrl}
                  </a>
                </ReadValue>
              </FormField>
              <FormField
                field="xmlTemplate.fixtureVerified"
                label={t.fixtureVerifiedLabel}
                layout="inline"
              >
                <ReadValue>{record.fixtureVerified ? v.yes : v.no}</ReadValue>
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.sourceShaLabel}>
              <FormField
                field="xmlTemplate.sourceSha256"
                label={t.sourceShaField}
                layout="inline"
              >
                <ReadValue mono className="text-xs break-all">
                  {record.sourceSha256}
                </ReadValue>
              </FormField>
              <FormField
                field="xmlTemplate.xsdSchemaHash"
                label={t.xsdHashField}
                layout="inline"
              >
                <ReadValue mono className="text-xs break-all">
                  {record.xsdSchemaHash}
                </ReadValue>
              </FormField>
              <FormField
                field="xmlTemplate.publishedAt"
                label={t.publishedLabel}
                layout="inline"
              >
                <ReadValue>{record.sourcePublishedAt?.slice(0, 10)}</ReadValue>
              </FormField>
            </FieldGroup>
          </div>
          {record.notes && <Notice>{record.notes}</Notice>}
        </div>
      ) : (
        <FormBody
          model="xml-templates"
          onSubmit={() => void save()}
          disabled={saving}
        >
          {error && (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          )}
          <Notice>{t.adminIntro}</Notice>
          <FieldGroup columns={2}>
            <FormField
              field="xmlTemplate.taxFamily"
              label={t.familyLabel}
              required
              layout="inline"
            >
              <Combobox
                value={draft.taxFamily}
                onChange={(value) => value && set({ taxFamily: value })}
                options={codeOptions(locale, "taxFamily", allTaxFamilies)}
                labels={comboLabels(locale)}
              />
            </FormField>
            <FormField
              field="xmlTemplate.versionTag"
              label={t.versionTagLabel}
              required
              layout="inline"
            >
              <TextInput
                value={draft.versionTag}
                onChange={(e) => set({ versionTag: e.target.value })}
                maxLength={64}
                className="font-mono"
                autoFocus
              />
            </FormField>
            <FormField
              field="xmlTemplate.sourceUrl"
              label={t.sourceUrlLabel}
              required
              layout="inline"
            >
              <TextInput
                type="url"
                value={draft.sourceUrl}
                onChange={(e) => set({ sourceUrl: e.target.value })}
                maxLength={500}
              />
            </FormField>
            <FormField
              field="xmlTemplate.sourceLabel"
              label={t.sourceLabelField}
              required
              layout="inline"
            >
              <TextInput
                value={draft.sourceLabel}
                onChange={(e) => set({ sourceLabel: e.target.value })}
                maxLength={300}
              />
            </FormField>
            <FormField
              field="xmlTemplate.sourceSha256"
              label={t.sourceShaField}
              required
              layout="inline"
            >
              <TextInput
                value={draft.sourceSha256}
                onChange={(e) =>
                  set({ sourceSha256: e.target.value.toLowerCase() })
                }
                maxLength={64}
                className="font-mono text-xs"
              />
            </FormField>
            <FormField
              field="xmlTemplate.xsdSchemaHash"
              label={t.xsdHashField}
              required
              layout="inline"
            >
              <TextInput
                value={draft.xsdSchemaHash}
                onChange={(e) =>
                  set({ xsdSchemaHash: e.target.value.toLowerCase() })
                }
                maxLength={64}
                className="font-mono text-xs"
              />
            </FormField>
          </FieldGroup>
          <Checkbox
            label={t.fixtureVerifiedLabel}
            checked={draft.fixtureVerified}
            onChange={(e) => set({ fixtureVerified: e.target.checked })}
          />
        </FormBody>
      )}
    </FormPage>
  );
}
