"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileUp, RefreshCw } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { importMessages } from "@/i18n/imports";
import { intakeMessages } from "@/i18n/intake";
import { shellMessages } from "@/i18n/shell";
import { viewMessages } from "@/i18n/views";
import { formatDate } from "@/i18n/format";
import { intakeFamilies } from "@/lib/intake/schemas";
import {
  importColumns,
  requiredImportColumns,
  type ImportColumn,
} from "@/lib/intake/spreadsheet";
import { can, type Role } from "@/server/workspaces/policy";
import type { ImportPreviewResult } from "@/server/intake/imports";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Checkbox,
  FieldGroup,
  FormField,
  ReadValue,
} from "@/components/ui/field";
import { Badge, Notice } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { FormPage, SheetTitle } from "@/components/views/form-view";
import { ListPage } from "@/components/views/list-page";
import { NoWorkspace, comboLabels } from "@/components/views/page-state";
import type { Column } from "@/components/views/list-view";
import type { ViewField } from "@/components/views/search";
import { useResource } from "@/components/views/use-resource";
import { PagedFooter, usePaged } from "@/components/views/paged";
import { Wizard } from "@/components/views/wizard";
import {
  ApiFailure,
  apiGet,
  formatAmountString,
  formatFailure,
} from "./client";

type Batch = {
  id: string;
  companyId: string;
  fileName: string;
  fileSha256: string;
  format: "CSV" | "XLSX";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  createdCount: number;
  transactionIds: string[];
  createdAt: string;
  createdBy: string | null;
  rowSummary?: {
    rowNumber: number;
    status: "VALID" | "INVALID";
    invoiceNumber: string;
    counterpartyName: string;
    totalAmount: string | null;
    issues: { column: string; code: string }[];
    duplicates: string[];
  }[];
};
type BatchesPayload = { role: Role; batches: Batch[] };
type Companies = {
  role: Role;
  companies: { id: string; name: string; archivedAt: string | null }[];
};

function importError(error: unknown, locale: Locale) {
  if (error instanceof ApiFailure) {
    const map = importMessages[locale].errors as Record<string, string>;
    if (map[error.code]) return map[error.code];
  }
  return formatFailure(error, locale);
}

export function ImportsList({ locale }: { locale: Locale }) {
  const t = importMessages[locale];
  const s = shellMessages[locale];
  const intake = intakeMessages[locale];
  const v = viewMessages[locale];
  const [wizard, setWizard] = useState(false);
  const batches = useResource(() => apiGet<BatchesPayload>("/api/imports"));
  const companies = useResource(() => apiGet<Companies>("/api/companies"));
  const companyName = useMemo(
    () => new Map((companies.data?.companies ?? []).map((c) => [c.id, c.name])),
    [companies.data],
  );
  const canImport = batches.data
    ? can(batches.data.role, "draft.prepare")
    : false;

  const fields = useMemo<ViewField<Batch>[]>(
    () => [
      {
        name: "fileName",
        label: t.selectFile,
        type: "text",
        value: (b) => b.fileName,
        searchable: true,
        sortable: true,
      },
      {
        name: "company",
        label: intake.company,
        type: "enum",
        value: (b) => b.companyId,
        display: (b) => companyName.get(b.companyId) ?? b.companyId,
        filterable: true,
        groupable: true,
      },
      {
        name: "format",
        label: "Format",
        type: "enum",
        value: (b) => b.format,
        filterable: true,
        groupable: true,
      },
      {
        name: "outcome",
        label: t.summaryTitle,
        type: "enum",
        value: (b) => (b.invalidRows > 0 ? "partial" : "complete"),
        options: [
          { value: "complete", label: `${t.invalidRows}: 0` },
          { value: "partial", label: `${t.invalidRows} > 0` },
        ],
        filterable: true,
      },
      {
        name: "createdAt",
        label: v.from,
        type: "date",
        value: (b) => b.createdAt,
        filterable: true,
        sortable: true,
        display: (b) => b.createdAt.slice(0, 10),
      },
      {
        name: "createdCount",
        label: t.createdCount,
        type: "number",
        value: (b) => b.createdCount,
        sortable: true,
      },
    ],
    [t, intake, v, companyName],
  );

  const columns: Column<Batch>[] = [
    {
      key: "file",
      header: t.selectFile,
      sortField: "fileName",
      primary: true,
      cell: (b) => (
        <span className="inline-flex items-center gap-2">
          <FileSpreadsheet
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="truncate">{b.fileName}</span>
        </span>
      ),
    },
    {
      key: "company",
      header: intake.company,
      cell: (b) => companyName.get(b.companyId) ?? "—",
      hideBelow: "lg",
    },
    {
      key: "format",
      header: "Format",
      cell: (b) => <Badge tone="gray">{b.format}</Badge>,
      hideBelow: "md",
    },
    {
      key: "rows",
      header: t.totalRows,
      align: "right",
      cell: (b) => <span className="tabular-nums">{b.totalRows}</span>,
    },
    {
      key: "invalid",
      header: t.invalidRows,
      align: "right",
      cell: (b) => <span className="tabular-nums">{b.invalidRows}</span>,
      hideBelow: "lg",
    },
    {
      key: "created",
      header: t.createdCount,
      align: "right",
      sortField: "createdCount",
      cell: (b) => (
        <span className="font-semibold tabular-nums">{b.createdCount}</span>
      ),
      aggregate: (rows) => rows.reduce((sum, b) => sum + b.createdCount, 0),
    },
    {
      key: "date",
      header: v.from,
      sortField: "createdAt",
      cell: (b) => (
        <span className="text-xs whitespace-nowrap">
          {formatDate(new Date(b.createdAt), locale)}
        </span>
      ),
    },
  ];

  if (batches.noWorkspace) return <NoWorkspace locale={locale} />;
  return (
    <>
      <ListPage
        locale={locale}
        title={s.menuImports}
        model="imports"
        fields={fields}
        columns={columns}
        records={batches.data?.batches ?? null}
        getId={(b) => b.id}
        href={(b) => `/${locale}/app/imports/${b.id}`}
        rowLabel={(b) => b.fileName}
        onCreate={() => setWizard(true)}
        createLabel={v.new}
        canCreate={canImport}
        emptyIcon={<FileUp />}
        emptyTitle={t.noHistory}
        emptyHint={t.intro}
        globalActions={(close) => (
          <>
            {(["csv", "xlsx"] as const).map((format) => (
              <a
                key={format}
                role="menuitem"
                href={`/api/imports/template?format=${format}&family=UNCLASSIFIED`}
                onClick={close}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted"
              >
                <Download aria-hidden="true" className="size-4" />
                {format === "csv" ? t.downloadCsv : t.downloadXlsx}
              </a>
            ))}
          </>
        )}
      />
      <ImportWizard
        locale={locale}
        open={wizard}
        onClose={() => setWizard(false)}
        companies={companies.data?.companies.filter((c) => !c.archivedAt) ?? []}
        onDone={async (ids) => {
          setWizard(false);
          await batches.reload();
          if (ids.length === 1)
            window.location.assign(`/${locale}/app/transactions/${ids[0]}`);
        }}
      />
    </>
  );
}

function ImportWizard({
  locale,
  open,
  onClose,
  companies,
  onDone,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  companies: { id: string; name: string }[];
  onDone: (transactionIds: string[]) => Promise<void>;
}) {
  const t = importMessages[locale];
  const intake = intakeMessages[locale];
  const toast = useToast();
  const labels = comboLabels(locale);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [family, setFamily] = useState<string>("UNCLASSIFIED");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const previewPage = usePaged(preview?.rows ?? []);
  const [mapping, setMapping] = useState<Partial<Record<ImportColumn, string>>>(
    {},
  );
  const [acknowledge, setAcknowledge] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const company = companyId ?? companies[0]?.id ?? null;

  function reset() {
    setFile(null);
    setPreview(null);
    setMapping({});
    setAcknowledge(false);
    setError(null);
    setIdempotencyKey(crypto.randomUUID());
  }

  async function send(
    action: "preview" | "commit",
    override?: Partial<Record<ImportColumn, string>>,
  ) {
    if (!file || !company) return null;
    setBusy(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
        "X-Import-Action": action,
        "X-Company-Id": company,
        "X-File-Name": encodeURIComponent(file.name),
      };
      const effective = override ?? mapping;
      if (Object.keys(effective).length > 0)
        headers["X-Column-Mapping"] = encodeURIComponent(
          JSON.stringify(effective),
        );
      if (action === "commit") {
        headers["X-Idempotency-Key"] = idempotencyKey;
        headers["X-Acknowledge-Duplicates"] = acknowledge ? "1" : "0";
      }
      const response = await fetch("/api/imports", {
        method: "POST",
        headers,
        body: file,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.preview) {
          setPreview(body.preview as ImportPreviewResult);
          setMapping((body.preview as ImportPreviewResult).mapping);
        }
        throw new ApiFailure(body.code ?? "FAILED");
      }
      if (action === "preview") {
        const next = body as ImportPreviewResult;
        setPreview(next);
        setMapping(next.mapping);
      }
      return body;
    } catch (failure) {
      setError(importError(failure, locale));
      return null;
    } finally {
      setBusy(false);
    }
  }

  function downloadErrors() {
    if (!preview) return;
    const blob = new Blob([preview.errorReportCsv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `serentax-import-errors-${preview.fileSha256.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const upload = (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <FieldGroup>
        <FormField field="import.companyId" label={t.selectCompany} required>
          <Combobox
            value={company}
            onChange={(value) => setCompanyId(value)}
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            labels={labels}
          />
        </FormField>
        <FormField
          field="import.file"
          label={t.selectFile}
          required
          help=".csv / .xlsx · ≤ 2 MB · ≤ 200"
        >
          <input
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              reset();
              setFile(e.target.files?.[0] ?? null);
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </FormField>
      </FieldGroup>
      <div className="space-y-3 rounded-lg border bg-surface-2 p-4">
        <p className="text-sm font-semibold">{t.templatesTitle}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {t.templatesBody}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Combobox
              aria-label={intake.taxFamily}
              value={family}
              onChange={(value) => value && setFamily(value)}
              options={intakeFamilies.map((f) => ({
                value: f,
                label: intake.families[f],
              }))}
              labels={labels}
            />
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/imports/template?format=csv&family=${family}`}>
              <Download aria-hidden="true" />
              {t.downloadCsv}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/imports/template?format=xlsx&family=${family}`}>
              <Download aria-hidden="true" />
              {t.downloadXlsx}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );

  const review = preview && (
    <div className="space-y-6">
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <FieldGroup title={t.mappingTitle} columns={2}>
        {importColumns.map((col) => (
          <FormField
            key={col}
            field="import.mapping"
            label={t.columns[col]}
            required={requiredImportColumns.includes(col)}
            layout="inline"
          >
            <Combobox
              value={mapping[col] ?? null}
              onChange={(value) =>
                setMapping((m) => {
                  const next = { ...m };
                  if (value) next[col] = value;
                  else delete next[col];
                  return next;
                })
              }
              options={preview.headers.map((h) => ({ value: h, label: h }))}
              clearable={!requiredImportColumns.includes(col)}
              labels={{ ...labels, placeholder: t.unmapped }}
            />
          </FormField>
        ))}
      </FieldGroup>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => void send("preview", mapping)}
      >
        <RefreshCw aria-hidden="true" />
        {t.repreviewButton}
      </Button>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t.totalRows, preview.totalRows],
          [t.validRows, preview.validRows],
          [t.invalidRows, preview.invalidRows],
          [t.duplicateRows, preview.duplicateRows],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-lg border bg-surface-2 p-3"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      {preview.entitlement ? (
        <Notice>{t.entitledNotice}</Notice>
      ) : (
        preview.validRows > 1 && (
          <Notice tone="warning" role="alert">
            {t.trialSingleRowNotice}
          </Notice>
        )
      )}
      {preview.quotaBlockReason &&
        t.errors[preview.quotaBlockReason as keyof typeof t.errors] && (
          <Notice tone="danger" role="alert">
            {t.errors[preview.quotaBlockReason as keyof typeof t.errors]}
          </Notice>
        )}
      {(preview.invalidRows > 0 || preview.duplicateRows > 0) && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadErrors}
        >
          <Download aria-hidden="true" />
          {t.downloadErrorReport}
        </Button>
      )}
      <div className="scroll-thin max-h-80 overflow-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-2">
            <tr className="border-b">
              <th className="px-3 py-2 font-semibold">{t.rowNumber}</th>
              <th className="px-3 py-2 font-semibold">{t.rowStatus}</th>
              <th className="px-3 py-2 font-semibold">
                {intake.invoiceNumber}
              </th>
              <th className="px-3 py-2 font-semibold">{intake.counterparty}</th>
              <th className="px-3 py-2 text-right font-semibold">
                {intake.totalAmount}
              </th>
              <th className="px-3 py-2 font-semibold">{t.issuesColumn}</th>
            </tr>
          </thead>
          <tbody>
            {previewPage.rows.map((row) => (
              <tr
                key={row.rowNumber}
                className="border-b last:border-b-0 align-top"
              >
                <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                <td className="px-3 py-2">
                  {row.status === "VALID" ? (
                    <Badge tone="green">{t.valid}</Badge>
                  ) : (
                    <Badge tone="red">{t.invalid}</Badge>
                  )}
                </td>
                <td className="px-3 py-2 font-mono">{row.invoiceNumber}</td>
                <td className="px-3 py-2">{row.counterpartyName}</td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                  {row.totalAmount
                    ? formatAmountString(row.totalAmount, locale)
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {row.issues.length === 0 && row.duplicates.length === 0 ? (
                    <span className="text-muted-foreground">{t.noIssues}</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {row.issues.map((issue, i) => (
                        <li key={i}>
                          {t.columns[issue.column as ImportColumn] ??
                            issue.column}
                          :{" "}
                          {t.issueCodes[
                            issue.code as keyof typeof t.issueCodes
                          ] ?? issue.code}
                        </li>
                      ))}
                      {row.duplicates.map((d) => (
                        <li key={d.id}>
                          ⚠ {d.invoiceNumber} ({d.documentDate})
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <PagedFooter paged={previewPage} v={viewMessages[locale]} />
      </div>
      {preview.duplicateRows > 0 && (
        <Checkbox
          label={t.acknowledgeDuplicates}
          checked={acknowledge}
          onChange={(e) => setAcknowledge(e.target.checked)}
        />
      )}
    </div>
  );

  return (
    <Wizard
      locale={locale}
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t.title}
      size="xl"
      busy={busy}
      steps={[
        {
          id: "upload",
          title: t.uploadTitle,
          content: upload,
          canContinue: Boolean(file && company),
          onContinue: async () => Boolean(await send("preview")),
        },
        {
          id: "review",
          title: t.summaryTitle,
          content: review,
          canContinue: Boolean(
            preview?.eligibleToCommit &&
            (preview.duplicateRows === 0 || acknowledge),
          ),
        },
      ]}
      finishLabel={
        preview?.entitlement ? t.commitButtonEntitled : t.commitButton
      }
      onFinish={async () => {
        const result = (await send("commit")) as {
          transactionIds: string[];
        } | null;
        if (!result) return;
        toast.success(t.committedSuccess);
        reset();
        await onDone(result.transactionIds);
      }}
    />
  );
}

export function ImportBatchForm({
  locale,
  batchId,
}: {
  locale: Locale;
  batchId: string;
}) {
  const t = importMessages[locale];
  const s = shellMessages[locale];
  const intake = intakeMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const batch = useResource(
    () =>
      apiGet<BatchesPayload>(`/api/imports?id=${encodeURIComponent(batchId)}`),
    [batchId],
  );
  const companies = useResource(() => apiGet<Companies>("/api/companies"));
  const record = batch.data?.batches[0] ?? null;
  const rowsPage = usePaged(record?.rowSummary ?? []);
  const company = companies.data?.companies.find(
    (c) => c.id === record?.companyId,
  );
  if (batch.noWorkspace) return <NoWorkspace locale={locale} />;
  const notFound = batch.data !== null && !record;
  return (
    <FormPage
      locale={locale}
      model="imports"
      mode="read"
      breadcrumbs={[
        { label: s.menuImports, href: `/${locale}/app/imports` },
        { label: record?.fileName ?? (notFound ? v.notFound : "…") },
      ]}
      recordId={batchId}
      hrefFor={(id) => `/${locale}/app/imports/${id}`}
      loading={batch.data === null}
    >
      {notFound || !record ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : (
        <div className="space-y-8">
          <SheetTitle
            label={t.historyTitle}
            aside={<Badge tone="gray">{record.format}</Badge>}
          >
            {record.fileName}
          </SheetTitle>
          <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
            <FieldGroup title={v.information}>
              <FormField
                field="import.companyId"
                label={intake.company}
                layout="inline"
              >
                <ReadValue>
                  {company ? (
                    <Link
                      className="hover:underline"
                      href={`/${locale}/app/companies/${company.id}`}
                    >
                      {company.name}
                    </Link>
                  ) : null}
                </ReadValue>
              </FormField>
              <FormField
                field="import.createdAt"
                label={v.from}
                layout="inline"
              >
                <ReadValue>
                  {formatDate(new Date(record.createdAt), locale)}
                </ReadValue>
              </FormField>
              <FormField
                field="import.createdBy"
                label={intake.history}
                layout="inline"
              >
                <ReadValue>{record.createdBy}</ReadValue>
              </FormField>
              <FormField
                field="import.fileSha256"
                label={t.fileHash}
                layout="inline"
              >
                <ReadValue mono className="text-xs break-all">
                  {record.fileSha256}
                </ReadValue>
              </FormField>
            </FieldGroup>
            <FieldGroup title={t.summaryTitle}>
              <FormField
                field="import.totalRows"
                label={t.totalRows}
                layout="inline"
              >
                <ReadValue>{record.totalRows}</ReadValue>
              </FormField>
              <FormField
                field="import.validRows"
                label={t.validRows}
                layout="inline"
              >
                <ReadValue>{record.validRows}</ReadValue>
              </FormField>
              <FormField
                field="import.invalidRows"
                label={t.invalidRows}
                layout="inline"
              >
                <ReadValue>{record.invalidRows}</ReadValue>
              </FormField>
              <FormField
                field="import.createdCount"
                label={t.createdCount}
                layout="inline"
              >
                <ReadValue>{record.createdCount}</ReadValue>
              </FormField>
            </FieldGroup>
          </div>
          {record.rowSummary && (
            <div className="scroll-thin overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2">{t.rowNumber}</th>
                    <th className="px-3 py-2">{t.rowStatus}</th>
                    <th className="px-3 py-2">{intake.invoiceNumber}</th>
                    <th className="px-3 py-2">{intake.counterparty}</th>
                    <th className="px-3 py-2 text-right">
                      {intake.totalAmount}
                    </th>
                    <th className="px-3 py-2">{t.issuesColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsPage.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className="border-b align-top last:border-b-0"
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.rowNumber}
                      </td>
                      <td className="px-3 py-2">
                        {row.status === "VALID" ? (
                          <Badge tone="green">{t.valid}</Badge>
                        ) : (
                          <Badge tone="red">{t.invalid}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {row.invoiceNumber}
                      </td>
                      <td className="px-3 py-2">{row.counterpartyName}</td>
                      <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                        {row.totalAmount
                          ? formatAmountString(row.totalAmount, locale)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.issues
                          .map(
                            (i) =>
                              `${t.columns[i.column as ImportColumn] ?? i.column}: ${t.issueCodes[i.code as keyof typeof t.issueCodes] ?? i.code}`,
                          )
                          .join(" · ") || t.noIssues}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <PagedFooter paged={rowsPage} v={v} />
            </div>
          )}
          {record.transactionIds.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/${locale}/app/transactions`)}
            >
              {s.menuTransactions} ({record.transactionIds.length})
            </Button>
          )}
        </div>
      )}
    </FormPage>
  );
}
