"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Ban, FileText, FileUp } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { intakeFamilies, transactionSources } from "@/lib/intake/schemas";
import {
  allows,
  transactionStatuses,
  type TransactionStatus,
} from "@/lib/intake/state";
import { sumAmounts } from "@/lib/intake/decimal";
import { can, type Role } from "@/server/workspaces/policy";
import { Badge } from "@/components/ui/status";
import { MenuItem } from "@/components/ui/menu";
import { ListPage, type ListAction } from "@/components/views/list-page";
import { NoWorkspace } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import {
  decodeSearch,
  emptySearch,
  type Preset,
  type SearchState,
  type ViewField,
} from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "./client";
import { TransactionStatusBadge } from "./transaction-status";

export type TransactionRow = {
  id: string;
  invoiceNumber: string;
  documentDate: string;
  taxPeriod: string;
  taxFamily: (typeof intakeFamilies)[number];
  documentType: string;
  source: (typeof transactionSources)[number];
  status: TransactionStatus;
  currency: string;
  totalAmount: string;
  company: { id: string; name: string };
  counterparty: { id: string; name: string; identityHint: string | null };
  documentCount: number;
  lineCount: number;
  hasDuplicate: boolean;
  version: number;
  createdAt: string;
};
type Page = {
  role: Role;
  total: number;
  page: number;
  pageSize: number;
  transactions: TransactionRow[];
};

const PAGE_SIZE = 80;
const workflowPresets: Record<string, TransactionStatus[]> = {
  needsWork: ["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"],
  awaitingApproval: ["VALIDATED", "SUBMITTED"],
  readyToExport: ["APPROVED"],
  exported: ["EXPORTED", "CORETAX_ACCEPTED", "CORETAX_REJECTED"],
};

function recentPeriods(count: number) {
  const periods: string[] = [];
  const now = new Date();
  for (let i = -1; i < count; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    periods.push(d.toISOString().slice(0, 7));
  }
  return periods;
}

/** Translates the generic search state into the transactions API query. */
export function transactionQuery(state: SearchState) {
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(PAGE_SIZE),
  });
  let presetStatuses: Set<TransactionStatus> | null = null;
  let includeVoided = false;
  for (const facet of state.facets) {
    if (facet.kind === "preset") {
      if (facet.group === "archive") includeVoided = true;
      else
        for (const id of facet.ids) {
          presetStatuses ??= new Set();
          for (const status of workflowPresets[id] ?? [])
            presetStatuses.add(status);
        }
    } else if (facet.kind === "text") {
      const value = facet.values[facet.values.length - 1];
      if (facet.field === "invoice") params.set("invoice", value);
      if (facet.field === "counterparty") params.set("counterparty", value);
    } else if (facet.kind === "date" && facet.field === "documentDate") {
      if (facet.from) params.set("dateFrom", facet.from);
      if (facet.to) params.set("dateTo", facet.to);
    } else if (facet.kind === "enum") {
      const key = {
        taxFamily: "families",
        source: "sources",
        company: "companyIds",
        taxPeriod: "taxPeriods",
      }[facet.field];
      if (key) params.set(key, facet.values.join(","));
    }
  }
  const enumStatuses = state.facets.find(
    (f) => f.kind === "enum" && f.field === "status",
  );
  let statuses: TransactionStatus[] | null = presetStatuses
    ? [...presetStatuses]
    : null;
  if (enumStatuses && enumStatuses.kind === "enum") {
    const chosen = enumStatuses.values as TransactionStatus[];
    statuses = statuses ? statuses.filter((s) => chosen.includes(s)) : chosen;
    if (chosen.includes("VOIDED")) includeVoided = true;
  }
  if (statuses)
    params.set("statuses", statuses.length ? statuses.join(",") : "VOIDED");
  if (!includeVoided) params.set("excludeStatuses", "VOIDED");
  if (state.sort) {
    const field = {
      invoice: "invoice",
      documentDate: "date",
      totalAmount: "amount",
      status: "status",
      taxPeriod: "period",
    }[state.sort.field];
    if (field) params.set("sort", `${field}:${state.sort.dir}`);
  }
  return params;
}

export function TransactionsList({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const [page, setPage] = useState<Page | null>(null);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const lastQuery = useRef<string>("");
  const companies = useResource(() =>
    apiGet<{ companies: { id: string; name: string }[] }>("/api/companies"),
  );

  const load = useCallback(async (state: SearchState) => {
    const query = transactionQuery(state).toString();
    lastQuery.current = query;
    try {
      const next = await apiGet<Page>(`/api/transactions?${query}`);
      if (lastQuery.current === query) setPage(next);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
    }
  }, []);

  const fields = useMemo<ViewField<TransactionRow>[]>(
    () => [
      {
        name: "invoice",
        label: t.invoiceNumber,
        type: "text",
        value: (r) => r.invoiceNumber,
        searchable: true,
        sortable: true,
      },
      {
        name: "counterparty",
        label: t.counterparty,
        type: "text",
        value: (r) => r.counterparty.name,
        searchable: true,
      },
      {
        name: "status",
        label: t.status,
        type: "enum",
        value: (r) => r.status,
        display: (r) => t.statuses[r.status],
        options: transactionStatuses.map((st) => ({
          value: st,
          label: t.statuses[st],
        })),
        filterable: true,
        groupable: true,
        sortable: true,
      },
      {
        name: "taxFamily",
        label: t.taxFamily,
        type: "enum",
        value: (r) => r.taxFamily,
        display: (r) => t.families[r.taxFamily],
        options: intakeFamilies.map((f) => ({
          value: f,
          label: t.families[f],
        })),
        filterable: true,
        groupable: true,
      },
      {
        name: "company",
        label: t.company,
        type: "enum",
        value: (r) => r.company.id,
        display: (r) => r.company.name,
        options:
          companies.data?.companies.map((c) => ({
            value: c.id,
            label: c.name,
          })) ?? [],
        filterable: true,
        groupable: true,
      },
      {
        name: "taxPeriod",
        label: t.taxPeriod,
        type: "enum",
        value: (r) => r.taxPeriod,
        options: recentPeriods(18).map((p) => ({ value: p, label: p })),
        filterable: true,
        groupable: true,
        sortable: true,
      },
      {
        name: "source",
        label: t.source ?? "Source",
        type: "enum",
        value: (r) => r.source,
        display: (r) => t.sources[r.source],
        options: transactionSources.map((src) => ({
          value: src,
          label: t.sources[src],
        })),
        filterable: true,
        groupable: true,
      },
      {
        name: "documentDate",
        label: t.documentDate,
        type: "date",
        value: (r) => r.documentDate,
        filterable: true,
        sortable: true,
      },
      {
        name: "totalAmount",
        label: t.totalAmount,
        type: "number",
        value: (r) => r.totalAmount,
        sortable: true,
      },
    ],
    [t, companies.data],
  );

  const presets = useMemo<Preset<TransactionRow>[]>(
    () => [
      {
        id: "needsWork",
        label: t.statuses.CHANGES_REQUESTED + " / " + t.statuses.DRAFT,
        group: "workflow",
      },
      {
        id: "awaitingApproval",
        label: t.statuses.SUBMITTED,
        group: "workflow",
      },
      { id: "readyToExport", label: t.statuses.APPROVED, group: "workflow" },
      { id: "exported", label: t.statuses.EXPORTED, group: "workflow" },
      { id: "voided", label: t.statuses.VOIDED, group: "archive" },
    ],
    [t],
  );

  const columns: Column<TransactionRow>[] = [
    {
      key: "invoice",
      header: t.invoiceNumber,
      sortField: "invoice",
      primary: true,
      cell: (r) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono">{r.invoiceNumber}</span>
          {r.hasDuplicate && <Badge tone="muted">{t.duplicateBadge}</Badge>}
        </span>
      ),
    },
    {
      key: "date",
      header: t.documentDate,
      sortField: "documentDate",
      cell: (r) => (
        <span className="flex flex-col font-mono text-xs leading-5">
          <span>{r.documentDate}</span>
          <span className="text-muted-foreground">{r.taxPeriod}</span>
        </span>
      ),
    },
    {
      key: "company",
      header: t.company,
      cell: (r) => r.company.name,
      hideBelow: "xl",
    },
    {
      key: "counterparty",
      header: t.counterparty,
      cell: (r) => r.counterparty.name,
    },
    {
      key: "family",
      header: t.taxFamily,
      cell: (r) => <span className="text-xs">{t.families[r.taxFamily]}</span>,
      hideBelow: "lg",
    },
    {
      key: "amount",
      header: t.totalAmount,
      sortField: "totalAmount",
      align: "right",
      cell: (r) => (
        <span className="font-mono text-[0.8125rem] whitespace-nowrap">
          {formatAmountString(r.totalAmount, locale)}
        </span>
      ),
      aggregate: (rows) => (
        <span className="font-mono text-[0.8125rem] whitespace-nowrap">
          {formatAmountString(
            sumAmounts(rows.map((r) => r.totalAmount)) ?? "0.00",
            locale,
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: t.status,
      sortField: "status",
      cell: (r) => <TransactionStatusBadge status={r.status} locale={locale} />,
    },
  ];

  const canPrepare = page ? can(page.role, "draft.prepare") : false;
  const actions: ListAction<TransactionRow>[] = canPrepare
    ? [
        {
          id: "void",
          label: t.voidConfirm,
          icon: <Ban />,
          visible: (rows) => rows.some((r) => allows(r.status, "void")),
          prompt: {
            title: t.voidTitle,
            label: t.voidReason,
            confirmLabel: t.voidConfirm,
          },
          run: async (rows, reason) => {
            try {
              for (const row of rows.filter((r) => allows(r.status, "void")))
                await apiPost(`/api/transactions/${row.id}`, {
                  action: "void",
                  version: row.version,
                  reason,
                });
              return v.saved;
            } catch (error) {
              throw new Error(formatFailure(error, locale), { cause: error });
            }
          },
        },
      ]
    : [];

  if (noWorkspace) return <NoWorkspace locale={locale} />;
  return (
    <ListPage
      locale={locale}
      title={s.menuTransactions}
      model="transactions"
      fields={fields}
      presets={presets}
      columns={columns}
      records={page?.transactions ?? null}
      server={{ total: page?.total ?? 0, pageSize: PAGE_SIZE }}
      onSearchChange={(state) => void load(state)}
      getId={(r) => r.id}
      href={(r) => `/${locale}/app/transactions/${r.id}`}
      rowLabel={(r) => r.invoiceNumber}
      createHref={`/${locale}/app/transactions/new`}
      canCreate={canPrepare}
      emptyIcon={<FileText />}
      emptyTitle={t.noTransactionsYet}
      actions={actions}
      onActionDone={() => load(currentState())}
      rowClassName={(r) =>
        r.status === "VOIDED" ? "text-muted-foreground" : undefined
      }
      globalActions={(close) => (
        <MenuItem
          icon={<FileUp />}
          onSelect={() => {
            close();
            window.location.assign(`/${locale}/app/imports`);
          }}
        >
          {s.menuImports}
        </MenuItem>
      )}
    />
  );
}

/** Re-reads the current URL search state (used after bulk actions). */
function currentState(): SearchState {
  return (
    decodeSearch(new URLSearchParams(window.location.search).get("s")) ??
    emptySearch
  );
}
