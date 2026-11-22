"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Trash2, Users } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { counterpartyKinds } from "@/lib/intake/schemas";
import { identityTypes } from "@/lib/intake/identity";
import type { Role } from "@/server/workspaces/policy";
import { Badge, Notice } from "@/components/ui/status";
import { Combobox } from "@/components/ui/combobox";
import {
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
import { NoWorkspace, comboLabels } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import { apiGet, apiPost, formatFailure } from "./client";

export type CounterpartyItem = {
  id: string;
  kind: (typeof counterpartyKinds)[number];
  name: string;
  identityType: (typeof identityTypes)[number];
  identityHint: string | null;
  countryCode: string;
  address: string | null;
  archivedAt: string | null;
  createdAt: string;
  transactionCount: number;
};
type Payload = {
  role: Role;
  total: number;
  counterparties: CounterpartyItem[];
};

const canMaintain = (role?: Role) =>
  role === "OWNER" || role === "ADMIN" || role === "PREPARER";
const masked = (hint: string | null) => (hint ? `•••• ${hint}` : null);
const command = (action: "archive" | "delete", id: string) =>
  apiPost("/api/counterparties", { action, id });

export function CounterpartiesList({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const { data, noWorkspace, reload } = useResource(() =>
    apiGet<Payload>("/api/counterparties?archived=include&pageSize=500"),
  );
  const canEdit = canMaintain(data?.role);
  const isArchived = (c: CounterpartyItem) => Boolean(c.archivedAt);
  const archive = useMemo(() => archivedPreset(locale, isArchived), [locale]);

  const fields = useMemo<ViewField<CounterpartyItem>[]>(
    () => [
      {
        name: "name",
        label: t.counterpartyName,
        type: "text",
        value: (c) => c.name,
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
        name: "kind",
        label: t.kind,
        type: "enum",
        value: (c) => c.kind,
        display: (c) => t.kinds[c.kind],
        options: counterpartyKinds.map((k) => ({
          value: k,
          label: t.kinds[k],
        })),
        filterable: true,
        groupable: true,
      },
      {
        name: "identityType",
        label: t.identityType,
        type: "enum",
        value: (c) => c.identityType,
        display: (c) => t.identityTypes[c.identityType],
        options: identityTypes.map((k) => ({
          value: k,
          label: t.identityTypes[k],
        })),
        filterable: true,
        groupable: true,
      },
      {
        name: "countryCode",
        label: t.countryCode,
        type: "enum",
        value: (c) => c.countryCode,
        filterable: true,
        groupable: true,
      },
      {
        name: "used",
        label: s.menuTransactions,
        type: "number",
        value: (c) => c.transactionCount,
        sortable: true,
      },
    ],
    [t, s],
  );

  const columns: Column<CounterpartyItem>[] = [
    {
      key: "name",
      header: t.counterpartyName,
      cell: (c) => c.name,
      sortField: "name",
      primary: true,
    },
    {
      key: "kind",
      header: t.kind,
      cell: (c) => <Badge tone="gray">{t.kinds[c.kind]}</Badge>,
    },
    {
      key: "identity",
      header: t.identityType,
      cell: (c) => (
        <span className="flex flex-col">
          <span>{t.identityTypes[c.identityType]}</span>
          {c.identityHint && (
            <span className="font-mono text-xs text-muted-foreground">
              {masked(c.identityHint)}
            </span>
          )}
        </span>
      ),
      hideBelow: "lg",
    },
    {
      key: "country",
      header: t.countryCode,
      cell: (c) => <span className="font-mono text-xs">{c.countryCode}</span>,
      hideBelow: "lg",
    },
    {
      key: "used",
      header: s.menuTransactions,
      cell: (c) => <span className="tabular-nums">{c.transactionCount}</span>,
      sortField: "used",
      align: "right",
      aggregate: (rows) => rows.reduce((sum, r) => sum + r.transactionCount, 0),
    },
    {
      key: "status",
      header: t.status,
      cell: (c) =>
        c.archivedAt ? (
          <Badge tone="gray">{v.archived}</Badge>
        ) : (
          <Badge tone="green" dot>
            {v.active}
          </Badge>
        ),
    },
  ];

  if (noWorkspace) return <NoWorkspace locale={locale} />;
  return (
    <ListPage
      locale={locale}
      title={s.menuCounterparties}
      model="counterparties"
      fields={fields}
      presets={archive.presets}
      baseline={archive.baseline}
      columns={columns}
      records={data?.counterparties ?? null}
      getId={(c) => c.id}
      href={(c) => `/${locale}/app/counterparties/${c.id}`}
      rowLabel={(c) => c.name}
      createHref={`/${locale}/app/counterparties/new`}
      canCreate={canEdit}
      emptyIcon={<Users />}
      emptyTitle={t.noCounterparties}
      actions={
        canEdit
          ? standardActions<CounterpartyItem>(locale, {
              isArchived,
              archive: (c) => command("archive", c.id),
              unarchive: (c) => command("archive", c.id),
              remove: (c) => command("delete", c.id),
              formatError: (error) => formatFailure(error, locale),
            })
          : []
      }
      onActionDone={reload}
    />
  );
}

type Draft = {
  kind: CounterpartyItem["kind"];
  name: string;
  identityType: CounterpartyItem["identityType"];
  identity: string;
  countryCode: string;
  address: string;
};
const emptyDraft: Draft = {
  kind: "VENDOR",
  name: "",
  identityType: "NPWP",
  identity: "",
  countryCode: "ID",
  address: "",
};
const toDraft = (c: CounterpartyItem): Draft => ({
  kind: c.kind,
  name: c.name,
  identityType: c.identityType,
  identity: "",
  countryCode: c.countryCode,
  address: c.address ?? "",
});

export function CounterpartyForm({
  locale,
  counterpartyId,
}: {
  locale: Locale;
  counterpartyId: string | null;
}) {
  const t = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const creating = counterpartyId === null;
  const { data, noWorkspace, reload } = useResource(
    () =>
      apiGet<Payload>(
        creating
          ? "/api/counterparties?pageSize=50"
          : `/api/counterparties?id=${encodeURIComponent(counterpartyId)}`,
      ),
    [counterpartyId],
  );
  const record = creating ? null : (data?.counterparties[0] ?? null);
  const canEdit = canMaintain(data?.role);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [initial, setInitial] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<"delete" | "archive" | null>(null);
  const mode = creating ? "create" : editing ? "edit" : "read";
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const labels = comboLabels(locale);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const counterparty = {
        kind: draft.kind,
        name: draft.name,
        identityType: draft.identityType,
        identity:
          draft.identityType === "NONE"
            ? undefined
            : draft.identity || undefined,
        countryCode: draft.countryCode,
        address: draft.address || undefined,
      };
      const result = await apiPost<{ id: string; duplicateNames?: string[] }>(
        "/api/counterparties",
        creating
          ? { action: "create", counterparty }
          : { action: "update", id: counterpartyId, counterparty },
      );
      if (result.duplicateNames?.length)
        setDuplicateNames(result.duplicateNames);
      if (creating) {
        toast.success(v.created);
        router.replace(`/${locale}/app/counterparties/${result.id}`);
        return;
      }
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
      await command(action, record.id);
      if (action === "delete") {
        toast.success(v.deleted);
        router.replace(`/${locale}/app/counterparties`);
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
  const identityNeeded = draft.identityType !== "NONE";

  return (
    <FormPage
      locale={locale}
      model="counterparties"
      breadcrumbs={[
        { label: s.menuCounterparties, href: `/${locale}/app/counterparties` },
        {
          label: creating
            ? v.new
            : (record?.name ?? (notFound ? v.notFound : "…")),
        },
      ]}
      recordId={counterpartyId ?? undefined}
      hrefFor={(id) => `/${locale}/app/counterparties/${id}`}
      mode={mode}
      dirty={
        creating
          ? draft.name !== ""
          : JSON.stringify(draft) !== JSON.stringify(initial)
      }
      saving={saving}
      canEdit={canEdit && Boolean(record)}
      onEdit={() => {
        if (!record) return;
        setDraft(toDraft(record));
        setInitial(toDraft(record));
        setEditing(true);
        setError(null);
      }}
      onDiscard={() =>
        creating
          ? router.push(`/${locale}/app/counterparties`)
          : setEditing(false)
      }
      ribbon={record?.archivedAt ? v.archived : undefined}
      loading={!creating && data === null}
      banner={
        duplicateNames.length > 0 ? (
          <Notice tone="warning" title={t.duplicateNamesNotice}>
            {duplicateNames.join(", ")}
          </Notice>
        ) : undefined
      }
      gear={
        canEdit && record
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
                  danger
                  icon={<Trash2 />}
                  disabled={record.transactionCount > 0}
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
          <SheetTitle
            label={t.counterpartyName}
            aside={<Badge tone="gray">{t.kinds[record.kind]}</Badge>}
          >
            {record.name}
          </SheetTitle>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField
                field="counterparty.kind"
                label={t.kind}
                layout="inline"
              >
                <ReadValue>{t.kinds[record.kind]}</ReadValue>
              </FormField>
              <FormField
                field="counterparty.countryCode"
                label={t.countryCode}
                layout="inline"
              >
                <ReadValue mono>{record.countryCode}</ReadValue>
              </FormField>
              <FormField
                field="counterparty.address"
                label={t.address}
                layout="inline"
              >
                <ReadValue>{record.address}</ReadValue>
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.identityType}>
              <FormField
                field="counterparty.identityType"
                label={t.identityType}
                layout="inline"
              >
                <ReadValue>{t.identityTypes[record.identityType]}</ReadValue>
              </FormField>
              <FormField
                field="counterparty.identity"
                label={t.identityValue}
                layout="inline"
              >
                <ReadValue mono>{masked(record.identityHint)}</ReadValue>
              </FormField>
              <FormField
                field="counterparty.transactionCount"
                label={s.menuTransactions}
                layout="inline"
              >
                <ReadValue>{record.transactionCount}</ReadValue>
              </FormField>
            </FieldGroup>
          </div>
          {!canEdit && (
            <p className="text-sm text-muted-foreground">
              {t.preparerOrManagerHint}
            </p>
          )}
        </div>
      ) : (
        <FormBody
          model="counterparties"
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
          <FormField
            field="counterparty.name"
            label={t.counterpartyName}
            required
          >
            <TextInput
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              maxLength={200}
              autoFocus
              className="text-lg font-semibold"
            />
          </FormField>
          <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField
                field="counterparty.kind"
                label={t.kind}
                required
                layout="inline"
              >
                <Combobox
                  value={draft.kind}
                  onChange={(value) =>
                    value && set({ kind: value as Draft["kind"] })
                  }
                  options={counterpartyKinds.map((k) => ({
                    value: k,
                    label: t.kinds[k],
                  }))}
                  labels={labels}
                />
              </FormField>
              <FormField
                field="counterparty.countryCode"
                label={t.countryCode}
                required
                layout="inline"
                help="ISO 3166 (ID, SG, …)"
              >
                <TextInput
                  value={draft.countryCode}
                  onChange={(e) =>
                    set({ countryCode: e.target.value.toUpperCase() })
                  }
                  maxLength={2}
                  className="w-24 font-mono uppercase"
                />
              </FormField>
              <FormField
                field="counterparty.address"
                label={t.address}
                layout="inline"
              >
                <TextArea
                  value={draft.address}
                  onChange={(e) => set({ address: e.target.value })}
                  maxLength={500}
                  rows={3}
                />
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.identityType}>
              <FormField
                field="counterparty.identityType"
                label={t.identityType}
                required
                layout="inline"
              >
                <Combobox
                  value={draft.identityType}
                  onChange={(value) =>
                    value &&
                    set({ identityType: value as Draft["identityType"] })
                  }
                  options={identityTypes.map((k) => ({
                    value: k,
                    label: t.identityTypes[k],
                  }))}
                  labels={labels}
                />
              </FormField>
              {identityNeeded && (
                <FormField
                  field="counterparty.identity"
                  label={t.identityValue}
                  layout="inline"
                  help={
                    record?.identityHint
                      ? `${t.identityKeepHint} (${masked(record.identityHint)})`
                      : undefined
                  }
                >
                  <TextInput
                    value={draft.identity}
                    onChange={(e) => set({ identity: e.target.value })}
                    maxLength={64}
                    placeholder={masked(record?.identityHint ?? null) ?? ""}
                    className="font-mono"
                  />
                </FormField>
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
        tone={confirm === "delete" ? "danger" : "warning"}
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
