"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { siteMessages } from "@/i18n/site";
import { allTaxFamilies } from "@/lib/intake/tax-rules";
import { transactionSources } from "@/lib/intake/schemas";
import type { DiscrepancyCode } from "@/lib/reports/schemas";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";

type ReconciliationPayload = {
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
  planAndUsage: {
    trial: {
      usedTotal: number;
      maxTotal: number;
      maxPerJakartaDay: number;
      expiresAt: string;
    } | null;
    entitlements: {
      adapterMode: string;
      saasLicensingApproved: boolean;
      paidAccessEnabled: boolean;
      licenseStatus: string;
      planCode: string | null;
      usage: {
        companiesCount: number;
        membersCount: number;
        monthTransactionsCount: number;
        monthXmlExportsCount: number;
      };
    };
  };
  companies: { id: string; name: string }[];
  pagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  rows: {
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
  }[];
};

export function ReconciliationView({ locale }: { locale: Locale }) {
  const t = reportMessages[locale];
  const site = siteMessages[locale];

  const [data, setData] = useState<ReconciliationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [error, setError] = useState("");

  const [companyId, setCompanyId] = useState("");
  const [taxPeriod, setTaxPeriod] = useState("");
  const [taxFamily, setTaxFamily] = useState("");
  const [source, setSource] = useState("");
  const [search, setSearch] = useState("");
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [page, setPage] = useState(1);

  function buildQueryString(nextPage = page) {
    const params = new URLSearchParams();
    if (companyId) params.set("companyId", companyId);
    if (taxPeriod) params.set("taxPeriod", taxPeriod);
    if (taxFamily) params.set("taxFamily", taxFamily);
    if (source) params.set("source", source);
    if (search.trim()) params.set("search", search.trim());
    if (discrepancyOnly) params.set("discrepancyOnly", "true");
    params.set("page", String(nextPage));
    params.set("pageSize", "10");
    return params.toString();
  }

  async function load(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const payload = await apiGet<ReconciliationPayload>(
        `/api/reports/reconciliation?${buildQueryString(nextPage)}`,
      );
      setData(payload);
      setNoWorkspace(false);
      setPage(payload.pagination.page);
    } catch (err) {
      if (err instanceof ApiFailure && err.code === "NO_WORKSPACE") {
        setNoWorkspace(true);
      } else {
        setError(formatFailure(err, locale));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1);
  }, []);

  function onApplyFilter(e: FormEvent) {
    e.preventDefault();
    void load(1);
  }

  if (loading && !data) return <Skeleton className="h-52 w-full" />;

  if (noWorkspace) {
    return (
      <div className="max-w-xl space-y-4 rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">{t.reconciliationTitle}</h1>
        <p className="text-sm text-muted-foreground">{site.noActiveBody}</p>
        <Link href={`/${locale}/app/settings`} className="text-sm underline">
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p role="alert" className="max-w-xl rounded-lg border p-6 text-sm">
        {error || site.appError}
      </p>
    );
  }

  const csvHref = `/api/reports/reconciliation/export?${buildQueryString(1)}`;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.reconciliationTitle}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.reconciliationIntro}
        </p>
        <p role="note" className="rounded-md border bg-muted/30 p-3 text-xs">
          {t.manualOnlyBanner}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t.cards.total, data.cards.totalTransactions],
          [t.cards.inReview, data.cards.inReviewCount],
          [t.cards.approved, data.cards.approvedCount],
          [t.cards.exported, data.cards.exportedCount],
          [t.cards.coretaxSubmitted, data.cards.coretaxSubmittedCount],
          [t.cards.coretaxAccepted, data.cards.coretaxAcceptedCount],
          [t.cards.coretaxRejected, data.cards.coretaxRejectedCount],
          [t.cards.discrepancies, data.cards.discrepancyCount],
        ].map(([label, val]) => (
          <div key={String(label)} className="rounded-lg border p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold">{val}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2 rounded-lg border p-5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.usagePlanTitle}</h2>
          <StatusBadge>
            {data.planAndUsage.entitlements.licenseStatus}
          </StatusBadge>
        </div>
        <p className="font-mono text-muted-foreground">
          companies={data.planAndUsage.entitlements.usage.companiesCount} ·
          members={data.planAndUsage.entitlements.usage.membersCount} ·
          month_tx={data.planAndUsage.entitlements.usage.monthTransactionsCount}{" "}
          · month_xml=
          {data.planAndUsage.entitlements.usage.monthXmlExportsCount}
          {data.planAndUsage.trial
            ? ` · trial=${data.planAndUsage.trial.usedTotal}/${data.planAndUsage.trial.maxTotal}`
            : ""}
        </p>
      </section>

      <form
        onSubmit={onApplyFilter}
        className="space-y-4 rounded-lg border p-5 text-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.filterTitle}</h2>
          <a
            href={csvHref}
            download
            className="inline-flex min-h-10 items-center rounded-md border px-4 py-2 text-xs font-medium hover:bg-muted"
          >
            {t.downloadCsv}
          </a>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
          <label className="grid gap-1 font-medium">
            {site.companies}
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="min-h-11 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t.allCompanies}</option>
              {data.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 font-medium">
            {site.family}
            <select
              value={taxFamily}
              onChange={(e) => setTaxFamily(e.target.value)}
              className="min-h-11 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t.allFamilies}</option>
              {allTaxFamilies.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 font-medium">
            {t.columns.family}
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="min-h-11 rounded-md border bg-background px-3 text-sm"
            >
              <option value="">{t.allSources}</option>
              {transactionSources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <Field
            label={t.periodLabel}
            value={taxPeriod}
            onChange={(e) => setTaxPeriod(e.target.value)}
            pattern="(\d{4}-(0[1-9]|1[0-2]))?"
          />

          <Field
            label={t.searchLabel}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={discrepancyOnly}
              onChange={(e) => setDiscrepancyOnly(e.target.checked)}
            />
            <span>{t.discrepancyOnlyLabel}</span>
          </label>
          <Button type="submit" disabled={loading}>
            {t.applyFilter}
          </Button>
        </div>
      </form>

      {data.rows.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          {t.noRows}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{t.tableCaption}</caption>
              <thead className="border-b bg-muted/40">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.invoice}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.counterparty}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.family}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.sourceAmount}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.approvedTax}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.exportBatch}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.coretaxOutcome}
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    {t.columns.discrepancy}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.transactionId} className="border-b align-top">
                    <td className="p-3">
                      <Link
                        href={`/${locale}/app/transactions/${row.transactionId}`}
                        className="font-mono font-semibold underline"
                      >
                        {row.invoiceNumber}
                      </Link>
                      <div className="text-muted-foreground">
                        {row.documentDate} ({row.taxPeriod})
                      </div>
                    </td>
                    <td className="p-3">
                      <div>{row.companyName}</div>
                      <div className="text-muted-foreground">
                        {row.counterpartyName}
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      <div>{row.taxFamily}</div>
                      <div className="text-muted-foreground">
                        {row.source} · {row.status}
                      </div>
                    </td>
                    <td className="p-3 font-mono">
                      {formatAmountString(row.sourceAmount, locale)}
                    </td>
                    <td className="p-3 font-mono">
                      {row.approvedDppAmount ? (
                        <>
                          <div>
                            {formatAmountString(row.approvedDppAmount, locale)}
                          </div>
                          <div className="text-muted-foreground">
                            tax:{" "}
                            {formatAmountString(
                              row.approvedTaxAmount ?? "0.00",
                              locale,
                            )}{" "}
                            ({row.ruleCode}@v{row.ruleVersion})
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 font-mono">
                      {row.exportVersion ? (
                        <>
                          <div>v{row.exportVersion}</div>
                          <div className="text-muted-foreground">
                            {row.xmlSha256Prefix}...
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-mono">
                        {row.coretaxOutcome ?? "NOT_RECORDED"}
                      </div>
                      {row.coretaxReference && (
                        <div className="text-muted-foreground">
                          {row.coretaxReference}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge>
                        {t.discrepancies[row.discrepancy]}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label={t.tableCaption}
            className="flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <span>
              {t.pageLabel} {data.pagination.page} /{" "}
              {data.pagination.totalPages} ({data.pagination.totalRows})
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading || data.pagination.page <= 1}
                onClick={() => void load(data.pagination.page - 1)}
              >
                {t.prevPage}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  loading || data.pagination.page >= data.pagination.totalPages
                }
                onClick={() => void load(data.pagination.page + 1)}
              >
                {t.nextPage}
              </Button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
