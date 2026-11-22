"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { fmt, type ViewMessages } from "@/i18n/views";
import { cn } from "@/lib/utils";
import type { SortState } from "./search";

export type Column<R> = {
  key: string;
  header: ReactNode;
  cell: (record: R) => ReactNode;
  /** Field name used for header sorting. */
  sortField?: string;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide this column below a breakpoint in table mode. */
  hideBelow?: "md" | "lg" | "xl";
  /** Shown as the title of the mobile card. */
  primary?: boolean;
  /** Group-row aggregate (e.g. a sum). */
  aggregate?: (records: R[]) => ReactNode;
  width?: string;
};

type Group<R> = { key: string; label: string; rows: R[] };

function interactiveTarget(event: MouseEvent) {
  return (event.target as HTMLElement).closest(
    "a,button,input,label,select,textarea,[role=checkbox]",
  );
}

function SelectBox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      className="size-4 cursor-pointer accent-foreground align-middle"
    />
  );
}

export function ListView<R>({
  records,
  columns,
  getId,
  href,
  rowLabel,
  selectable = true,
  selected,
  onToggle,
  onToggleAll,
  sort,
  onSort,
  groups,
  v,
  rowClassName,
}: {
  records: R[];
  columns: Column<R>[];
  getId: (record: R) => string;
  href?: (record: R) => string;
  rowLabel: (record: R) => string;
  selectable?: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
  sort: SortState;
  onSort?: (field: string) => void;
  groups: Group<R>[] | null;
  v: ViewMessages;
  rowClassName?: (record: R) => string | undefined;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const ids = records.map(getId);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = ids.some((id) => selected.has(id));
  const hideClass = (c: Column<R>) =>
    c.hideBelow === "md"
      ? "hidden md:table-cell"
      : c.hideBelow === "lg"
        ? "hidden lg:table-cell"
        : c.hideBelow === "xl"
          ? "hidden xl:table-cell"
          : "";
  const alignClass = (c: Column<R>) =>
    c.align === "right"
      ? "text-right"
      : c.align === "center"
        ? "text-center"
        : "text-left";

  function open(record: R, event: MouseEvent) {
    if (!href || interactiveTarget(event)) return;
    const target = href(record);
    if (event.metaKey || event.ctrlKey) window.open(target, "_blank");
    else router.push(target);
  }

  function row(record: R) {
    const id = getId(record);
    const isSelected = selected.has(id);
    return (
      <tr
        key={id}
        aria-selected={selectable ? isSelected : undefined}
        onClick={(event) => open(record, event)}
        className={cn(
          "group border-b transition-colors last:border-b-0",
          href && "cursor-pointer hover:bg-surface-2",
          isSelected && "bg-muted hover:bg-muted",
          rowClassName?.(record),
        )}
      >
        {selectable && (
          <td className="w-10 py-2.5 pr-0 pl-4 align-middle">
            <SelectBox
              checked={isSelected}
              onChange={() => onToggle(id)}
              label={fmt(v.selectRow, { label: rowLabel(record) })}
            />
          </td>
        )}
        {columns.map((column, index) => (
          <td
            key={column.key}
            className={cn(
              "px-3 py-2.5 align-middle",
              alignClass(column),
              hideClass(column),
              column.className,
            )}
          >
            {index === 0 && href ? (
              <Link
                href={href(record)}
                className="font-medium outline-offset-2 hover:underline"
              >
                {column.cell(record)}
              </Link>
            ) : (
              column.cell(record)
            )}
          </td>
        ))}
      </tr>
    );
  }

  function card(record: R) {
    const id = getId(record);
    const primary = columns.find((c) => c.primary) ?? columns[0];
    const rest = columns.filter((c) => c !== primary);
    return (
      <li
        key={id}
        onClick={(event) => open(record, event)}
        className={cn(
          "relative space-y-2 border-b px-4 py-3.5 last:border-b-0",
          href && "cursor-pointer active:bg-surface-2",
          selected.has(id) && "bg-muted",
        )}
      >
        <div className="flex items-start gap-3">
          {selectable && (
            <span className="pt-0.5">
              <SelectBox
                checked={selected.has(id)}
                onChange={() => onToggle(id)}
                label={fmt(v.selectRow, { label: rowLabel(record) })}
              />
            </span>
          )}
          <div className="min-w-0 flex-1 font-semibold">
            {href ? (
              <Link href={href(record)} className="break-words">
                {primary.cell(record)}
              </Link>
            ) : (
              primary.cell(record)
            )}
          </div>
          {href && (
            <ChevronRight
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
          )}
        </div>
        <dl
          className={cn(
            "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm",
            selectable && "pl-7",
          )}
        >
          {rest.map((column) => (
            <div key={column.key} className="contents">
              <dt className="text-muted-foreground">{column.header}</dt>
              <dd className="min-w-0 text-right break-words">
                {column.cell(record)}
              </dd>
            </div>
          ))}
        </dl>
      </li>
    );
  }

  function groupHeader(group: Group<R>, inTable: boolean) {
    const isCollapsed = collapsed.has(group.key);
    const toggle = () =>
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(group.key)) next.delete(group.key);
        else next.add(group.key);
        return next;
      });
    const label = (
      <button
        type="button"
        aria-expanded={!isCollapsed}
        onClick={toggle}
        className="flex items-center gap-2 text-left font-semibold"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 transition-transform",
            isCollapsed && "-rotate-90",
          )}
        />
        {fmt(v.groupCount, { label: group.label, n: group.rows.length })}
      </button>
    );
    if (!inTable)
      return (
        <li
          key={`g-${group.key}`}
          className="border-b bg-surface-2 px-4 py-2.5 text-sm"
        >
          {label}
        </li>
      );
    return (
      <tr key={`g-${group.key}`} className="border-b bg-surface-2">
        {selectable && <td className="w-10 pl-4" />}
        {columns.map((column, index) => (
          <td
            key={column.key}
            className={cn(
              "px-3 py-2 text-sm",
              alignClass(column),
              hideClass(column),
            )}
          >
            {index === 0
              ? label
              : column.aggregate && (
                  <span className="font-semibold">
                    {column.aggregate(group.rows)}
                  </span>
                )}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <>
      {/* Table (md and up) */}
      <div className="scroll-thin hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="border-b">
              {selectable && (
                <th scope="col" className="w-10 py-2.5 pr-0 pl-4 text-left">
                  <SelectBox
                    checked={allSelected}
                    indeterminate={!allSelected && someSelected}
                    onChange={(on) => onToggleAll(ids, on)}
                    label={v.selectAll}
                  />
                </th>
              )}
              {columns.map((column) => {
                const sorted =
                  sort && column.sortField && sort.field === column.sortField
                    ? sort.dir
                    : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    aria-sort={
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : undefined
                    }
                    className={cn(
                      "px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-muted-foreground",
                      alignClass(column),
                      hideClass(column),
                    )}
                  >
                    {column.sortField && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(column.sortField!)}
                        className={cn(
                          "group/sort inline-flex items-center gap-1 rounded hover:text-foreground",
                          column.align === "right" && "flex-row-reverse",
                          sorted && "text-foreground",
                        )}
                      >
                        {column.header}
                        {sorted === "asc" ? (
                          <ArrowUp aria-hidden="true" className="size-3.5" />
                        ) : sorted === "desc" ? (
                          <ArrowDown aria-hidden="true" className="size-3.5" />
                        ) : (
                          <ChevronsUpDown
                            aria-hidden="true"
                            className="size-3.5 opacity-0 group-hover/sort:opacity-60"
                          />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {groups
              ? groups.map((group) => [
                  groupHeader(group, true),
                  ...(collapsed.has(group.key) ? [] : group.rows.map(row)),
                ])
              : records.map(row)}
          </tbody>
        </table>
      </div>
      {/* Cards (mobile) */}
      <ul className="md:hidden">
        {groups
          ? groups.map((group) => [
              groupHeader(group, false),
              ...(collapsed.has(group.key) ? [] : group.rows.map(card)),
            ])
          : records.map(card)}
      </ul>
    </>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  onPage,
  v,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  v: ViewMessages;
}) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex shrink-0 items-center gap-1 text-sm">
      <span className="px-1 text-muted-foreground tabular-nums">
        {fmt(v.pager, { from, to, total })}
      </span>
      <button
        type="button"
        aria-label={v.previous}
        disabled={pages <= 1}
        onClick={() => onPage(page <= 1 ? pages : page - 1)}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        aria-label={v.next}
        disabled={pages <= 1}
        onClick={() => onPage(page >= pages ? 1 : page + 1)}
        className="inline-flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface hover:bg-surface-2 disabled:opacity-40"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
