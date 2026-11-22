"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, FileText, Printer } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { formatDate } from "@/i18n/format";
import { salesMessages } from "@/i18n/sales";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Notice, Skeleton } from "@/components/ui/status";
import { BrandLogo } from "@/components/ui/brand";
import {
  apiGet,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";
import { PagedFooter, usePaged } from "@/components/views/paged";

export type Invoice = {
  id: string;
  workspace: string;
  number: string | null;
  period: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  invoiceCount: number;
  pricePerInvoiceIdr: string;
  minimumMonthlyIdr: string;
  subtotalIdr: string;
  vatRatePercent: string;
  vatIdr: string;
  totalIdr: string;
  offerReference: string;
  seller: Record<string, string | null>;
  buyer: Record<string, string | null>;
  paymentLink: string | null;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  voidReason: string | null;
};

/** Display status: issued invoices past their due date show as overdue. */
export function invoiceDisplayStatus(inv: Pick<Invoice, "status" | "dueAt">) {
  return inv.status === "ISSUED" &&
    inv.dueAt &&
    new Date(inv.dueAt) < new Date()
    ? "OVERDUE"
    : inv.status;
}

/** Customer invoice list (Subscription → Invoices). */
export function InvoicesTab({ locale }: { locale: Locale }) {
  const t = salesMessages[locale];
  const v = viewMessages[locale];
  const [data, setData] = useState<Invoice[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<{ invoices: Invoice[] }>("/api/billing/invoices")
      .then((r) => setData(r.invoices))
      .catch((e: unknown) => setError(formatFailure(e, locale)));
  }, [locale]);
  const paged = usePaged(data ?? []);
  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!data) return <Skeleton className="h-40 w-full" />;
  return (
    <section className="space-y-4">
      <div className="space-y-0.5 border-b pb-2">
        <h2 className="text-base font-semibold">{t.invoicesTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {t.invoicesCustomerIntro}
        </p>
      </div>
      {data.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t.noInvoices}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.number}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.month}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.dueDate}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t.totalLabel}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {v.status}
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.rows.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {inv.number}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{inv.period}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {inv.dueAt
                        ? formatDate(new Date(inv.dueAt), locale)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                      {formatAmountString(inv.totalIdr, locale)}
                    </td>
                    <td className="px-3 py-2.5">
                      <CodeBadge
                        domain="invoiceStatus"
                        code={invoiceDisplayStatus(inv)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {inv.paymentLink &&
                        invoiceDisplayStatus(inv) !== "PAID" &&
                        inv.status !== "VOID" && (
                          <Button asChild size="sm" className="mr-2">
                            <a
                              href={inv.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink aria-hidden="true" />
                              <span>{t.payNow}</span>
                            </a>
                          </Button>
                        )}
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`/${locale}/invoice/${inv.id}`}
                          target="_blank"
                        >
                          <FileText aria-hidden="true" />
                          <span>{t.view}</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PagedFooter paged={paged} v={v} />
        </div>
      )}
    </section>
  );
}

/** Printable invoice sheet (browser print → PDF). */
export function InvoiceSheet({
  locale,
  invoiceId,
}: {
  locale: Locale;
  invoiceId: string;
}) {
  const t = salesMessages[locale];
  const [inv, setInv] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    apiGet<Invoice>(`/api/billing/invoices/${encodeURIComponent(invoiceId)}`)
      .then(setInv)
      .catch((e: unknown) => setError(formatFailure(e, locale)));
  }, [invoiceId, locale]);
  if (error)
    return (
      <Notice tone="danger" className="m-8">
        {error}
      </Notice>
    );
  if (!inv) return <Skeleton className="m-8 h-96" />;
  const money = (a: string) => formatAmountString(a, locale);
  const date = (iso: string | null) =>
    iso ? formatDate(new Date(iso), locale) : "—";
  const usage = (
    BigInt(inv.invoiceCount) * BigInt(inv.pricePerInvoiceIdr.replace(".", ""))
  ).toString();
  const minimumApplied =
    BigInt(inv.subtotalIdr.replace(".", "")) > BigInt(usage) &&
    inv.minimumMonthlyIdr !== "0.00";
  const s = inv.seller;
  const status = invoiceDisplayStatus(inv);
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:max-w-none print:p-0">
      <div className="flex justify-end gap-2 print:hidden">
        {inv.paymentLink && status !== "PAID" && inv.status !== "VOID" && (
          <Button asChild>
            <a href={inv.paymentLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              <span>{t.payNow}</span>
            </a>
          </Button>
        )}
        <Button variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          <span>{t.print}</span>
        </Button>
      </div>
      <article className="space-y-8 rounded-xl border bg-white p-8 text-sm text-black shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {inv.status === "DRAFT" && (
          <p className="rounded border border-amber-400 bg-amber-50 px-3 py-2 text-center font-semibold text-amber-800">
            {t.draftWatermark}
          </p>
        )}
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1">
            <BrandLogo className="h-8 text-black" />
            <p className="pt-2 font-semibold">{s.name}</p>
            {s.address && (
              <p className="max-w-xs text-xs whitespace-pre-line">
                {s.address}
              </p>
            )}
            {s.npwp && <p className="text-xs">NPWP {s.npwp}</p>}
            {s.email && <p className="text-xs">{s.email}</p>}
          </div>
          <div className="space-y-1 text-right">
            <h1 className="text-2xl font-bold tracking-wide">
              {t.invoiceTitle}
            </h1>
            <p className="font-mono text-xs">{inv.number ?? "—"}</p>
            <div className="pt-1">
              <CodeBadge domain="invoiceStatus" code={status} info={false} />
            </div>
          </div>
        </header>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-neutral-500 uppercase">
              {t.billedTo}
            </p>
            <p className="font-semibold">{inv.buyer.name}</p>
            <p className="text-xs">{inv.buyer.workspace}</p>
            {inv.buyer.contactName && (
              <p className="text-xs">
                {inv.buyer.contactName} · {inv.buyer.contactEmail}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs sm:justify-self-end">
            <dt className="text-neutral-500">{t.issuedOn}</dt>
            <dd>{date(inv.issuedAt)}</dd>
            <dt className="text-neutral-500">{t.dueDate}</dt>
            <dd className="font-semibold">{date(inv.dueAt)}</dd>
            <dt className="text-neutral-500">{t.month}</dt>
            <dd className="font-mono">{inv.period}</dd>
            <dt className="text-neutral-500">{t.offerRef}</dt>
            <dd>{inv.offerReference}</dd>
          </dl>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black text-xs uppercase">
              <th className="py-2 text-left">{t.description}</th>
              <th className="py-2 text-right">{t.pricePerInvoice}</th>
              <th className="py-2 text-right">{t.charge}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-3">
                {fmt(t.usageLine, { n: inv.invoiceCount, period: inv.period })}
                {minimumApplied && (
                  <p className="text-xs text-neutral-500">
                    {t.minimumApplied}: {money(inv.minimumMonthlyIdr)}
                  </p>
                )}
              </td>
              <td className="py-3 text-right font-mono">
                {money(inv.pricePerInvoiceIdr)}
              </td>
              <td className="py-3 text-right font-mono">
                {money(inv.subtotalIdr)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-3 text-right">
                {t.subtotal}
              </td>
              <td className="pt-3 text-right font-mono">
                {money(inv.subtotalIdr)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1 text-right">
                {fmt(t.vat, { rate: inv.vatRatePercent })}
              </td>
              <td className="py-1 text-right font-mono">{money(inv.vatIdr)}</td>
            </tr>
            <tr className="border-t-2 border-black text-base font-bold">
              <td colSpan={2} className="pt-2 text-right">
                {t.totalLabel}
              </td>
              <td className="pt-2 text-right font-mono">
                {money(inv.totalIdr)}
              </td>
            </tr>
          </tfoot>
        </table>
        {inv.status !== "VOID" && (
          <section className="space-y-1 rounded border border-neutral-300 p-4 text-xs">
            <p className="font-semibold">{t.paymentInstructions}</p>
            {s.bankName && (
              <p>
                {fmt(t.transferTo, {
                  bank: s.bankName,
                  account: s.bankAccountNo ?? "",
                  name: s.bankAccountName ?? "",
                })}
              </p>
            )}
            {inv.paymentLink && <p className="break-all">{inv.paymentLink}</p>}
            <p className="text-neutral-500">{t.quoteNumber}</p>
          </section>
        )}
      </article>
    </div>
  );
}
