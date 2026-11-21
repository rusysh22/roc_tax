"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { importMessages } from "@/i18n/imports";
import { intakeMessages } from "@/i18n/intake";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { formatDate } from "@/i18n/format";
import { intakeFamilies } from "@/lib/intake/schemas";
import { importColumns, type ImportColumn } from "@/lib/intake/spreadsheet";
import { can, type Role } from "@/server/workspaces/policy";
import type { ImportPreviewResult } from "@/server/intake/imports";
import { TrialStrip } from "@/components/account/trial-strip";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  formatAmountString,
  formatFailure,
} from "./client";

type BatchHistoryItem = {
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
};

export function ImportsView({ locale }: { locale: Locale }) {
  const t = importMessages[locale];
  const intake = intakeMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];

  const [role, setRole] = useState<Role | null>(null);
  const [companies, setCompanies] = useState<
    { id: string; name: string; archivedAt: string | null }[]
  >([]);
  const [counterpartyCount, setCounterpartyCount] = useState(0);
  const [batches, setBatches] = useState<BatchHistoryItem[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [templateFamily, setTemplateFamily] =
    useState<(typeof intakeFamilies)[number]>("UNCLASSIFIED");
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportColumn, string>>>(
    {},
  );
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [acknowledge, setAcknowledge] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function loadInitial() {
    try {
      const [comp, cp, hist] = await Promise.all([
        apiGet<{
          role: Role;
          companies: { id: string; name: string; archivedAt: string | null }[];
        }>("/api/companies"),
        apiGet<{ total: number }>("/api/counterparties"),
        apiGet<{ batches: BatchHistoryItem[] }>("/api/imports"),
      ]);
      const activeCompanies = comp.companies.filter((c) => !c.archivedAt);
      setRole(comp.role);
      setCompanies(activeCompanies);
      setCounterpartyCount(cp.total);
      setBatches(hist.batches);
      setCompanyId((prev) => prev || activeCompanies[0]?.id || "");
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
        setNoWorkspace(true);
      else setFeedback(formatImportFailure(error));
    }
  }

  useEffect(() => {
    void loadInitial();
  }, []);

  function formatImportFailure(error: unknown): string {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function sendFile(
    action: "preview" | "commit",
    mappingOverride?: Partial<Record<ImportColumn, string>>,
  ) {
    if (!file || !companyId) return;
    setBusy(true);
    setFeedback("");
    try {
      const headers: Record<string, string> = {
        "Content-Type": file.type || "application/octet-stream",
        "X-Import-Action": action,
        "X-Company-Id": companyId,
        "X-File-Name": encodeURIComponent(file.name),
      };
      const effectiveMapping = mappingOverride ?? mapping;
      if (Object.keys(effectiveMapping).length > 0) {
        headers["X-Column-Mapping"] = encodeURIComponent(
          JSON.stringify(effectiveMapping),
        );
      }
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
        const nextPreview = body as ImportPreviewResult;
        setPreview(nextPreview);
        setMapping(nextPreview.mapping);
      } else {
        const committed = body as { transactionIds: string[] };
        await loadInitial();
        setFeedback(t.committedSuccess);
        if (committed.transactionIds.length === 1) {
          window.location.assign(
            `/${locale}/app/transactions/${committed.transactionIds[0]}`,
          );
          return;
        }
      }
    } catch (error) {
      setFeedback(formatImportFailure(error));
    } finally {
      setBusy(false);
    }
  }

  function downloadErrorCsv() {
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

  if (noWorkspace) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p>{acc.noWorkspace}</p>
        <Link className="underline" href={`/${locale}/app/settings`}>
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }
  if (!role) return <Skeleton className="h-48 w-full" />;
  const canPrepare = can(role, "draft.prepare");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.intro}
        </p>
      </header>
      <TrialStrip locale={locale} />
      <section className="space-y-4 rounded-lg border p-5">
        <h2 className="text-lg font-semibold">{t.templatesTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.templatesBody}</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block space-y-2 text-sm font-medium">
            <span>{intake.taxFamily}</span>
            <select
              value={templateFamily}
              onChange={(e) =>
                setTemplateFamily(
                  e.target.value as (typeof intakeFamilies)[number],
                )
              }
              className="min-h-11 rounded-md border bg-background px-3"
            >
              {intakeFamilies.map((f) => (
                <option key={f} value={f}>
                  {intake.families[f]}
                </option>
              ))}
            </select>
          </label>
          <Button asChild variant="outline">
            <a
              href={`/api/imports/template?format=csv&family=${templateFamily}`}
            >
              {t.downloadCsv}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={`/api/imports/template?format=xlsx&family=${templateFamily}`}
            >
              {t.downloadXlsx}
            </a>
          </Button>
        </div>
      </section>

      {feedback && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {feedback}
        </p>
      )}

      {!canPrepare ? (
        <p role="alert" className="rounded-md border p-5 text-sm">
          {intake.preparerRequired}
        </p>
      ) : !companies.length || counterpartyCount === 0 ? (
        <div className="space-y-4 rounded-md border p-5 text-sm">
          <p>{intake.setupRequired}</p>
          <div className="flex flex-wrap gap-4">
            <Link className="underline" href={`/${locale}/app/companies`}>
              {site.companies}
            </Link>
            <Link className="underline" href={`/${locale}/app/counterparties`}>
              {site.counterparties}
            </Link>
          </div>
        </div>
      ) : (
        <section className="space-y-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">{t.uploadTitle}</h2>
          <form
            className="space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              void sendFile("preview", {});
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium">
                <span>{t.selectCompany}</span>
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    setIdempotencyKey(crypto.randomUUID());
                  }}
                  className="min-h-11 w-full rounded-md border bg-background px-3"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>{t.selectFile}</span>
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                    setMapping({});
                    setAcknowledge(false);
                    setIdempotencyKey(crypto.randomUUID());
                  }}
                  className="block w-full text-sm"
                />
              </label>
            </div>
            <Submit busy={busy}>{t.previewButton}</Submit>
          </form>

          {preview && (
            <div className="space-y-6 border-t pt-6">
              <div className="space-y-4">
                <h3 className="font-semibold">{t.mappingTitle}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {importColumns.map((col) => (
                    <label
                      key={col}
                      className="block space-y-1 text-xs font-medium"
                    >
                      <span>{t.columns[col]}</span>
                      <select
                        value={mapping[col] ?? ""}
                        onChange={(e) => {
                          const next = { ...mapping };
                          if (e.target.value) next[col] = e.target.value;
                          else delete next[col];
                          setMapping(next);
                          setIdempotencyKey(crypto.randomUUID());
                        }}
                        className="min-h-10 w-full rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="">{t.unmapped}</option>
                        {preview.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void sendFile("preview", mapping)}
                >
                  {t.repreviewButton}
                </Button>
              </div>

              <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
                <h3 className="font-semibold">{t.summaryTitle}</h3>
                <div className="flex flex-wrap gap-6 font-mono text-xs">
                  <span>
                    {t.totalRows}: {preview.totalRows}
                  </span>
                  <span>
                    {t.validRows}: {preview.validRows}
                  </span>
                  <span>
                    {t.invalidRows}: {preview.invalidRows}
                  </span>
                  <span>
                    {t.duplicateRows}: {preview.duplicateRows}
                  </span>
                </div>
                {preview.entitlement ? (
                  <p className="rounded border bg-background p-3 text-xs leading-6">
                    {t.entitledNotice}
                  </p>
                ) : (
                  preview.validRows > 1 && (
                    <p
                      role="alert"
                      className="rounded border bg-background p-3 text-xs leading-6"
                    >
                      {t.trialSingleRowNotice}
                    </p>
                  )
                )}
                {(preview.invalidRows > 0 || preview.duplicateRows > 0) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadErrorCsv}
                  >
                    {t.downloadErrorReport}
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-xs">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="p-3 font-semibold">{t.rowNumber}</th>
                      <th className="p-3 font-semibold">{t.rowStatus}</th>
                      <th className="p-3 font-semibold">
                        {intake.invoiceNumber}
                      </th>
                      <th className="p-3 font-semibold">
                        {intake.counterparty}
                      </th>
                      <th className="p-3 font-semibold">
                        {intake.totalAmount}
                      </th>
                      <th className="p-3 font-semibold">{t.issuesColumn}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="p-3 font-mono">{row.rowNumber}</td>
                        <td className="p-3">
                          <StatusBadge active={row.status === "VALID"}>
                            {row.status === "VALID" ? t.valid : t.invalid}
                          </StatusBadge>
                        </td>
                        <td className="p-3 font-mono">
                          {row.invoiceNumber || "—"}
                        </td>
                        <td className="p-3">{row.counterpartyName || "—"}</td>
                        <td className="p-3 font-mono">
                          {row.totalAmount
                            ? formatAmountString(row.totalAmount, locale)
                            : "—"}
                        </td>
                        <td className="p-3">
                          {row.issues.length === 0 &&
                          row.duplicates.length === 0 ? (
                            <span className="text-muted-foreground">
                              {t.noIssues}
                            </span>
                          ) : (
                            <ul className="space-y-1">
                              {row.issues.map((issue, idx) => (
                                <li key={idx}>
                                  <span className="font-mono">
                                    {issue.column}:
                                  </span>{" "}
                                  {t.issueCodes[issue.code]}
                                </li>
                              ))}
                              {row.duplicates.map((dup) => (
                                <li key={dup.id}>
                                  {intake.duplicateBadge}: {dup.invoiceNumber} (
                                  {dup.documentDate})
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.duplicateRows > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={acknowledge}
                    onChange={(e) => setAcknowledge(e.target.checked)}
                  />
                  <span>{t.acknowledgeDuplicates}</span>
                </label>
              )}

              <Button
                type="button"
                disabled={
                  busy ||
                  !preview.eligibleToCommit ||
                  (preview.duplicateRows > 0 && !acknowledge)
                }
                onClick={() => void sendFile("commit", mapping)}
              >
                {preview.entitlement ? t.commitButtonEntitled : t.commitButton}
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t.historyTitle}</h2>
        {!batches.length ? (
          <p className="rounded-md border p-5 text-sm text-muted-foreground">
            {t.noHistory}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="p-3 font-semibold">{intake.documentDate}</th>
                  <th className="p-3 font-semibold">File</th>
                  <th className="p-3 font-semibold">{t.totalRows}</th>
                  <th className="p-3 font-semibold">{t.validRows}</th>
                  <th className="p-3 font-semibold">{t.invalidRows}</th>
                  <th className="p-3 font-semibold">{t.createdCount}</th>
                  <th className="p-3 font-semibold">{t.fileHash}</th>
                  <th className="p-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="p-3 font-mono">
                      {formatDate(new Date(b.createdAt), locale)}
                    </td>
                    <td className="p-3 font-medium">
                      {b.fileName} ({b.format})
                    </td>
                    <td className="p-3 font-mono">{b.totalRows}</td>
                    <td className="p-3 font-mono">{b.validRows}</td>
                    <td className="p-3 font-mono">{b.invalidRows}</td>
                    <td className="p-3 font-mono">{b.createdCount}</td>
                    <td className="p-3 font-mono">
                      {b.fileSha256.slice(0, 12)}…
                    </td>
                    <td className="p-3">
                      {b.transactionIds[0] && (
                        <Link
                          className="underline"
                          href={`/${locale}/app/transactions/${b.transactionIds[0]}`}
                        >
                          {intake.openDetail}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
