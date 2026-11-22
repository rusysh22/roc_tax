"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { codeOptions } from "@/i18n/codes";
import { formatDate } from "@/i18n/format";
import { salesMessages } from "@/i18n/sales";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import {
  Checkbox,
  FormField,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { Notice, Skeleton } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { comboLabels } from "@/components/views/page-state";
import { PagedFooter, usePaged } from "@/components/views/paged";
import { useResource } from "@/components/views/use-resource";
import { AdminInvoices } from "./admin-invoices";
import { AdminLifecycle } from "./admin-lifecycle";
import {
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";

type Lead = {
  id: string;
  companyName: string;
  picName: string;
  email: string;
  phone: string;
  npwpHint: string | null;
  estimatedMonthlyInvoices: number | null;
  message: string;
  status: "NEW" | "CONTACTED" | "CONVERTED" | "REJECTED";
  notes: string;
  createdAt: string;
};
type Offer = {
  pricingModel: "SUBSCRIPTION" | "PER_INVOICE";
  pricePerInvoiceIdr: string;
  minimumMonthlyIdr: string;
  vatRatePercent: string;
  paymentTermDays: number;
  monthlyInvoiceCap: number | null;
  offerReference: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  notes: string;
  chargeThisMonthIdr: string | null;
};
type Workspace = {
  id: string;
  name: string;
  legalName: string;
  members: number;
  invoicesThisMonth: number;
  offer: Offer | null;
};
type Payload = { leads: Lead[]; workspaces: Workspace[] };

const th = "px-3 py-2.5 text-left font-semibold whitespace-nowrap";

export function SalesAdmin({ locale }: { locale: Locale }) {
  const t = salesMessages[locale];
  const v = viewMessages[locale];
  const toast = useToast();
  const labels = comboLabels(locale);
  const { data, error, reload } = useResource(() =>
    apiGet<Payload>("/api/admin/sales"),
  );
  const leadsPage = usePaged(data?.leads ?? []);
  const workspacesPage = usePaged(data?.workspaces ?? []);
  const [lead, setLead] = useState<Lead | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function save(body: unknown, close: () => void) {
    setBusy(true);
    try {
      await apiPost("/api/admin/sales", body);
      toast.success(t.saved);
      close();
      await reload();
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setBusy(false);
    }
  }

  function openOffer(w: Workspace) {
    setWorkspace(w);
    setOffer(
      w.offer ?? {
        pricingModel: "PER_INVOICE",
        pricePerInvoiceIdr: "0.00",
        minimumMonthlyIdr: "0.00",
        vatRatePercent: "0.00",
        paymentTermDays: 14,
        monthlyInvoiceCap: null,
        offerReference: "",
        effectiveFrom: today,
        effectiveTo: null,
        active: true,
        notes: "",
        chargeThisMonthIdr: null,
      },
    );
  }

  if (error)
    return <Notice tone="danger">{formatFailure(error, locale)}</Notice>;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const leadsTab =
    data.leads.length === 0 ? (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {t.noLeads}
      </p>
    ) : (
      <div className="overflow-hidden rounded-lg border">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className={th}>{t.received}</th>
                <th className={th}>{t.workspace}</th>
                <th className={th}>{t.contact}</th>
                <th className={`${th} text-right`}>{t.estimated}</th>
                <th className={th}>{v.status}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {leadsPage.rows.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {formatDate(new Date(l.createdAt), locale)}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{l.companyName}</p>
                    {l.message && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {l.message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <p>{l.picName}</p>
                    <p className="text-xs text-muted-foreground break-all">
                      {l.email} · {l.phone}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                    {l.estimatedMonthlyInvoices ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <CodeBadge domain="leadStatus" code={l.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLead(l)}
                    >
                      <Pencil aria-hidden="true" />
                      <span>{t.edit}</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PagedFooter paged={leadsPage} v={v} />
      </div>
    );

  const offersTab = (
    <div className="overflow-hidden rounded-lg border">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className={th}>{t.workspace}</th>
              <th className={th}>{t.pricePerInvoice}</th>
              <th className={`${th} text-right`}>{t.invoicesThisMonth}</th>
              <th className={`${th} text-right`}>{t.chargeThisMonth}</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {workspacesPage.rows.map((w) => (
              <tr key={w.id}>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {w.legalName} · {t.members}: {w.members}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  {w.offer ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <CodeBadge
                        domain="pricingModel"
                        code={w.offer.pricingModel}
                        info={false}
                      />
                      {w.offer.pricingModel === "PER_INVOICE" && (
                        <span className="font-mono text-xs">
                          {formatAmountString(
                            w.offer.pricePerInvoiceIdr,
                            locale,
                          )}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t.noOffer}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                  {w.invoicesThisMonth}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums">
                  {w.offer?.chargeThisMonthIdr
                    ? formatAmountString(w.offer.chargeThisMonthIdr, locale)
                    : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openOffer(w)}
                  >
                    <Pencil aria-hidden="true" />
                    <span>{t.edit}</span>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PagedFooter paged={workspacesPage} v={v} />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t.adminTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.adminIntro}</p>
      </div>
      <div className="rounded-xl border bg-surface p-4 shadow-xs sm:p-6">
        <Tabs
          label={t.adminTitle}
          items={[
            {
              id: "leads",
              label: t.tabLeads,
              badge:
                data.leads.filter((l) => l.status === "NEW").length ||
                undefined,
              content: leadsTab,
            },
            { id: "offers", label: t.tabOffers, content: offersTab },
            {
              id: "invoices",
              label: t.tabInvoices,
              content: <AdminInvoices locale={locale} />,
            },
            {
              id: "lifecycle",
              label: t.tabLifecycle,
              content: (
                <AdminLifecycle
                  locale={locale}
                  workspaces={data.workspaces.map((w) => ({
                    id: w.id,
                    name: w.name,
                  }))}
                />
              ),
            },
          ]}
        />
      </div>

      <Dialog
        open={lead !== null}
        onClose={() => setLead(null)}
        title={lead?.companyName ?? ""}
        size="sm"
        closeLabel={v.cancel}
        footer={
          <>
            <Button variant="outline" onClick={() => setLead(null)}>
              {v.cancel}
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                lead &&
                void save(
                  {
                    action: "lead_update",
                    leadId: lead.id,
                    status: lead.status,
                    notes: lead.notes,
                  },
                  () => setLead(null),
                )
              }
            >
              {t.save}
            </Button>
          </>
        }
      >
        {lead && (
          <div className="space-y-3">
            <FormField field="lead.status" required>
              <Combobox
                value={lead.status}
                onChange={(value) =>
                  value && setLead({ ...lead, status: value as Lead["status"] })
                }
                options={codeOptions(locale, "leadStatus")}
                labels={labels}
              />
            </FormField>
            <FormField field="lead.notes">
              <TextArea
                value={lead.notes}
                onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                rows={4}
                maxLength={2000}
              />
            </FormField>
          </div>
        )}
      </Dialog>

      <Dialog
        open={workspace !== null && offer !== null}
        onClose={() => setWorkspace(null)}
        title={workspace ? fmt(t.offerTitle, { name: workspace.name }) : ""}
        closeLabel={v.cancel}
        footer={
          <>
            <Button variant="outline" onClick={() => setWorkspace(null)}>
              {v.cancel}
            </Button>
            <Button
              disabled={busy || !offer?.offerReference.trim()}
              onClick={() =>
                workspace &&
                offer &&
                void save(
                  {
                    action: "offer_upsert",
                    organizationId: workspace.id,
                    pricingModel: offer.pricingModel,
                    vatRatePercent: offer.vatRatePercent,
                    paymentTermDays: offer.paymentTermDays,
                    pricePerInvoiceIdr: offer.pricePerInvoiceIdr,
                    minimumMonthlyIdr: offer.minimumMonthlyIdr,
                    monthlyInvoiceCap: offer.monthlyInvoiceCap,
                    offerReference: offer.offerReference,
                    effectiveFrom: offer.effectiveFrom,
                    effectiveTo: offer.effectiveTo,
                    active: offer.active,
                    notes: offer.notes,
                  },
                  () => setWorkspace(null),
                )
              }
            >
              {t.save}
            </Button>
          </>
        }
      >
        {offer && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              field="offer.pricingModel"
              required
              className="sm:col-span-2"
            >
              <Combobox
                value={offer.pricingModel}
                onChange={(value) =>
                  value &&
                  setOffer({
                    ...offer,
                    pricingModel: value as Offer["pricingModel"],
                  })
                }
                options={codeOptions(locale, "pricingModel")}
                labels={labels}
              />
            </FormField>
            <FormField field="offer.pricePerInvoiceIdr" required>
              <TextInput
                value={offer.pricePerInvoiceIdr}
                inputMode="decimal"
                onChange={(e) =>
                  setOffer({ ...offer, pricePerInvoiceIdr: e.target.value })
                }
                className="font-mono"
              />
            </FormField>
            <FormField field="offer.minimumMonthlyIdr" required>
              <TextInput
                value={offer.minimumMonthlyIdr}
                inputMode="decimal"
                onChange={(e) =>
                  setOffer({ ...offer, minimumMonthlyIdr: e.target.value })
                }
                className="font-mono"
              />
            </FormField>
            <FormField field="offer.vatRatePercent" required>
              <TextInput
                value={offer.vatRatePercent}
                inputMode="decimal"
                onChange={(e) =>
                  setOffer({ ...offer, vatRatePercent: e.target.value })
                }
                className="font-mono"
              />
            </FormField>
            <FormField field="offer.paymentTermDays" required>
              <TextInput
                type="number"
                min={0}
                max={120}
                value={offer.paymentTermDays}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    paymentTermDays: Number(e.target.value),
                  })
                }
              />
            </FormField>
            <FormField field="offer.monthlyInvoiceCap">
              <TextInput
                type="number"
                min={1}
                value={offer.monthlyInvoiceCap ?? ""}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    monthlyInvoiceCap: e.target.value
                      ? Number(e.target.value)
                      : null,
                  })
                }
              />
            </FormField>
            <FormField field="offer.offerReference" required>
              <TextInput
                value={offer.offerReference}
                onChange={(e) =>
                  setOffer({ ...offer, offerReference: e.target.value })
                }
                maxLength={120}
              />
            </FormField>
            <FormField field="offer.effectiveFrom" required>
              <TextInput
                type="date"
                value={offer.effectiveFrom}
                onChange={(e) =>
                  setOffer({ ...offer, effectiveFrom: e.target.value })
                }
              />
            </FormField>
            <FormField field="offer.effectiveTo">
              <TextInput
                type="date"
                value={offer.effectiveTo ?? ""}
                onChange={(e) =>
                  setOffer({ ...offer, effectiveTo: e.target.value || null })
                }
              />
            </FormField>
            <FormField field="offer.notes" className="sm:col-span-2">
              <TextArea
                value={offer.notes}
                onChange={(e) => setOffer({ ...offer, notes: e.target.value })}
                rows={2}
                maxLength={2000}
              />
            </FormField>
            <Checkbox
              className="sm:col-span-2"
              label={v.active}
              checked={offer.active}
              onChange={(e) => setOffer({ ...offer, active: e.target.checked })}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
