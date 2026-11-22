"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Briefcase, Trash2 } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { can, type Role } from "@/server/workspaces/policy";
import { Badge } from "@/components/ui/status";
import {
  Checkbox,
  FieldGroup,
  FormField,
  ReadValue,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/dialog";
import { MenuItem, MenuSeparator } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { FormBody, FormPage, SheetTitle } from "@/components/views/form-view";
import {
  ListPage,
  archivedPreset,
  standardActions,
} from "@/components/views/list-page";
import { NoWorkspace } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import { apiGet, apiPost, formatFailure } from "./client";

export type CompanyItem = {
  id: string;
  name: string;
  legalName: string;
  npwpHint: string | null;
  nitkuHint: string | null;
  address: string | null;
  archivedAt: string | null;
};
type CompaniesPayload = { role: Role; companies: CompanyItem[] };

const masked = (hint: string | null) => (hint ? `•••• ${hint}` : null);

function companyCommand(action: "archive" | "delete", id: string) {
  return apiPost("/api/companies", { action, id });
}

export function CompaniesList({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const { data, noWorkspace, reload } = useResource(() =>
    apiGet<CompaniesPayload>("/api/companies"),
  );
  const canManage = data ? can(data.role, "team.manage") : false;
  const isArchived = (c: CompanyItem) => Boolean(c.archivedAt);
  const archive = useMemo(() => archivedPreset(locale, isArchived), [locale]);

  const fields = useMemo<ViewField<CompanyItem>[]>(
    () => [
      {
        name: "name",
        label: t.companyName,
        type: "text",
        value: (c) => c.name,
        searchable: true,
        sortable: true,
      },
      {
        name: "legalName",
        label: t.legalName,
        type: "text",
        value: (c) => c.legalName,
        searchable: true,
        sortable: true,
      },
      {
        name: "address",
        label: t.address,
        type: "text",
        value: (c) => c.address,
        searchable: true,
      },
      {
        name: "npwp",
        label: "NPWP",
        type: "enum",
        value: (c) => (c.npwpHint ? "set" : "missing"),
        display: (c) => masked(c.npwpHint) ?? v.none,
        options: [
          { value: "set", label: `NPWP · ${v.yes}` },
          { value: "missing", label: `NPWP · ${v.no}` },
        ],
        filterable: true,
        groupable: true,
      },
      {
        name: "nitku",
        label: "NITKU",
        type: "enum",
        value: (c) => (c.nitkuHint ? "set" : "missing"),
        display: (c) => masked(c.nitkuHint) ?? v.none,
        options: [
          { value: "set", label: `NITKU · ${v.yes}` },
          { value: "missing", label: `NITKU · ${v.no}` },
        ],
        filterable: true,
      },
      {
        name: "status",
        label: t.status,
        type: "enum",
        value: (c) => (c.archivedAt ? "archived" : "active"),
        options: [
          { value: "active", label: v.active },
          { value: "archived", label: v.archived },
        ],
        groupable: true,
      },
    ],
    [t, v],
  );

  const columns: Column<CompanyItem>[] = [
    {
      key: "name",
      header: t.companyName,
      cell: (c) => c.name,
      sortField: "name",
      primary: true,
    },
    {
      key: "legalName",
      header: t.legalName,
      sortField: "legalName",
      cell: (c) => (
        <span className="block min-w-0">
          <span className="block truncate">{c.legalName}</span>
          {c.address && (
            <span className="block truncate text-xs text-muted-foreground">
              {c.address}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "npwp",
      header: "NPWP",
      cell: (c) => (
        <span className="font-mono text-xs">
          {masked(c.npwpHint) ?? v.none}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "nitku",
      header: "NITKU",
      cell: (c) => (
        <span className="font-mono text-xs">
          {masked(c.nitkuHint) ?? v.none}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "status",
      header: t.status,
      cell: (c) =>
        c.archivedAt ? (
          <Badge tone="muted">{v.archived}</Badge>
        ) : (
          <Badge tone="solid" dot>
            {v.active}
          </Badge>
        ),
    },
  ];

  if (noWorkspace) return <NoWorkspace locale={locale} />;
  return (
    <ListPage
      locale={locale}
      title={s.menuCompanies}
      model="companies"
      fields={fields}
      presets={archive.presets}
      baseline={archive.baseline}
      columns={columns}
      records={data?.companies ?? null}
      getId={(c) => c.id}
      href={(c) => `/${locale}/app/companies/${c.id}`}
      rowLabel={(c) => c.name}
      createHref={`/${locale}/app/companies/new`}
      canCreate={canManage}
      emptyIcon={<Briefcase />}
      emptyTitle={t.noCompanies}
      actions={
        canManage
          ? standardActions<CompanyItem>(locale, {
              isArchived,
              archive: (c) => companyCommand("archive", c.id),
              unarchive: (c) => companyCommand("archive", c.id),
              remove: (c) => companyCommand("delete", c.id),
              formatError: (error) => formatFailure(error, locale),
            })
          : []
      }
      onActionDone={reload}
    />
  );
}

type Draft = {
  name: string;
  legalName: string;
  npwp: string;
  nitku: string;
  address: string;
  clearNpwp: boolean;
  clearNitku: boolean;
};
const emptyDraft: Draft = {
  name: "",
  legalName: "",
  npwp: "",
  nitku: "",
  address: "",
  clearNpwp: false,
  clearNitku: false,
};
const toDraft = (c: CompanyItem): Draft => ({
  ...emptyDraft,
  name: c.name,
  legalName: c.legalName,
  address: c.address ?? "",
});

export function CompanyForm({
  locale,
  companyId,
}: {
  locale: Locale;
  companyId: string | null;
}) {
  const t = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const creating = companyId === null;
  const { data, noWorkspace, reload } = useResource(
    () => apiGet<CompaniesPayload>("/api/companies"),
    [companyId],
  );
  const record = data?.companies.find((c) => c.id === companyId) ?? null;
  const canManage = data ? can(data.role, "team.manage") : false;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [initial, setInitial] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null);
  const mode = creating ? "create" : editing ? "edit" : "read";
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);

  function startEdit() {
    if (!record) return;
    setDraft(toDraft(record));
    setInitial(toDraft(record));
    setEditing(true);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const company = {
        name: draft.name,
        legalName: draft.legalName,
        npwp: draft.npwp || undefined,
        nitku: draft.nitku || undefined,
        address: draft.address || undefined,
      };
      if (creating) {
        const created = await apiPost<{ id: string }>("/api/companies", {
          action: "create",
          company,
        });
        toast.success(v.created);
        router.replace(`/${locale}/app/companies/${created.id}`);
        return;
      }
      await apiPost("/api/companies", {
        action: "update",
        id: companyId,
        company,
        clearNpwp: draft.clearNpwp,
        clearNitku: draft.clearNitku,
      });
      await reload();
      setEditing(false);
      toast.success(v.saved);
    } catch (failure) {
      setError(formatFailure(failure, locale));
    } finally {
      setSaving(false);
    }
  }

  async function runCommand(action: "archive" | "delete") {
    if (!record) return;
    try {
      await companyCommand(action, record.id);
      if (action === "delete") {
        toast.success(v.deleted);
        router.replace(`/${locale}/app/companies`);
        return;
      }
      toast.success(record.archivedAt ? v.unarchivedDone : v.archivedDone);
      await reload();
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setConfirm(null);
    }
  }

  if (noWorkspace) return <NoWorkspace locale={locale} />;
  const notFound = data !== null && !creating && !record;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <FormPage
      locale={locale}
      model="companies"
      breadcrumbs={[
        { label: s.menuCompanies, href: `/${locale}/app/companies` },
        {
          label: creating
            ? v.new
            : (record?.name ?? (notFound ? v.notFound : "…")),
        },
      ]}
      recordId={companyId ?? undefined}
      hrefFor={(id) => `/${locale}/app/companies/${id}`}
      mode={mode}
      dirty={creating ? draft.name !== "" || draft.legalName !== "" : dirty}
      saving={saving}
      canEdit={canManage && Boolean(record)}
      onEdit={startEdit}
      onDiscard={() =>
        creating ? router.push(`/${locale}/app/companies`) : setEditing(false)
      }
      ribbon={record?.archivedAt ? v.archived : undefined}
      loading={!creating && data === null}
      gear={
        canManage && record
          ? (close) => (
              <>
                <MenuItem
                  icon={record.archivedAt ? <ArchiveRestore /> : <Archive />}
                  onSelect={() => {
                    close();
                    if (record.archivedAt) void runCommand("archive");
                    else setConfirm("archive");
                  }}
                >
                  {record.archivedAt ? v.unarchive : v.archive}
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<Trash2 />}
                  onSelect={() => {
                    close();
                    setConfirm("delete");
                  }}
                >
                  {v.delete}
                </MenuItem>
              </>
            )
          : undefined
      }
    >
      {notFound ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : mode === "read" && record ? (
        <div className="space-y-8">
          <SheetTitle label={t.companyName}>{record.name}</SheetTitle>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField label={t.legalName} layout="inline">
                <ReadValue>{record.legalName}</ReadValue>
              </FormField>
              <FormField label={t.address} layout="inline">
                <ReadValue>{record.address}</ReadValue>
              </FormField>
            </FieldGroup>
            <FieldGroup title="NPWP / NITKU">
              <FormField label="NPWP" layout="inline">
                <ReadValue mono>{masked(record.npwpHint)}</ReadValue>
              </FormField>
              <FormField label="NITKU" layout="inline">
                <ReadValue mono>{masked(record.nitkuHint)}</ReadValue>
              </FormField>
            </FieldGroup>
          </div>
          {!canManage && (
            <p className="text-sm text-muted-foreground">{t.ownerHint}</p>
          )}
        </div>
      ) : (
        <FormBody
          model="companies"
          onSubmit={() => void save()}
          disabled={saving}
        >
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-foreground px-4 py-3 text-sm font-medium"
            >
              {error}
            </p>
          )}
          <FormField label={t.companyName} required>
            <TextInput
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              maxLength={100}
              autoFocus
              className="text-lg font-semibold"
            />
          </FormField>
          <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField label={t.legalName} required layout="inline">
                <TextInput
                  value={draft.legalName}
                  onChange={(e) => set({ legalName: e.target.value })}
                  maxLength={200}
                />
              </FormField>
              <FormField label={t.address} layout="inline">
                <TextArea
                  value={draft.address}
                  onChange={(e) => set({ address: e.target.value })}
                  maxLength={500}
                  rows={3}
                />
              </FormField>
            </FieldGroup>
            <FieldGroup title="NPWP / NITKU">
              <FormField
                label={t.npwp}
                layout="inline"
                help={
                  record?.npwpHint
                    ? `${v.readOnly}: ${masked(record.npwpHint)}`
                    : undefined
                }
              >
                <TextInput
                  value={draft.npwp}
                  onChange={(e) => set({ npwp: e.target.value })}
                  maxLength={32}
                  inputMode="numeric"
                  placeholder={masked(record?.npwpHint ?? null) ?? ""}
                  className="font-mono"
                />
              </FormField>
              {record?.npwpHint && (
                <Checkbox
                  label={t.clearNpwp}
                  checked={draft.clearNpwp}
                  onChange={(e) => set({ clearNpwp: e.target.checked })}
                />
              )}
              <FormField label={t.nitku} layout="inline">
                <TextInput
                  value={draft.nitku}
                  onChange={(e) => set({ nitku: e.target.value })}
                  maxLength={40}
                  inputMode="numeric"
                  placeholder={masked(record?.nitkuHint ?? null) ?? ""}
                  className="font-mono"
                />
              </FormField>
              {record?.nitkuHint && (
                <Checkbox
                  label={t.clearNitku}
                  checked={draft.clearNitku}
                  onChange={(e) => set({ clearNitku: e.target.checked })}
                />
              )}
            </FieldGroup>
          </div>
        </FormBody>
      )}
      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm === "delete" ? v.confirmDeleteTitle : v.confirmArchiveTitle
        }
        body={confirm === "delete" ? v.confirmDeleteBody : v.confirmArchiveBody}
        confirmLabel={confirm === "delete" ? v.delete : v.archive}
        cancelLabel={v.cancel}
        onConfirm={() =>
          confirm &&
          void runCommand(confirm === "delete" ? "delete" : "archive")
        }
        onCancel={() => setConfirm(null)}
      />
    </FormPage>
  );
}
