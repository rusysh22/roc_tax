"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { exportMessages } from "@/i18n/exports";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { formatDate } from "@/i18n/format";
import { sumAmounts } from "@/lib/intake/decimal";
import type { CoretaxOutcomeStatus } from "@/lib/export/bppu-spec";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import {
  FieldGroup,
  FormField,
  ReadValue,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import {
  Chatter,
  FormPage,
  SheetTitle,
  StatusBar,
} from "@/components/views/form-view";
import { ListPage } from "@/components/views/list-page";
import { NoWorkspace, comboLabels } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import { Wizard } from "@/components/views/wizard";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatAmountString,
  formatFailure,
} from "@/components/intake/client";

type FamilyEntry = {
  taxFamily: string;
  state: "AVAILABLE" | "TEMPLATE_UNVERIFIED";
  template: {
    id: string;
    versionTag: string;
    sourceUrl: string;
    sourceLabel: string;
    sourceSha256: string;
  } | null;
};
type EligibleTx = {
  id: string;
  companyId: string;
  counterpartyName: string;
  taxFamily: string;
  taxPeriod: string;
  invoiceNumber: string;
  snapshot: {
    objectCode: string;
    dppAmount: string;
    taxAmount: string;
    ratePercent: string;
  } | null;
};
type Outcome = {
  id: string;
  outcome: CoretaxOutcomeStatus;
  coretaxReference: string | null;
  notes: string | null;
  recordedBy: string;
  recordedAt: string;
};
export type ExportBatchRow = {
  id: string;
  companyId: string;
  companyName: string;
  taxFamily: string;
  taxPeriod: string;
  templateVersionTag: string;
  exportVersion: number;
  fileName: string;
  xmlSha256: string;
  sizeBytes: number;
  itemCount: number;
  totalDppAmount: string;
  totalTaxAmount: string;
  exportedBy: string;
  exportedAt: string;
  items: {
    id: string;
    transactionId: string;
    sequenceNo: number;
    taxObjectCode: string;
    dppAmount: string;
    taxAmount: string;
    ratePercent: string;
  }[];
  outcomes: Outcome[];
};
type Payload = {
  role: Role;
  companies: {
    id: string;
    name: string;
    npwpHint: string | null;
    nitkuHint: string | null;
  }[];
  familyMatrix: FamilyEntry[];
  eligibleTransactions: EligibleTx[];
  batches: ExportBatchRow[];
};

function exportError(error: unknown, locale: Locale) {
  if (error instanceof ApiFailure) {
    const map = exportMessages[locale].errors as Record<string, string>;
    if (map[error.code]) return map[error.code];
  }
  return formatFailure(error, locale);
}

const latestOutcome = (b: ExportBatchRow) => b.outcomes[0]?.outcome ?? null;

function outcomeLabel(locale: Locale, outcome: CoretaxOutcomeStatus | null) {
  const t = exportMessages[locale];
  if (outcome === "CORETAX_ACCEPTED") return t.outcomeAccepted;
  if (outcome === "CORETAX_REJECTED") return t.outcomeRejected;
  if (outcome === "CORETAX_SUBMITTED") return t.outcomeSubmitted;
  return intakeMessages[locale].statuses.EXPORTED;
}

function OutcomeBadge({
  locale,
  outcome,
}: {
  locale: Locale;
  outcome: CoretaxOutcomeStatus | null;
}) {
  // Short visible label; the full label (with the technical code) is the tooltip.
  const full = outcomeLabel(locale, outcome);
  const label = (
    <span title={full}>{full.replace(/\s*\([^)]*\)\s*$/, "")}</span>
  );
  if (outcome === "CORETAX_ACCEPTED")
    return (
      <Badge tone="solid" dot>
        {label}
      </Badge>
    );
  if (outcome === "CORETAX_REJECTED")
    return (
      <Badge tone="muted" dot>
        {label}
      </Badge>
    );
  if (outcome === "CORETAX_SUBMITTED")
    return (
      <Badge tone="neutral" dot>
        {label}
      </Badge>
    );
  return <Badge tone="outline">{label}</Badge>;
}

export function ExportsList({ locale }: { locale: Locale }) {
  const t = exportMessages[locale];
  const s = shellMessages[locale];
  const intake = intakeMessages[locale];
  const v = viewMessages[locale];
  const [wizard, setWizard] = useState(false);
  const { data, noWorkspace, reload } = useResource(() =>
    apiGet<Payload>("/api/exports"),
  );
  const canExport = data ? can(data.role, "tax.export") : false;

  const fields = useMemo<ViewField<ExportBatchRow>[]>(
    () => [
      {
        name: "fileName",
        label: t.historyTitle,
        type: "text",
        value: (b) => b.fileName,
        searchable: true,
        sortable: true,
      },
      {
        name: "company",
        label: t.companyLabel,
        type: "enum",
        value: (b) => b.companyId,
        display: (b) => b.companyName,
        filterable: true,
        groupable: true,
      },
      {
        name: "taxFamily",
        label: t.familyLabel,
        type: "enum",
        value: (b) => b.taxFamily,
        filterable: true,
        groupable: true,
      },
      {
        name: "taxPeriod",
        label: t.periodLabel,
        type: "enum",
        value: (b) => b.taxPeriod,
        filterable: true,
        groupable: true,
        sortable: true,
      },
      {
        name: "outcome",
        label: t.recordOutcomeTitle,
        type: "enum",
        value: (b) => latestOutcome(b) ?? "NONE",
        display: (b) => outcomeLabel(locale, latestOutcome(b)),
        options: [
          { value: "NONE", label: outcomeLabel(locale, null) },
          { value: "CORETAX_SUBMITTED", label: t.outcomeSubmitted },
          { value: "CORETAX_ACCEPTED", label: t.outcomeAccepted },
          { value: "CORETAX_REJECTED", label: t.outcomeRejected },
        ],
        filterable: true,
        groupable: true,
      },
      {
        name: "exportedAt",
        label: v.from,
        type: "date",
        value: (b) => b.exportedAt,
        display: (b) => b.exportedAt.slice(0, 10),
        filterable: true,
        sortable: true,
      },
      {
        name: "totalTaxAmount",
        label: t.totalsLabel,
        type: "number",
        value: (b) => b.totalTaxAmount,
        exportable: true,
      },
    ],
    [t, v, locale],
  );

  const columns: Column<ExportBatchRow>[] = [
    {
      key: "file",
      header: t.historyTitle,
      sortField: "fileName",
      primary: true,
      cell: (b) => (
        <span className="inline-flex items-center gap-2">
          <FileSpreadsheet
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="font-mono text-[0.8125rem]">{b.fileName}</span>
        </span>
      ),
    },
    {
      key: "company",
      header: t.companyLabel,
      cell: (b) => b.companyName,
      hideBelow: "lg",
    },
    {
      key: "period",
      header: t.periodLabel,
      sortField: "taxPeriod",
      cell: (b) => <span className="font-mono text-xs">{b.taxPeriod}</span>,
    },
    {
      key: "items",
      header: t.itemsCountLabel,
      align: "right",
      cell: (b) => <span className="tabular-nums">{b.itemCount}</span>,
      hideBelow: "md",
    },
    {
      key: "tax",
      header: intake.totalAmount,
      align: "right",
      cell: (b) => (
        <span className="font-mono text-[0.8125rem] whitespace-nowrap">
          {formatAmountString(b.totalTaxAmount, locale)}
        </span>
      ),
      aggregate: (rows) => (
        <span className="font-mono text-[0.8125rem]">
          {formatAmountString(
            sumAmounts(rows.map((r) => r.totalTaxAmount)) ?? "0.00",
            locale,
          )}
        </span>
      ),
    },
    {
      key: "outcome",
      header: t.recordOutcomeTitle,
      cell: (b) => <OutcomeBadge locale={locale} outcome={latestOutcome(b)} />,
    },
    {
      key: "date",
      header: v.from,
      sortField: "exportedAt",
      cell: (b) => (
        <span className="text-xs whitespace-nowrap">
          {formatDate(new Date(b.exportedAt), locale)}
        </span>
      ),
      hideBelow: "xl",
    },
  ];

  if (noWorkspace) return <NoWorkspace locale={locale} />;
  return (
    <>
      <ListPage
        locale={locale}
        title={s.menuExports}
        model="exports"
        fields={fields}
        columns={columns}
        records={data?.batches ?? null}
        getId={(b) => b.id}
        href={(b) => `/${locale}/app/exports/${b.id}`}
        rowLabel={(b) => b.fileName}
        onCreate={() => setWizard(true)}
        canCreate={canExport}
        emptyIcon={<FileSpreadsheet />}
        emptyTitle={t.noBatches}
        emptyHint={t.pageIntro}
        banner={<Notice>{t.pageIntro}</Notice>}
      />
      {data && (
        <ExportWizard
          locale={locale}
          open={wizard}
          onClose={() => setWizard(false)}
          payload={data}
          onDone={async (batchId) => {
            setWizard(false);
            await reload();
            window.location.assign(`/${locale}/app/exports/${batchId}`);
          }}
        />
      )}
    </>
  );
}

function ExportWizard({
  locale,
  open,
  onClose,
  payload,
  onDone,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  payload: Payload;
  onDone: (batchId: string) => Promise<void>;
}) {
  const t = exportMessages[locale];
  const intake = intakeMessages[locale];
  const toast = useToast();
  const labels = comboLabels(locale);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [taxFamily, setTaxFamily] = useState("PPH_UNIFIKASI_BPPU");
  const [taxPeriod, setTaxPeriod] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" })
      .format(new Date())
      .slice(0, 7),
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const company = companyId ?? payload.companies[0]?.id ?? null;
  const family = payload.familyMatrix.find((f) => f.taxFamily === taxFamily);
  const eligible = payload.eligibleTransactions.filter(
    (tx) =>
      tx.companyId === company &&
      tx.taxFamily === taxFamily &&
      tx.taxPeriod === taxPeriod &&
      tx.snapshot,
  );
  const chosen = eligible.filter((tx) => selected.includes(tx.id));

  const scope = (
    <div className="space-y-6">
      {error && (
        <Notice tone="strong" role="alert">
          {error}
        </Notice>
      )}
      <FieldGroup>
        <FormField label={t.companyLabel} required layout="inline">
          <Combobox
            value={company}
            onChange={(value) => {
              setCompanyId(value);
              setSelected([]);
            }}
            options={payload.companies.map((c) => ({
              value: c.id,
              label: c.name,
              description: c.npwpHint ? `NPWP •••• ${c.npwpHint}` : undefined,
            }))}
            labels={labels}
          />
        </FormField>
        <FormField label={t.familyLabel} required layout="inline">
          <Combobox
            value={taxFamily}
            onChange={(value) => {
              if (value) setTaxFamily(value);
              setSelected([]);
            }}
            options={payload.familyMatrix.map((f) => ({
              value: f.taxFamily,
              label: f.taxFamily,
              description:
                f.state === "AVAILABLE" ? t.availableBadge : t.unverifiedBadge,
              disabled: f.state !== "AVAILABLE",
            }))}
            labels={labels}
          />
        </FormField>
        <FormField label={t.periodLabel} required layout="inline">
          <TextInput
            type="month"
            value={taxPeriod}
            onChange={(e) => {
              setTaxPeriod(e.target.value);
              setSelected([]);
            }}
            className="w-48 font-mono"
          />
        </FormField>
      </FieldGroup>
      {family?.template ? (
        <Notice title={`${t.availableBadge} · ${family.template.versionTag}`}>
          <span className="break-words">{family.template.sourceLabel}</span>
        </Notice>
      ) : (
        <Notice tone="warning" role="alert">
          {t.unverifiedBadge}
        </Notice>
      )}
      <Notice title={t.manualGuideTitle}>
        <ol className="list-decimal space-y-1 pl-4">
          {t.manualSteps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </Notice>
    </div>
  );

  const pick = (
    <div className="space-y-4">
      {error && (
        <Notice tone="strong" role="alert">
          {error}
        </Notice>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.eligibleTitle}</h3>
        {eligible.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-foreground"
              checked={chosen.length === eligible.length}
              onChange={(e) =>
                setSelected(e.target.checked ? eligible.map((tx) => tx.id) : [])
              }
            />
            {t.selectAllLabel}
          </label>
        )}
      </div>
      {eligible.length === 0 ? (
        <Notice tone="warning">{t.noEligible}</Notice>
      ) : (
        <ul className="divide-y rounded-lg border">
          {eligible.map((tx) => (
            <li key={tx.id}>
              <label className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                <span className="flex min-w-0 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 accent-foreground"
                    checked={selected.includes(tx.id)}
                    onChange={(e) =>
                      setSelected((all) =>
                        e.target.checked
                          ? [...all, tx.id]
                          : all.filter((id) => id !== tx.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <strong className="font-mono">{tx.invoiceNumber}</strong> ·{" "}
                    {tx.counterpartyName} ·{" "}
                    <span className="font-mono">{tx.snapshot?.objectCode}</span>{" "}
                    ({tx.snapshot?.ratePercent}%)
                  </span>
                </span>
                <span className="font-mono text-xs whitespace-nowrap">
                  {formatAmountString(tx.snapshot?.dppAmount ?? "0.00", locale)}{" "}
                  →{" "}
                  {formatAmountString(tx.snapshot?.taxAmount ?? "0.00", locale)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {chosen.length > 0 && (
        <p className="text-right text-sm">
          {t.totalsLabel}:{" "}
          <span className="font-mono font-semibold">
            {formatAmountString(
              sumAmounts(
                chosen.map((tx) => tx.snapshot?.dppAmount ?? "0.00"),
              ) ?? "0.00",
              locale,
            )}{" "}
            /{" "}
            {formatAmountString(
              sumAmounts(
                chosen.map((tx) => tx.snapshot?.taxAmount ?? "0.00"),
              ) ?? "0.00",
              locale,
            )}
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t.generateNotice}</p>
      <p className="text-xs text-muted-foreground">{intake.neutralNotice}</p>
    </div>
  );

  return (
    <Wizard
      locale={locale}
      open={open}
      onClose={onClose}
      title={t.generateTitle}
      size="lg"
      busy={busy}
      steps={[
        {
          id: "scope",
          title: t.familyStatusTitle,
          content: scope,
          canContinue: Boolean(
            company &&
            family?.state === "AVAILABLE" &&
            /^\d{4}-\d{2}$/.test(taxPeriod),
          ),
        },
        {
          id: "pick",
          title: t.eligibleTitle,
          content: pick,
          canContinue: chosen.length > 0,
        },
      ]}
      finishLabel={t.generateButton}
      onFinish={async () => {
        setBusy(true);
        setError(null);
        try {
          const result = await apiPost<{ batch: { id: string } }>(
            "/api/exports",
            {
              companyId: company,
              taxFamily,
              taxPeriod,
              templateVersionTag: family?.template?.versionTag,
              transactionIds: chosen.map((tx) => tx.id),
              idempotencyKey,
            },
          );
          setIdempotencyKey(crypto.randomUUID());
          setSelected([]);
          toast.success(t.generatedOk);
          await onDone(result.batch.id);
        } catch (failure) {
          setError(exportError(failure, locale));
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

export function ExportBatchForm({
  locale,
  batchId,
}: {
  locale: Locale;
  batchId: string;
}) {
  const t = exportMessages[locale];
  const s = shellMessages[locale];
  const intake = intakeMessages[locale];
  const v = viewMessages[locale];
  const toast = useToast();
  const { data, noWorkspace, reload } = useResource(
    () => apiGet<Payload>("/api/exports"),
    [batchId],
  );
  const batch = data?.batches.find((b) => b.id === batchId) ?? null;
  const canExport = data ? can(data.role, "tax.export") : false;
  const [dialog, setDialog] = useState(false);
  const [outcome, setOutcome] =
    useState<CoretaxOutcomeStatus>("CORETAX_SUBMITTED");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  if (noWorkspace) return <NoWorkspace locale={locale} />;
  const notFound = data !== null && !batch;
  const latest = batch ? latestOutcome(batch) : null;
  const steps = [
    { id: "EXPORTED", label: intake.statuses.EXPORTED },
    { id: "CORETAX_SUBMITTED", label: t.outcomeSubmitted },
    latest === "CORETAX_REJECTED"
      ? { id: "CORETAX_REJECTED", label: t.outcomeRejected }
      : { id: "CORETAX_ACCEPTED", label: t.outcomeAccepted },
  ];

  async function record() {
    setBusy(true);
    try {
      await apiPost(`/api/exports/${batchId}/outcome`, {
        outcome,
        coretaxReference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      setDialog(false);
      setReference("");
      setNotes("");
      await reload();
      toast.success(t.outcomeRecordedOk);
    } catch (failure) {
      toast.error(exportError(failure, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormPage
      locale={locale}
      model="exports"
      mode="read"
      breadcrumbs={[
        { label: s.menuExports, href: `/${locale}/app/exports` },
        { label: batch?.fileName ?? (notFound ? v.notFound : "…") },
      ]}
      recordId={batchId}
      hrefFor={(id) => `/${locale}/app/exports/${id}`}
      loading={data === null}
      statusBar={
        batch ? (
          <StatusBar
            steps={steps}
            current={latest ?? "EXPORTED"}
            label={t.recordOutcomeTitle}
            buttons={
              <>
                <Button asChild>
                  <a href={`/api/exports/${batch.id}/download`}>
                    <Download aria-hidden="true" />
                    <span>{t.downloadXml}</span>
                  </a>
                </Button>
                {canExport && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialog(true)}
                  >
                    <ClipboardCheck aria-hidden="true" />
                    <span>{t.recordOutcomeButton}</span>
                  </Button>
                )}
              </>
            }
          />
        ) : undefined
      }
      chatter={
        batch ? (
          <Chatter
            locale={locale}
            comments={batch.outcomes.map((o) => ({
              id: o.id,
              author: o.recordedBy,
              at: o.recordedAt,
              action: `${outcomeLabel(locale, o.outcome)}${o.coretaxReference ? ` · ${o.coretaxReference}` : ""}`,
              body: o.notes ?? undefined,
            }))}
            log={[
              {
                id: "exported",
                author: batch.exportedBy,
                at: batch.exportedAt,
                action: `${batch.fileName} · v${batch.exportVersion}`,
              },
            ]}
            canComment={false}
            commentLabel={t.outcomeNoteLabel}
          />
        ) : undefined
      }
    >
      {notFound || !batch ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : (
        <div className="space-y-8">
          <SheetTitle
            label={t.historyTitle}
            aside={<OutcomeBadge locale={locale} outcome={latest} />}
          >
            <span className="font-mono">{batch.fileName}</span>
          </SheetTitle>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField label={t.companyLabel} layout="inline">
                <ReadValue>
                  <Link
                    className="hover:underline"
                    href={`/${locale}/app/companies/${batch.companyId}`}
                  >
                    {batch.companyName}
                  </Link>
                </ReadValue>
              </FormField>
              <FormField label={t.familyLabel} layout="inline">
                <ReadValue mono>{batch.taxFamily}</ReadValue>
              </FormField>
              <FormField label={t.periodLabel} layout="inline">
                <ReadValue mono>{batch.taxPeriod}</ReadValue>
              </FormField>
              <FormField label={t.versionLabel} layout="inline">
                <ReadValue>
                  v{batch.exportVersion} · {batch.templateVersionTag}
                </ReadValue>
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.totalsLabel}>
              <FormField label={t.itemsCountLabel} layout="inline">
                <ReadValue>{batch.itemCount}</ReadValue>
              </FormField>
              <FormField label="DPP" layout="inline">
                <ReadValue mono>
                  {formatAmountString(batch.totalDppAmount, locale)}
                </ReadValue>
              </FormField>
              <FormField label={intake.totalAmount} layout="inline">
                <ReadValue mono>
                  {formatAmountString(batch.totalTaxAmount, locale)}
                </ReadValue>
              </FormField>
              <FormField label={t.checksumLabel} layout="inline">
                <ReadValue mono className="text-xs break-all">
                  {batch.xmlSha256}
                </ReadValue>
              </FormField>
            </FieldGroup>
          </div>
          <div className="scroll-thin overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">{s.menuTransactions}</th>
                  <th className="px-3 py-2 text-left">TaxObjectCode</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">DPP</th>
                  <th className="px-3 py-2 text-right">{intake.totalAmount}</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 tabular-nums">
                      {item.sequenceNo}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        className="font-mono text-xs hover:underline"
                        href={`/${locale}/app/transactions/${item.transactionId}`}
                      >
                        {item.transactionId.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {item.taxObjectCode}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.ratePercent}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                      {formatAmountString(item.dppAmount, locale)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                      {formatAmountString(item.taxAmount, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-3.5 shrink-0"
            />
            {t.manualGuideTitle}: {t.manualSteps[1]}
          </p>
        </div>
      )}
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title={t.recordOutcomeTitle}
        size="sm"
        closeLabel={v.cancel}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog(false)}
            >
              {v.cancel}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void record()}>
              {t.recordOutcomeButton}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t.recordOutcomeTitle} required>
            <Combobox
              value={outcome}
              onChange={(value) =>
                value && setOutcome(value as CoretaxOutcomeStatus)
              }
              options={[
                { value: "CORETAX_SUBMITTED", label: t.outcomeSubmitted },
                { value: "CORETAX_ACCEPTED", label: t.outcomeAccepted },
                { value: "CORETAX_REJECTED", label: t.outcomeRejected },
              ]}
              labels={comboLabels(locale)}
            />
          </FormField>
          <FormField label={t.coretaxRefLabel}>
            <TextInput
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={80}
            />
          </FormField>
          <FormField label={t.outcomeNoteLabel}>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </FormField>
        </div>
      </Dialog>
    </FormPage>
  );
}
