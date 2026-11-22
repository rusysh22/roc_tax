"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Scale } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { allTaxFamilies } from "@/lib/intake/tax-rules";
import { transactionSources } from "@/lib/intake/schemas";
import type { DiscrepancyCode } from "@/lib/reports/schemas";
import { Badge } from "@/components/ui/status";
import { ListPage } from "@/components/views/list-page";
import { NoWorkspace } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { Preset, SearchState, ViewField } from "@/components/views/search";
import {
  ApiFailure,
  apiGet,
  formatAmountString,
} from "@/components/intake/client";

type Row = {
  transactionId: string;
  invoiceNumber: string;
  documentDate: string;
  taxPeriod: string;
  taxFamily: string;
  source: string;
  status: string;
  companyName: string;
  counterpartyName: string;
  sourceAmount: string;
  approvedDppAmount: string | null;
  approvedTaxAmount: string | null;
  ruleCode: string | null;
  ruleVersion: number | null;
  exportVersion: number | null;
  xmlSha256Prefix: string | null;
  coretaxOutcome: string | null;
  coretaxReference: string | null;
  discrepancy: DiscrepancyCode;
};
type Payload = {
  cards: {
    totalTransactions: number;
    inReviewCount: number;
    approvedCount: number;
    exportedCount: number;
    coretaxSubmittedCount: number;
    coretaxAcceptedCount: number;
    coretaxRejectedCount: number;
    discrepancyCount: number;
  };
  companies: { id: string; name: string }[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  rows: Row[];
};

const PAGE_SIZE = 50;

function recentPeriods(count: number) {
  const now = new Date();
  return Array.from({ length: count + 1 }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1 - i, 1))
      .toISOString()
      .slice(0, 7),
  );
}

function reconciliationQuery(state: SearchState) {
  const params = new URLSearchParams({
    page: String(state.page),
    pageSize: String(PAGE_SIZE),
  });
  for (const facet of state.facets) {
    if (facet.kind === "text")
      params.set("search", facet.values[facet.values.length - 1]);
    if (facet.kind === "preset" && facet.ids.includes("discrepancy"))
      params.set("discrepancyOnly", "true");
    if (facet.kind === "enum") {
      const key = {
        company: "companyId",
        taxPeriod: "taxPeriod",
        taxFamily: "taxFamily",
        source: "source",
      }[facet.field];
      if (key && facet.values.length)
        params.set(key, facet.values[facet.values.length - 1]);
    }
  }
  return params;
}

export function ReconciliationView({ locale }: { locale: Locale }) {
  const t = reportMessages[locale];
  const intake = intakeMessages[locale];
  const s = shellMessages[locale];
  const [data, setData] = useState<Payload | null>(null);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [query, setQuery] = useState("");
  const latest = useRef("");

  const load = useCallback(async (state: SearchState) => {
    const next = reconciliationQuery(state).toString();
    latest.current = next;
    setQuery(next);
    try {
      const payload = await apiGet<Payload>(
        `/api/reports/reconciliation?${next}`,
      );
      if (latest.current === next) setData(payload);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
    }
  }, []);

  const fields = useMemo<ViewField<Row>[]>(
    () => [
      {
        name: "search",
        label: t.searchLabel,
        type: "text",
        value: (r) => `${r.invoiceNumber} ${r.counterpartyName}`,
        searchable: true,
      },
      {
        name: "company",
        label: intake.company,
        type: "enum",
        value: (r) => r.companyName,
        options:
          data?.companies.map((c) => ({ value: c.id, label: c.name })) ?? [],
        filterable: true,
        single: true,
      },
      {
        name: "taxPeriod",
        label: t.periodLabel,
        type: "enum",
        value: (r) => r.taxPeriod,
        options: recentPeriods(18).map((p) => ({ value: p, label: p })),
        filterable: true,
        groupable: true,
        single: true,
      },
      {
        name: "taxFamily",
        label: intake.taxFamily,
        type: "enum",
        value: (r) => r.taxFamily,
        options: allTaxFamilies.map((f) => ({ value: f, label: f })),
        filterable: true,
        groupable: true,
        single: true,
      },
      {
        name: "source",
        label: intake.source,
        type: "enum",
        value: (r) => r.source,
        options: transactionSources.map((src) => ({
          value: src,
          label: intake.sources[src],
        })),
        filterable: true,
        single: true,
      },
      {
        name: "discrepancy",
        label: t.columns.discrepancy,
        type: "enum",
        value: (r) => r.discrepancy,
        display: (r) => t.discrepancies[r.discrepancy],
        groupable: true,
      },
      {
        name: "status",
        label: intake.status,
        type: "enum",
        value: (r) => r.status,
        groupable: true,
      },
    ],
    [t, intake, data?.companies],
  );

  const presets = useMemo<Preset<Row>[]>(
    () => [
      {
        id: "discrepancy",
        label: t.discrepancyOnlyLabel,
        group: "discrepancy",
      },
    ],
    [t],
  );

  const columns: Column<Row>[] = [
    {
      key: "invoice",
      header: intake.invoiceNumber,
      primary: true,
      cell: (r) => <span className="font-mono">{r.invoiceNumber}</span>,
    },
    {
      key: "period",
      header: t.periodLabel,
      cell: (r) => <span className="font-mono text-xs">{r.taxPeriod}</span>,
    },
    {
      key: "counterparty",
      header: intake.counterparty,
      cell: (r) => r.counterpartyName,
      hideBelow: "lg",
    },
    {
      key: "source",
      header: t.columns.sourceAmount,
      align: "right",
      cell: (r) => (
        <span className="font-mono text-[0.8125rem] whitespace-nowrap">
          {formatAmountString(r.sourceAmount, locale)}
        </span>
      ),
    },
    {
      key: "tax",
      header: t.columns.approvedTax,
      align: "right",
      cell: (r) =>
        r.approvedTaxAmount ? (
          <span className="font-mono text-[0.8125rem] whitespace-nowrap">
            {formatAmountString(r.approvedTaxAmount, locale)}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
      hideBelow: "md",
    },
    {
      key: "export",
      header: t.columns.exportBatch,
      cell: (r) =>
        r.exportVersion ? (
          <span className="font-mono text-xs">
            v{r.exportVersion} · {r.xmlSha256Prefix}
          </span>
        ) : (
          "—"
        ),
      hideBelow: "xl",
    },
    {
      key: "coretax",
      header: t.columns.coretaxOutcome,
      cell: (r) =>
        r.coretaxOutcome ? (
          <Badge tone="neutral">
            {r.coretaxOutcome.replace("CORETAX_", "")}
          </Badge>
        ) : (
          "—"
        ),
      hideBelow: "lg",
    },
    {
      key: "discrepancy",
      header: t.columns.discrepancy,
      cell: (r) => (
        <Badge tone={r.discrepancy === "NONE" ? "solid" : "muted"} dot>
          {t.discrepancies[r.discrepancy]}
        </Badge>
      ),
    },
  ];

  if (noWorkspace) return <NoWorkspace locale={locale} />;
  const cards = data?.cards;
  return (
    <ListPage
      locale={locale}
      title={s.menuReconciliation}
      model="reconciliation"
      fields={fields}
      presets={presets}
      columns={columns}
      records={data?.rows ?? null}
      server={{ total: data?.pagination.totalRows ?? 0, pageSize: PAGE_SIZE }}
      onSearchChange={(state) => void load(state)}
      getId={(r) => r.transactionId}
      href={(r) => `/${locale}/app/transactions/${r.transactionId}`}
      rowLabel={(r) => r.invoiceNumber}
      canCreate={false}
      exportable={false}
      emptyIcon={<Scale />}
      emptyTitle={t.noRows}
      globalActions={(close) => (
        <a
          role="menuitem"
          href={`/api/reports/reconciliation/export?${query}`}
          onClick={close}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
        >
          <Download aria-hidden="true" className="size-4" />
          {t.downloadCsv}
        </a>
      )}
      banner={
        cards ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {[
                [t.cards.total, cards.totalTransactions],
                [t.cards.inReview, cards.inReviewCount],
                [t.cards.approved, cards.approvedCount],
                [t.cards.exported, cards.exportedCount],
                [t.cards.coretaxSubmitted, cards.coretaxSubmittedCount],
                [t.cards.coretaxAccepted, cards.coretaxAcceptedCount],
                [t.cards.coretaxRejected, cards.coretaxRejectedCount],
                [t.cards.discrepancies, cards.discrepancyCount],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border bg-surface p-3 shadow-xs"
                >
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={String(label)}
                  >
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t.manualOnlyBanner}
            </p>
          </div>
        ) : undefined
      }
    />
  );
}
