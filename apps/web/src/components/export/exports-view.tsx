"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { exportMessages } from "@/i18n/exports";
import { intakeMessages } from "@/i18n/intake";
import { siteMessages } from "@/i18n/site";
import { formatDate } from "@/i18n/format";
import type { CoretaxOutcomeStatus } from "@/lib/export/bppu-spec";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
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
    sourcePublishedAt: string | null;
    sourceSha256: string;
    xsdSchemaHash: string;
    verifiedAt: string | null;
  } | null;
};

type EligibleTx = {
  id: string;
  companyId: string;
  companyName: string;
  counterpartyName: string;
  counterpartyIdentityType: string;
  taxFamily: string;
  taxPeriod: string;
  documentDate: string;
  invoiceNumber: string;
  currency: string;
  status: string;
  version: number;
  snapshot: {
    id: string;
    transactionVersion: number;
    ruleCode: string;
    ruleVersion: number;
    objectCode: string;
    dppAmount: string;
    taxAmount: string;
    ratePercent: string;
    approvedAt: string;
  } | null;
};

type ExportBatchRow = {
  id: string;
  companyId: string;
  companyName: string;
  taxFamily: string;
  taxPeriod: string;
  templateVersionTag: string;
  sourceSha256: string;
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
    snapshotId: string;
    sequenceNo: number;
    taxObjectCode: string;
    dppAmount: string;
    taxAmount: string;
    ratePercent: string;
  }[];
  outcomes: {
    id: string;
    outcome: CoretaxOutcomeStatus;
    coretaxReference: string | null;
    notes: string | null;
    recordedBy: string;
    recordedAt: string;
  }[];
};

type WorkspaceExportsPayload = {
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

export function ExportsView({ locale }: { locale: Locale }) {
  const t = exportMessages[locale];
  const intake = intakeMessages[locale];
  const site = siteMessages[locale];

  const [data, setData] = useState<WorkspaceExportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [taxFamily, setTaxFamily] = useState("PPH_UNIFIKASI_BPPU");
  const [taxPeriod, setTaxPeriod] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [outcomeChoice, setOutcomeChoice] = useState<
    Record<string, CoretaxOutcomeStatus>
  >({});
  const [outcomeRef, setOutcomeRef] = useState<Record<string, string>>({});
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  function formatExportError(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    setLoading(true);
    try {
      const payload = await apiGet<WorkspaceExportsPayload>("/api/exports");
      setData(payload);
      setNoWorkspace(false);
      if (payload.companies.length > 0 && !companyId) {
        setCompanyId(payload.companies[0].id);
      }
      if (payload.eligibleTransactions.length > 0) {
        setTaxPeriod(
          (prev) => prev || payload.eligibleTransactions[0].taxPeriod,
        );
      }
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE") {
        setNoWorkspace(true);
      } else {
        setFeedback(formatExportError(error));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (noWorkspace) {
    return (
      <div className="max-w-xl space-y-4 rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">{t.pageTitle}</h1>
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
        {feedback || site.appError}
      </p>
    );
  }

  const canExport = can(data.role, "tax.export");
  const familyEntry = data.familyMatrix.find((f) => f.taxFamily === taxFamily);
  const filteredEligible = data.eligibleTransactions.filter(
    (tx) =>
      tx.companyId === companyId &&
      tx.taxFamily === taxFamily &&
      tx.taxPeriod === taxPeriod &&
      tx.snapshot !== null,
  );

  async function onGenerate(event: FormEvent) {
    event.preventDefault();
    if (!canExport || selectedIds.length === 0) return;
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/exports", {
        companyId,
        taxFamily,
        taxPeriod,
        templateVersionTag: familyEntry?.template?.versionTag,
        transactionIds: selectedIds,
        idempotencyKey,
      });
      setSelectedIds([]);
      setIdempotencyKey(crypto.randomUUID());
      await load();
      setFeedback(t.generatedOk);
    } catch (error) {
      setFeedback(formatExportError(error));
    } finally {
      setBusy(false);
    }
  }

  async function onRecordOutcome(batchId: string, event: FormEvent) {
    event.preventDefault();
    if (!canExport) return;
    setBusy(true);
    setFeedback("");
    try {
      await apiPost(`/api/exports/${batchId}/outcome`, {
        outcome: outcomeChoice[batchId] ?? "CORETAX_ACCEPTED",
        coretaxReference: outcomeRef[batchId]?.trim() || null,
        notes: outcomeNotes[batchId]?.trim() || null,
      });
      setOutcomeRef((prev) => ({ ...prev, [batchId]: "" }));
      setOutcomeNotes((prev) => ({ ...prev, [batchId]: "" }));
      await load();
      setFeedback(t.outcomeRecordedOk);
    } catch (error) {
      setFeedback(formatExportError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.pageTitle}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.pageIntro}
        </p>
      </div>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-4 text-sm"
        >
          {feedback}
        </p>
      )}

      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t.familyStatusTitle}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-3 font-medium">{site.family}</th>
                <th className="p-3 font-medium">{site.status}</th>
                <th className="p-3 font-medium">{t.sourceCitationLabel}</th>
                <th className="p-3 font-medium">{t.sourceShaLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.familyMatrix.map((entry) => (
                <tr key={entry.taxFamily} className="border-b">
                  <td className="p-3 font-mono">{entry.taxFamily}</td>
                  <td className="p-3">
                    <StatusBadge>
                      {entry.state === "AVAILABLE"
                        ? t.availableBadge
                        : t.unverifiedBadge}
                    </StatusBadge>
                  </td>
                  <td className="p-3">
                    {entry.template ? (
                      <div className="space-y-1">
                        <div className="font-medium">
                          {entry.template.versionTag} ·{" "}
                          {entry.template.sourceLabel}
                        </div>
                        <div className="break-all text-muted-foreground">
                          {entry.template.sourceUrl}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        TEMPLATE_UNVERIFIED
                      </span>
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {entry.template
                      ? entry.template.sourceSha256.slice(0, 16) + "..."
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t.generateTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.generateNotice}</p>
        </div>

        {!canExport && (
          <p role="alert" className="rounded-md border p-3 text-xs">
            {t.noPermission}
          </p>
        )}

        <form onSubmit={onGenerate} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1 text-sm font-medium">
              {t.companyLabel}
              <select
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  setSelectedIds([]);
                }}
                className="min-h-11 rounded-md border bg-background px-3 text-sm"
              >
                {data.companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm font-medium">
              {t.familyLabel}
              <select
                value={taxFamily}
                onChange={(e) => {
                  setTaxFamily(e.target.value);
                  setSelectedIds([]);
                }}
                className="min-h-11 rounded-md border bg-background px-3 text-sm"
              >
                {data.familyMatrix.map((entry) => (
                  <option key={entry.taxFamily} value={entry.taxFamily}>
                    {entry.taxFamily} ({entry.state})
                  </option>
                ))}
              </select>
            </label>

            <Field
              label={t.periodLabel}
              value={taxPeriod}
              onChange={(e) => {
                setTaxPeriod(e.target.value);
                setSelectedIds([]);
              }}
              pattern="\d{4}-(0[1-9]|1[0-2])"
              required
            />
          </div>

          {familyEntry?.state !== "AVAILABLE" ? (
            <p role="alert" className="rounded-md border p-4 text-xs">
              {t.errors.TEMPLATE_UNVERIFIED}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{t.eligibleTitle}</h3>
                {filteredEligible.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === filteredEligible.length
                          ? []
                          : filteredEligible.map((item) => item.id),
                      )
                    }
                  >
                    {t.selectAllLabel}
                  </Button>
                )}
              </div>

              {filteredEligible.length === 0 ? (
                <p className="rounded-md border p-4 text-xs text-muted-foreground">
                  {t.noEligible}
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredEligible.map((tx) => {
                    const checked = selectedIds.includes(tx.id);
                    return (
                      <label
                        key={tx.id}
                        className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-xs"
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedIds((prev) =>
                                e.target.checked
                                  ? [...prev, tx.id]
                                  : prev.filter((id) => id !== tx.id),
                              )
                            }
                          />
                          <span>
                            <strong className="font-mono">
                              {tx.invoiceNumber}
                            </strong>{" "}
                            · {tx.counterpartyName} ·{" "}
                            <span className="font-mono">
                              {tx.snapshot?.objectCode}
                            </span>{" "}
                            ({tx.snapshot?.ratePercent}%)
                          </span>
                        </span>
                        <span className="flex items-center gap-3 font-mono">
                          <span>
                            {formatAmountString(
                              tx.snapshot?.dppAmount ?? "0.00",
                              locale,
                            )}
                          </span>
                          <StatusBadge>
                            {
                              intake.statuses[
                                tx.status as keyof typeof intake.statuses
                              ]
                            }
                          </StatusBadge>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}

              <Button
                type="submit"
                disabled={busy || !canExport || selectedIds.length === 0}
              >
                {t.generateButton}
              </Button>
            </div>
          )}
        </form>
      </section>

      <section className="space-y-3 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t.manualGuideTitle}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          {t.manualSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t.historyTitle}</h2>
        {data.batches.length === 0 ? (
          <p className="rounded-lg border p-6 text-sm text-muted-foreground">
            {t.noBatches}
          </p>
        ) : (
          <div className="space-y-4">
            {data.batches.map((batch) => (
              <article
                key={batch.id}
                className="space-y-4 rounded-lg border p-5 text-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">
                        {batch.fileName}
                      </span>
                      <StatusBadge>
                        {t.versionLabel}: v{batch.exportVersion}
                      </StatusBadge>
                      <StatusBadge>{batch.templateVersionTag}</StatusBadge>
                    </div>
                    <p className="text-muted-foreground">
                      {batch.companyName} · {batch.taxFamily} ·{" "}
                      {batch.taxPeriod} ·{" "}
                      {formatDate(new Date(batch.exportedAt), locale)} ·{" "}
                      {batch.exportedBy}
                    </p>
                  </div>
                  {canExport && (
                    <a
                      href={`/api/exports/${batch.id}/download`}
                      download={batch.fileName}
                      className="inline-flex min-h-10 items-center rounded-md border px-4 py-2 font-medium hover:bg-muted"
                    >
                      {t.downloadXml}
                    </a>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <strong>{t.itemsCountLabel}:</strong> {batch.itemCount}
                  </div>
                  <div>
                    <strong>{t.totalsLabel}:</strong>{" "}
                    <span className="font-mono">
                      {formatAmountString(batch.totalDppAmount, locale)} /{" "}
                      {formatAmountString(batch.totalTaxAmount, locale)}
                    </span>
                  </div>
                  <div className="break-all">
                    <strong>{t.checksumLabel}:</strong>{" "}
                    <span className="font-mono">{batch.xmlSha256}</span>
                  </div>
                </div>

                {batch.outcomes.length > 0 && (
                  <ul className="space-y-1 rounded border bg-muted/20 p-3">
                    {batch.outcomes.map((o) => (
                      <li key={o.id}>
                        <span className="font-semibold">{o.outcome}</span>
                        {o.coretaxReference
                          ? ` (${o.coretaxReference})`
                          : ""} · {o.recordedBy} ·{" "}
                        {formatDate(new Date(o.recordedAt), locale)}
                        {o.notes ? ` — ${o.notes}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {canExport && (
                  <form
                    onSubmit={(e) => onRecordOutcome(batch.id, e)}
                    className="grid gap-3 rounded border p-3 md:grid-cols-4"
                  >
                    <label className="grid gap-1 font-medium">
                      {t.recordOutcomeTitle}
                      <select
                        value={outcomeChoice[batch.id] ?? "CORETAX_ACCEPTED"}
                        onChange={(e) =>
                          setOutcomeChoice((prev) => ({
                            ...prev,
                            [batch.id]: e.target.value as CoretaxOutcomeStatus,
                          }))
                        }
                        className="min-h-10 rounded-md border bg-background px-2"
                      >
                        <option value="CORETAX_SUBMITTED">
                          {t.outcomeSubmitted}
                        </option>
                        <option value="CORETAX_ACCEPTED">
                          {t.outcomeAccepted}
                        </option>
                        <option value="CORETAX_REJECTED">
                          {t.outcomeRejected}
                        </option>
                      </select>
                    </label>
                    <label className="grid gap-1 font-medium">
                      {t.coretaxRefLabel}
                      <input
                        value={outcomeRef[batch.id] ?? ""}
                        onChange={(e) =>
                          setOutcomeRef((prev) => ({
                            ...prev,
                            [batch.id]: e.target.value,
                          }))
                        }
                        className="min-h-10 rounded-md border bg-background px-2"
                      />
                    </label>
                    <label className="grid gap-1 font-medium">
                      {t.outcomeNoteLabel}
                      <input
                        value={outcomeNotes[batch.id] ?? ""}
                        onChange={(e) =>
                          setOutcomeNotes((prev) => ({
                            ...prev,
                            [batch.id]: e.target.value,
                          }))
                        }
                        className="min-h-10 rounded-md border bg-background px-2"
                      />
                    </label>
                    <div className="flex items-end">
                      <Submit busy={busy}>{t.recordOutcomeButton}</Submit>
                    </div>
                  </form>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
