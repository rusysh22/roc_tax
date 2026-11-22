"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  Download,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import type { FieldKey } from "@/i18n/fields";
import type { Locale } from "@/i18n/messages";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormField, TextArea } from "@/components/ui/field";
import { MenuItem, MenuSeparator, Popover } from "@/components/ui/menu";
import { EmptyState, Skeleton } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { ControlPanel } from "./control-panel";
import { csvFileName, downloadCsv } from "./csv";
import { LIST_PAGE_SIZE, ListView, Pager, type Column } from "./list-view";
import {
  applySearch,
  emptySearch,
  groupRecords,
  type Preset,
  type SearchState,
  type ViewField,
} from "./search";
import { SearchBar } from "./search-bar";
import { rememberRecordOrder, useSearchState, useSelection } from "./use-list";

export type ListAction<R> = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Destructive action: menu item and confirm button are red. */
  danger?: boolean;
  /** Runs for the selected records; return a success message or nothing. */
  run: (records: R[], input?: string) => Promise<string | void>;
  visible?: (records: R[]) => boolean;
  confirm?: {
    title: string;
    body: string;
    label?: string;
    /** Confirm button colour; defaults to danger (red). */
    tone?: "default" | "danger" | "warning" | "success";
  };
  /** Asks for a required text (e.g. a reason) before running. */
  prompt?: {
    title: string;
    label: string;
    /** Field dictionary key for the info tip (defaults to common.reason). */
    field?: FieldKey;
    body?: string;
    confirmLabel?: string;
  };
};

/** Standard archive / unarchive / delete actions wired to callbacks. */
export function standardActions<R>(
  locale: Locale,
  options: {
    isArchived?: (record: R) => boolean;
    archive?: (record: R) => Promise<unknown>;
    unarchive?: (record: R) => Promise<unknown>;
    remove?: (record: R) => Promise<unknown>;
    /** Turns API failures into a user-facing message. */
    formatError?: (error: unknown) => string;
  },
): ListAction<R>[] {
  const v = viewMessages[locale];
  const actions: ListAction<R>[] = [];
  const { isArchived } = options;
  if (options.archive && isArchived)
    actions.push({
      id: "archive",
      label: v.archive,
      icon: <Archive />,
      visible: (rows) => rows.some((r) => !isArchived(r)),
      confirm: {
        title: v.confirmArchiveTitle,
        body: v.confirmArchiveBody,
        tone: "warning",
      },
      run: async (rows) => {
        for (const row of rows.filter((r) => !isArchived(r)))
          await options.archive!(row);
        return v.archivedDone;
      },
    });
  if (options.unarchive && isArchived)
    actions.push({
      id: "unarchive",
      label: v.unarchive,
      icon: <ArchiveRestore />,
      visible: (rows) => rows.some((r) => isArchived(r)),
      run: async (rows) => {
        for (const row of rows.filter((r) => isArchived(r)))
          await options.unarchive!(row);
        return v.unarchivedDone;
      },
    });
  if (options.remove)
    actions.push({
      id: "delete",
      label: v.delete,
      danger: true,
      icon: <Trash2 />,
      confirm: { title: v.confirmDeleteTitle, body: v.confirmDeleteBody },
      run: async (rows) => {
        for (const row of rows) await options.remove!(row);
        return v.deleted;
      },
    });
  const { formatError } = options;
  if (!formatError) return actions;
  return actions.map((action) => ({
    ...action,
    run: async (rows: R[]) => {
      try {
        return await action.run(rows);
      } catch (error) {
        throw new Error(formatError(error), { cause: error });
      }
    },
  }));
}

/** Odoo-style "Archived" filter: active records only unless toggled. */
export function archivedPreset<R>(
  locale: Locale,
  isArchived: (record: R) => boolean,
): { presets: Preset<R>[]; baseline: (record: R, s: SearchState) => boolean } {
  const v = viewMessages[locale];
  return {
    presets: [
      {
        id: "archived",
        label: v.archived,
        group: "archive",
        predicate: (record) => isArchived(record),
      },
    ],
    baseline: (record, state) =>
      state.facets.some((f) => f.kind === "preset" && f.group === "archive") ||
      !isArchived(record),
  };
}

export function ListPage<R>({
  locale,
  title,
  model,
  fields,
  presets = [],
  baseline,
  columns,
  records,
  getId,
  href,
  rowLabel,
  createHref,
  onCreate,
  createLabel,
  canCreate = true,
  actions = [],
  globalActions,
  exportable = true,
  server,
  emptyIcon,
  emptyTitle,
  emptyHint,
  banner,
  pageSize = LIST_PAGE_SIZE,
  initialSearch = emptySearch,
  onSearchChange,
  rowClassName,
  onActionDone,
}: {
  locale: Locale;
  title: string;
  model: string;
  fields: ViewField<R>[];
  presets?: Preset<R>[];
  baseline?: (record: R, state: SearchState) => boolean;
  columns: Column<R>[];
  /** `null` while loading. */
  records: R[] | null;
  getId: (record: R) => string;
  href?: (record: R) => string;
  rowLabel: (record: R) => string;
  createHref?: string;
  onCreate?: () => void;
  createLabel?: string;
  canCreate?: boolean;
  actions?: ListAction<R>[];
  globalActions?: (close: () => void) => ReactNode;
  exportable?: boolean;
  /** Server-side mode: records are already filtered/sorted/paged. */
  server?: { total: number; pageSize: number };
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  banner?: ReactNode;
  pageSize?: number;
  initialSearch?: SearchState;
  onSearchChange?: (state: SearchState) => void;
  rowClassName?: (record: R) => string | undefined;
  onActionDone?: () => void | Promise<void>;
}) {
  const v = viewMessages[locale];
  const toast = useToast();
  const [state, setState, ready] = useSearchState(initialSearch);
  const selection = useSelection();
  const [pending, setPending] = useState<ListAction<R> | null>(null);
  const [promptText, setPromptText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready) onSearchChange?.(state);
    // Notify the parent (server mode) whenever the search changes.
  }, [state, ready]);

  const filtered = useMemo(
    () =>
      records && !server
        ? applySearch(records, state, fields, presets, baseline)
        : (records ?? []),
    [records, server, state, fields, presets, baseline],
  );
  const total = server ? server.total : filtered.length;
  const size = server ? server.pageSize : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const page = Math.min(state.page, pageCount);
  const visible = server
    ? filtered
    : filtered.slice((page - 1) * size, page * size);
  const groupField = fields.find((f) => f.name === state.groupBy);
  const groups = groupRecords(visible, groupField, v.none);
  const byId = new Map((records ?? []).map((r) => [getId(r), r]));
  const selectedRecords = [...selection.selected]
    .map((id) => byId.get(id))
    .filter((r): r is R => Boolean(r));

  useEffect(() => {
    rememberRecordOrder(model, visible.map(getId));
  }, [model, visible, getId]);

  function exportRows(rows: R[]) {
    const exportFields = fields.filter((f) => f.exportable !== false);
    downloadCsv(
      csvFileName(model),
      exportFields.map((f) => f.label),
      rows.map((row) =>
        exportFields.map((f) => f.display?.(row) ?? f.value(row) ?? ""),
      ),
    );
    toast.success(fmt(v.exported, { n: rows.length }));
  }

  async function runAction(action: ListAction<R>, input?: string) {
    setBusy(true);
    try {
      const message = await action.run(selectedRecords, input);
      selection.clear();
      toast.success(message || v.saved);
      await onActionDone?.();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : v.failed,
      );
      await onActionDone?.();
    } finally {
      setBusy(false);
      setPending(null);
      setPromptText("");
    }
  }

  const visibleActions = actions.filter(
    (a) => !a.visible || a.visible(selectedRecords),
  );
  const hasSelection = selectedRecords.length > 0;

  const createButton =
    canCreate && (createHref || onCreate) ? (
      createHref ? (
        <Button asChild>
          <Link href={createHref}>
            <Plus aria-hidden="true" />
            <span>{createLabel ?? v.new}</span>
          </Link>
        </Button>
      ) : (
        <Button type="button" onClick={onCreate}>
          <Plus aria-hidden="true" />
          <span>{createLabel ?? v.new}</span>
        </Button>
      )
    ) : null;

  const left = hasSelection ? (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-9 items-center gap-1 rounded-md bg-foreground pr-1 pl-3 text-sm font-medium text-background">
        {fmt(v.selected, { n: selectedRecords.length })}
        <button
          type="button"
          aria-label={v.clearSelection}
          onClick={selection.clear}
          className="rounded p-1 hover:bg-background/20"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      </span>
      {exportable && (
        <Button
          type="button"
          variant="outline"
          onClick={() => exportRows(selectedRecords)}
        >
          <Download aria-hidden="true" />
          <span>{v.export}</span>
        </Button>
      )}
      {visibleActions.length > 0 && (
        <Popover
          role="menu"
          label={v.actions}
          trigger={({ toggle, ref, ...aria }) => (
            <Button
              ref={ref}
              type="button"
              variant="outline"
              onClick={toggle}
              {...aria}
            >
              <Settings aria-hidden="true" />
              <span>{v.actions}</span>
            </Button>
          )}
        >
          {(close) =>
            visibleActions.map((action) => (
              <MenuItem
                key={action.id}
                danger={action.danger}
                icon={action.icon}
                disabled={busy}
                onSelect={() => {
                  close();
                  if (action.confirm || action.prompt) setPending(action);
                  else void runAction(action);
                }}
              >
                {action.label}
              </MenuItem>
            ))
          }
        </Popover>
      )}
    </div>
  ) : (
    createButton
  );

  const titleNode = (
    <div className="flex min-w-0 items-center gap-1.5">
      <h1 className="truncate text-lg font-semibold">{title}</h1>
      {!hasSelection && (exportable || globalActions) && (
        <Popover
          role="menu"
          label={v.actions}
          trigger={({ toggle, ref, ...aria }) => (
            <Button
              ref={ref}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={v.actions}
              onClick={toggle}
              {...aria}
            >
              <Settings aria-hidden="true" />
            </Button>
          )}
        >
          {(close) => (
            <>
              {exportable && (
                <MenuItem
                  icon={<Download />}
                  disabled={!filtered.length}
                  onSelect={() => {
                    close();
                    exportRows(filtered);
                  }}
                >
                  {v.exportCsv}
                </MenuItem>
              )}
              {globalActions && exportable && <MenuSeparator />}
              {globalActions?.(close)}
            </>
          )}
        </Popover>
      )}
    </div>
  );

  return (
    <div className="flex min-h-full flex-col">
      <ControlPanel
        left={left}
        title={titleNode}
        search={
          <SearchBar
            state={state}
            onChange={(next) => {
              setState(next);
              selection.clear();
            }}
            fields={fields}
            presets={presets}
            records={records ?? []}
            v={v}
          />
        }
        right={
          <Pager
            page={page}
            pageSize={size}
            total={total}
            onPage={(p) => setState({ ...state, page: p })}
            v={v}
          />
        }
      />
      {banner && <div className="px-4 pt-4 sm:px-6">{banner}</div>}
      <div className="flex-1 p-0 sm:p-6 sm:pt-4">
        <div className="overflow-hidden border-y bg-surface sm:rounded-xl sm:border sm:shadow-xs">
          {records === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={emptyIcon}
              title={
                records.length && (state.facets.length || server)
                  ? v.noResults
                  : (emptyTitle ?? v.noRecords)
              }
              hint={
                records.length && (state.facets.length || server)
                  ? v.noResultsHint
                  : (emptyHint ?? (canCreate ? v.noRecordsHint : undefined))
              }
              action={
                state.facets.length ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setState({ ...state, facets: [], page: 1 })}
                  >
                    {v.clearSearch}
                  </Button>
                ) : (
                  createButton
                )
              }
            />
          ) : (
            <ListView
              records={visible}
              columns={columns}
              getId={getId}
              href={href}
              rowLabel={rowLabel}
              selected={selection.selected}
              onToggle={selection.toggle}
              onToggleAll={selection.setAll}
              sort={state.sort}
              onSort={(field) =>
                setState({
                  ...state,
                  sort:
                    state.sort?.field === field
                      ? state.sort.dir === "asc"
                        ? { field, dir: "desc" }
                        : null
                      : { field, dir: "asc" },
                })
              }
              groups={groups}
              v={v}
              rowClassName={rowClassName}
            />
          )}
        </div>
      </div>
      <ConfirmDialog
        open={pending !== null && !pending.prompt}
        title={pending?.confirm?.title ?? ""}
        body={pending?.confirm?.body}
        confirmLabel={pending?.confirm?.label ?? pending?.label ?? v.confirm}
        tone={pending?.confirm?.tone ?? "danger"}
        cancelLabel={v.cancel}
        busy={busy}
        onConfirm={() => pending && void runAction(pending)}
        onCancel={() => setPending(null)}
      />
      <Dialog
        open={Boolean(pending?.prompt)}
        onClose={() => setPending(null)}
        title={pending?.prompt?.title ?? ""}
        description={pending?.prompt?.body}
        size="sm"
        closeLabel={v.cancel}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
            >
              {v.cancel}
            </Button>
            <Button
              type="button"
              disabled={busy || promptText.trim().length < 2}
              onClick={() =>
                pending && void runAction(pending, promptText.trim())
              }
            >
              {pending?.prompt?.confirmLabel ?? pending?.label ?? v.confirm}
            </Button>
          </>
        }
      >
        <FormField
          field={pending?.prompt?.field ?? "common.reason"}
          label={pending?.prompt?.label ?? ""}
          required
        >
          <TextArea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
          />
        </FormField>
      </Dialog>
    </div>
  );
}
