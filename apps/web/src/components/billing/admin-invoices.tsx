"use client";
import Link from "next/link";
import { useState } from "react";
import { Ban, CircleCheck, FilePlus2, FileText, Send } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { formatDate } from "@/i18n/format";
import { salesMessages } from "@/i18n/sales";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput } from "@/components/ui/field";
import { Notice, Skeleton } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { PagedFooter, usePaged } from "@/components/views/paged";
import { useResource } from "@/components/views/use-resource";
import {
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";
import { invoiceDisplayStatus, type Invoice } from "./invoices";

type Payload = {
  sellerConfigured: boolean;
  suggestedPeriod: string;
  invoices: (Invoice & { workspace: string })[];
};
type Action =
  | { kind: "issue"; invoice: Invoice; paymentLink: string }
  | {
      kind: "paid";
      invoice: Invoice;
      paidOn: string;
      method: string;
      reference: string;
    }
  | { kind: "void"; invoice: Invoice; reason: string };

export function AdminInvoices({ locale }: { locale: Locale }) {
  const t = salesMessages[locale];
  const v = viewMessages[locale];
  const toast = useToast();
  const { data, error, reload } = useResource(() =>
    apiGet<Payload>("/api/admin/invoices"),
  );
  const [period, setPeriod] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const paged = usePaged(data?.invoices ?? []);

  async function post(
    body: unknown,
    done?: (r: Record<string, unknown>) => void,
  ) {
    setBusy(true);
    try {
      const result = await apiPost<Record<string, unknown>>(
        "/api/admin/invoices",
        body,
      );
      done?.(result);
      setAction(null);
      await reload();
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return <Notice tone="danger">{formatFailure(error, locale)}</Notice>;
  if (!data) return <Skeleton className="h-40 w-full" />;
  const chosen = period ?? data.suggestedPeriod;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.invoicesIntro}</p>
      {!data.sellerConfigured && (
        <Notice tone="warning">{t.sellerMissing}</Notice>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <FormField field="invoice.period" className="w-48">
          <TextInput
            type="month"
            value={chosen}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </FormField>
        <Button
          disabled={busy || !/^\d{4}-\d{2}$/.test(chosen)}
          onClick={() =>
            void post({ action: "generate", period: chosen }, (r) =>
              toast.success(fmt(t.generated, { n: Number(r.created ?? 0) })),
            )
          }
        >
          <FilePlus2 aria-hidden="true" />
          <span>{t.generate}</span>
        </Button>
      </div>
      {data.invoices.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t.noInvoices}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.workspace}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.number}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.month}
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold">
                    {t.invoicesProcessed}
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
                    <td className="px-3 py-2.5 font-medium">{inv.workspace}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {inv.number ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 font-mono">{inv.period}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {inv.invoiceCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                      {formatAmountString(inv.totalIdr, locale)}
                    </td>
                    <td className="px-3 py-2.5">
                      <CodeBadge
                        domain="invoiceStatus"
                        code={invoiceDisplayStatus(inv)}
                      />
                      {inv.dueAt && inv.status === "ISSUED" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t.dueDate}: {formatDate(new Date(inv.dueAt), locale)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            href={`/${locale}/invoice/${inv.id}`}
                            target="_blank"
                          >
                            <FileText aria-hidden="true" />
                            <span>{t.view}</span>
                          </Link>
                        </Button>
                        {inv.status === "DRAFT" && (
                          <Button
                            size="sm"
                            disabled={!data.sellerConfigured}
                            onClick={() =>
                              setAction({
                                kind: "issue",
                                invoice: inv,
                                paymentLink: "",
                              })
                            }
                          >
                            <Send aria-hidden="true" />
                            <span>{t.issue}</span>
                          </Button>
                        )}
                        {inv.status === "ISSUED" && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() =>
                              setAction({
                                kind: "paid",
                                invoice: inv,
                                paidOn: new Date().toISOString().slice(0, 10),
                                method: "",
                                reference: "",
                              })
                            }
                          >
                            <CircleCheck aria-hidden="true" />
                            <span>{t.markPaid}</span>
                          </Button>
                        )}
                        {(inv.status === "DRAFT" ||
                          inv.status === "ISSUED") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger-soft"
                            onClick={() =>
                              setAction({
                                kind: "void",
                                invoice: inv,
                                reason: "",
                              })
                            }
                          >
                            <Ban aria-hidden="true" />
                            <span>{t.voidInvoice}</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PagedFooter paged={paged} v={v} />
        </div>
      )}

      <Dialog
        open={action !== null}
        onClose={() => setAction(null)}
        title={
          action
            ? `${action.kind === "issue" ? t.issue : action.kind === "paid" ? t.markPaid : t.voidInvoice} · ${action.invoice.period}`
            : ""
        }
        size="sm"
        closeLabel={v.cancel}
        footer={
          <>
            <Button variant="outline" onClick={() => setAction(null)}>
              {v.cancel}
            </Button>
            {action && (
              <Button
                variant={
                  action.kind === "void"
                    ? "danger"
                    : action.kind === "paid"
                      ? "success"
                      : "default"
                }
                disabled={
                  busy ||
                  (action.kind === "paid" &&
                    (action.method.trim().length < 2 ||
                      action.reference.trim().length < 2)) ||
                  (action.kind === "void" && action.reason.trim().length < 3)
                }
                onClick={() => {
                  if (action.kind === "issue")
                    void post({
                      action: "issue",
                      invoiceId: action.invoice.id,
                      paymentLink: action.paymentLink || undefined,
                    });
                  else if (action.kind === "paid")
                    void post({
                      action: "mark_paid",
                      invoiceId: action.invoice.id,
                      paidOn: action.paidOn,
                      method: action.method,
                      reference: action.reference,
                    });
                  else
                    void post({
                      action: "void",
                      invoiceId: action.invoice.id,
                      reason: action.reason,
                    });
                }}
              >
                {action.kind === "issue"
                  ? t.issue
                  : action.kind === "paid"
                    ? t.markPaid
                    : t.voidInvoice}
              </Button>
            )}
          </>
        }
      >
        {action?.kind === "issue" && (
          <FormField field="invoice.paymentLink">
            <TextInput
              type="url"
              value={action.paymentLink}
              onChange={(e) =>
                setAction({ ...action, paymentLink: e.target.value })
              }
            />
          </FormField>
        )}
        {action?.kind === "paid" && (
          <div className="space-y-3">
            <FormField field="invoice.paidOn" required>
              <TextInput
                type="date"
                value={action.paidOn}
                onChange={(e) =>
                  setAction({ ...action, paidOn: e.target.value })
                }
              />
            </FormField>
            <FormField field="invoice.paymentMethod" required>
              <TextInput
                value={action.method}
                onChange={(e) =>
                  setAction({ ...action, method: e.target.value })
                }
                maxLength={60}
              />
            </FormField>
            <FormField field="invoice.paymentReference" required>
              <TextInput
                value={action.reference}
                onChange={(e) =>
                  setAction({ ...action, reference: e.target.value })
                }
                maxLength={120}
              />
            </FormField>
          </div>
        )}
        {action?.kind === "void" && (
          <FormField field="invoice.voidReason" required>
            <TextInput
              value={action.reason}
              onChange={(e) => setAction({ ...action, reason: e.target.value })}
              maxLength={500}
            />
          </FormField>
        )}
      </Dialog>
    </div>
  );
}
