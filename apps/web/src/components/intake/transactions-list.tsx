"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { intakeFamilies, type documentTypes } from "@/lib/intake/schemas";
import {
  transactionStatuses,
  type TransactionStatus,
} from "@/lib/intake/state";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  formatAmountString,
  formatFailure,
} from "./client";

type TransactionRow = {
  id: string;
  invoiceNumber: string;
  documentDate: string;
  taxPeriod: string;
  taxFamily: (typeof intakeFamilies)[number];
  documentType: (typeof documentTypes)[number];
  status: TransactionStatus;
  totalAmount: string;
  company: { id: string; name: string };
  counterparty: { id: string; name: string; identityHint: string | null };
  documentCount: number;
  lineCount: number;
  hasDuplicate: boolean;
};

export function TransactionsListView({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];
  const [data, setData] = useState<{
    role: Role;
    total: number;
    page: number;
    pageSize: number;
    transactions: TransactionRow[];
  } | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [taxFamily, setTaxFamily] = useState("");
  const [sort, setSort] = useState<"created_desc" | "date_desc" | "date_asc">(
    "created_desc",
  );
  const [page, setPage] = useState(1);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load(nextPage = page) {
    const params = new URLSearchParams({
      page: String(nextPage),
      sort,
    });
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (taxFamily) params.set("taxFamily", taxFamily);
    try {
      const response = await apiGet<NonNullable<typeof data>>(
        `/api/transactions?${params.toString()}`,
      );
      setData(response);
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
      else setFeedback(formatFailure(error, locale));
    }
  }
  useEffect(() => {
    void load(1);
  }, []);

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    void load(1);
  }

  if (noWorkspace) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t.transactionsTitle}</h1>
        <p>{acc.noWorkspace}</p>
        <Link className="underline" href={`/${locale}/app/settings`}>
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }
  const canPrepare = data ? can(data.role, "draft.prepare") : false;
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{t.transactionsTitle}</h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {t.transactionsIntro}
          </p>
        </div>
        {canPrepare && (
          <Button asChild>
            <Link href={`/${locale}/app/transactions/new`}>
              {t.newTransaction}
            </Link>
          </Button>
        )}
      </header>
      {data && !canPrepare && (
        <p className="rounded-md border bg-muted/30 p-4 text-sm">
          {t.preparerRequired}
        </p>
      )}
      <form
        onSubmit={applyFilter}
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
      >
        <Field
          label={t.search}
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={100}
        />
        <label className="block space-y-2 text-sm font-medium">
          <span>{t.status}</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-11 rounded-md border bg-background px-3"
          >
            <option value="">{t.allStatuses}</option>
            {transactionStatuses.map((s) => (
              <option key={s} value={s}>
                {t.statuses[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>{t.taxFamily}</span>
          <select
            value={taxFamily}
            onChange={(e) => setTaxFamily(e.target.value)}
            className="min-h-11 rounded-md border bg-background px-3"
          >
            <option value="">{t.allFamilies}</option>
            {intakeFamilies.map((f) => (
              <option key={f} value={f}>
                {t.families[f]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-medium">
          <span>{t.sort}</span>
          <select
            value={sort}
            onChange={(e) =>
              setSort(
                e.target.value as "created_desc" | "date_desc" | "date_asc",
              )
            }
            className="min-h-11 rounded-md border bg-background px-3"
          >
            <option value="created_desc">{t.sorts.created_desc}</option>
            <option value="date_desc">{t.sorts.date_desc}</option>
            <option value="date_asc">{t.sorts.date_asc}</option>
          </select>
        </label>
        <Button type="submit" variant="outline">
          {t.filter}
        </Button>
      </form>
      {feedback && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {feedback}
        </p>
      )}
      {!data ? (
        <Skeleton className="h-40 w-full" />
      ) : !data.transactions.length ? (
        <p className="rounded-md border p-6 text-sm text-muted-foreground">
          {t.noTransactionsYet}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="p-3 font-semibold">{t.invoiceNumber}</th>
                  <th className="p-3 font-semibold">{t.documentDate}</th>
                  <th className="p-3 font-semibold">{t.company}</th>
                  <th className="p-3 font-semibold">{t.counterparty}</th>
                  <th className="p-3 font-semibold">{t.taxFamily}</th>
                  <th className="p-3 font-semibold">{t.totalAmount}</th>
                  <th className="p-3 font-semibold">{t.status}</th>
                  <th className="p-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="p-3 font-mono font-medium">
                      {tx.invoiceNumber}
                      {tx.hasDuplicate && (
                        <div className="mt-1">
                          <StatusBadge>{t.duplicateBadge}</StatusBadge>
                        </div>
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {tx.documentDate}
                      <div className="text-muted-foreground">
                        {tx.taxPeriod}
                      </div>
                    </td>
                    <td className="p-3">{tx.company.name}</td>
                    <td className="p-3">{tx.counterparty.name}</td>
                    <td className="p-3 text-xs">{t.families[tx.taxFamily]}</td>
                    <td className="p-3 font-mono">
                      {formatAmountString(tx.totalAmount, locale)}
                    </td>
                    <td className="p-3">
                      <StatusBadge active={tx.status !== "VOIDED"}>
                        {t.statuses[tx.status]}
                      </StatusBadge>
                    </td>
                    <td className="p-3">
                      <Link
                        className="underline"
                        href={`/${locale}/app/transactions/${tx.id}`}
                      >
                        {t.openDetail}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>
              {data.page} · {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={data.page <= 1}
                onClick={() => {
                  const next = data.page - 1;
                  setPage(next);
                  void load(next);
                }}
              >
                {t.previousPage}
              </Button>
              <Button
                variant="outline"
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => {
                  const next = data.page + 1;
                  setPage(next);
                  void load(next);
                }}
              >
                {t.nextPage}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
