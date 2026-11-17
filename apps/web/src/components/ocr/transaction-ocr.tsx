"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { ocrMessages } from "@/i18n/ocr";
import type {
  OcrCandidateField,
  OcrExtractedFields,
  OcrJobStatus,
} from "@/lib/intake/ocr";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type OcrJobItem = {
  id: string;
  documentId: string;
  providerSlug: string;
  model: string;
  region: string;
  status: OcrJobStatus;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
};

type OcrCandidateItem = {
  id: string;
  jobId: string;
  documentId: string;
  providerSlug: string;
  model: string;
  providerVersion: string;
  extractedFields: OcrExtractedFields;
  appliedFields: unknown;
  promptInjectionDetected: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

type OcrPayload = {
  effectiveStatus:
    | "NONE_MANUAL"
    | "READY"
    | "NOT_CONFIGURED"
    | "CONSENT_REQUIRED"
    | "VENDOR_NOT_APPROVED";
  provider: {
    slug: string;
    displayName: string;
    model: string;
    region: string;
  } | null;
  jobs: OcrJobItem[];
  candidates: OcrCandidateItem[];
};

export function TransactionOcrPanel({
  locale,
  transactionId,
  transactionStatus,
  canPrepare,
  documents,
  onApplied,
}: {
  locale: Locale;
  transactionId: string;
  transactionStatus: string;
  canPrepare: boolean;
  documents: { id: string; originalName: string }[];
  onApplied: () => Promise<void>;
}) {
  const t = ocrMessages[locale];
  const [data, setData] = useState<OcrPayload | null>(null);
  const [selectedDocId, setSelectedDocId] = useState(documents[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [inv, setInv] = useState("");
  const [docDate, setDocDate] = useState("");
  const [period, setPeriod] = useState("");
  const [lineDesc, setLineDesc] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [verifiedId, setVerifiedId] = useState("");
  const [verifyChecked, setVerifyChecked] = useState(false);

  function formatOcrError(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    try {
      const next = await apiGet<OcrPayload>(
        `/api/transactions/${transactionId}/ocr`,
      );
      setData(next);
      const latest = next.candidates[0];
      if (latest) {
        const f = latest.extractedFields;
        setInv(f.invoiceNumber.normalized ?? "");
        setDocDate(f.documentDate.normalized ?? "");
        setPeriod(f.taxPeriod.normalized ?? "");
        setLineDesc(f.lines[0]?.description.normalized ?? "");
        setQty(f.lines[0]?.quantity.normalized ?? "");
        setPrice(f.lines[0]?.unitPrice.normalized ?? "");
        setVerifiedId(f.counterpartyIdentity.normalized ?? "");
        setVerifyChecked(false);
      }
    } catch (error) {
      setFeedback(formatOcrError(error));
    }
  }

  useEffect(() => {
    void load();
  }, [transactionId]);

  useEffect(() => {
    if (!selectedDocId && documents[0]?.id) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  useEffect(() => {
    const active = data?.jobs.some(
      (j) =>
        j.status === "QUEUED" ||
        j.status === "RUNNING" ||
        j.status === "FAILED_RETRYABLE",
    );
    if (!active) return;
    const timer = setInterval(() => {
      void load().then(() => onApplied());
    }, 1500);
    return () => clearInterval(timer);
  }, [data?.jobs]);

  async function runCommand(body: unknown, reloadParent = true) {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost(`/api/transactions/${transactionId}/ocr`, body);
      await load();
      if (reloadParent) await onApplied();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatOcrError(error));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const latestCandidate = data.candidates[0] ?? null;
  const requiresSensitiveVerify = latestCandidate
    ? latestCandidate.promptInjectionDetected ||
      latestCandidate.extractedFields.counterpartyIdentity
        .requiresVerification ||
      latestCandidate.extractedFields.currency.requiresVerification ||
      latestCandidate.extractedFields.totalAmount.requiresVerification ||
      latestCandidate.extractedFields.lines.some(
        (l) => l.unitPrice.requiresVerification,
      )
    : false;

  const formatConfidence = (field: OcrCandidateField) =>
    field.confidence === "unknown"
      ? t.unknownConfidence
      : `${Math.round(field.confidence * 100)}%`;

  async function applyCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!latestCandidate) return;
    await runCommand({
      action: "apply",
      candidateId: latestCandidate.id,
      verifiedLowConfidence: verifyChecked,
      values: {
        invoiceNumber: inv || undefined,
        documentDate: docDate || undefined,
        taxPeriod: period || undefined,
        lineDescription: lineDesc || undefined,
        quantity: qty || undefined,
        unitPrice: price || undefined,
        verifiedCounterpartyIdentity: verifiedId || undefined,
      },
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t.transactionOcrTitle}</h2>
        <StatusBadge active={data.effectiveStatus === "READY"}>
          {t.effectiveStatuses[data.effectiveStatus]}
        </StatusBadge>
      </div>
      <p className="rounded-md border bg-muted/30 p-3 text-xs leading-6">
        {t.transactionOcrNotice}{" "}
        <Link className="underline" href={`/${locale}/app/settings/ocr`}>
          {t.settingsLink}
        </Link>
      </p>

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border p-3 text-xs"
        >
          {feedback}
        </p>
      )}

      {canPrepare && (
        <div className="space-y-3">
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t.noDocumentsForOcr}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <label className="block space-y-1 text-xs font-medium">
                <span>Document</span>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="min-h-10 rounded-md border bg-background px-2 text-xs"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.originalName}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy ||
                  data.effectiveStatus !== "READY" ||
                  !selectedDocId ||
                  !["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"].includes(
                    transactionStatus,
                  )
                }
                onClick={() =>
                  void runCommand({
                    action: "enqueue",
                    documentId: selectedDocId,
                  })
                }
              >
                {t.runOcr}
              </Button>
              {transactionStatus === "EXTRACTING" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void runCommand({ action: "fallback" })}
                >
                  {t.manualFallbackButton}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {data.jobs.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <h3 className="text-sm font-semibold">{t.jobsTitle}</h3>
          <ul className="space-y-2 text-xs">
            {data.jobs.map((job) => (
              <li
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
              >
                <div className="space-y-1">
                  <div className="font-mono font-medium">
                    {job.providerSlug} ({job.model}) ·{" "}
                    {t.jobStatuses[job.status]}
                  </div>
                  <div className="text-muted-foreground">
                    {t.attemptsLabel}: {job.attemptCount}/{job.maxAttempts}
                    {job.errorMessage ? ` · ${job.errorMessage}` : ""}
                  </div>
                </div>
                {canPrepare &&
                  (job.status === "DEAD_LETTER" ||
                    job.status === "FAILED_RETRYABLE") && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void runCommand({ action: "retry", jobId: job.id })
                      }
                    >
                      {t.retryJobButton}
                    </Button>
                  )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {latestCandidate && (
        <div className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t.candidatesTitle}</h3>
            {latestCandidate.reviewedAt && (
              <StatusBadge active>{t.alreadyReviewed}</StatusBadge>
            )}
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {t.provenanceLabel}: {latestCandidate.providerSlug} /{" "}
            {latestCandidate.model} ({latestCandidate.providerVersion})
          </p>
          {latestCandidate.promptInjectionDetected && (
            <p
              role="alert"
              className="rounded-md border p-3 text-xs font-semibold"
            >
              {t.promptInjectionAlert}
            </p>
          )}
          <div className="space-y-2 rounded-md border p-3 text-xs">
            {(
              [
                [
                  "invoiceNumber",
                  latestCandidate.extractedFields.invoiceNumber,
                ],
                ["documentDate", latestCandidate.extractedFields.documentDate],
                ["taxPeriod", latestCandidate.extractedFields.taxPeriod],
                [
                  "counterpartyName",
                  latestCandidate.extractedFields.counterpartyName,
                ],
                [
                  "counterpartyIdentity",
                  latestCandidate.extractedFields.counterpartyIdentity,
                ],
                ["currency", latestCandidate.extractedFields.currency],
                ["totalAmount", latestCandidate.extractedFields.totalAmount],
              ] as const
            ).map(([key, field]) => (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-1 last:border-b-0 last:pb-0"
              >
                <span className="font-medium">{t.fieldLabels[key]}</span>
                <span className="font-mono">
                  {t.rawLabel}: {field.raw ?? "—"} · {t.normalizedLabel}:{" "}
                  {field.normalized ?? "—"} · {t.confidenceLabel}:{" "}
                  {formatConfidence(field)}
                </span>
                {field.requiresVerification && (
                  <StatusBadge>{t.lowConfidenceBadge}</StatusBadge>
                )}
              </div>
            ))}
          </div>

          {canPrepare &&
            ["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"].includes(
              transactionStatus,
            ) && (
              <form onSubmit={applyCandidate} className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={t.fieldLabels.invoiceNumber}
                    value={inv}
                    onChange={(e) => setInv(e.target.value)}
                  />
                  <Field
                    label={t.fieldLabels.documentDate}
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                  />
                  <Field
                    label={t.fieldLabels.taxPeriod}
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  />
                  <Field
                    label={t.fieldLabels.counterpartyIdentity}
                    value={verifiedId}
                    onChange={(e) => setVerifiedId(e.target.value)}
                  />
                  <Field
                    label={t.fieldLabels.lineDescription}
                    value={lineDesc}
                    onChange={(e) => setLineDesc(e.target.value)}
                  />
                  <Field
                    label={t.fieldLabels.quantity}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                  <Field
                    label={t.fieldLabels.unitPrice}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                {requiresSensitiveVerify && (
                  <label className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={verifyChecked}
                      onChange={(e) => setVerifyChecked(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>{t.verifySensitiveCheckbox}</span>
                  </label>
                )}
                <Submit busy={busy}>{t.applyCandidatesButton}</Submit>
              </form>
            )}
        </div>
      )}
    </section>
  );
}
