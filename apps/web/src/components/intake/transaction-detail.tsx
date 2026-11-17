"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { formatDate } from "@/i18n/format";
import { lineAmount, sumAmounts } from "@/lib/intake/decimal";
import {
  documentTypes,
  intakeFamilies,
  type DraftInput,
} from "@/lib/intake/schemas";
import { allows, type TransactionStatus } from "@/lib/intake/state";
import { can, type Role } from "@/server/workspaces/policy";
import type { DuplicateWarning } from "@/server/intake/service";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import { TransactionOcrPanel } from "@/components/ocr/transaction-ocr";
import { TransactionReviewPanel } from "@/components/tax/transaction-review";
import {
  ApiFailure,
  apiGet,
  apiPost,
  apiUpload,
  formatAmountString,
  formatFailure,
} from "./client";

type DetailPayload = {
  role: Role;
  transaction: {
    id: string;
    version: number;
    companyId: string;
    counterpartyId: string;
    company: {
      id: string;
      name: string;
      legalName: string;
      npwpHint: string | null;
      nitkuHint: string | null;
    };
    counterparty: {
      id: string;
      name: string;
      kind: string;
      identityType: string;
      identityHint: string | null;
      countryCode: string;
    };
    taxFamily: (typeof intakeFamilies)[number];
    documentType: (typeof documentTypes)[number];
    source: keyof typeof intakeMessages.id.sources;
    status: TransactionStatus;
    invoiceNumber: string;
    documentDate: string;
    taxPeriod: string;
    currency: string;
    description: string | null;
    totalAmount: string;
    voidedAt: string | null;
    voidReason: string | null;
    createdAt: string;
    updatedAt: string;
    lines: {
      id: string;
      position: number;
      description: string;
      quantity: string;
      unitPrice: string;
      amount: string;
    }[];
    documents: {
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      scanStatus: string;
      createdAt: string;
    }[];
    comments: {
      id: string;
      body: string;
      authorName: string;
      createdAt: string;
    }[];
    events: {
      id: string;
      action: string;
      actorName: string;
      changes: unknown;
      createdAt: string;
    }[];
    duplicates: DuplicateWarning[];
  };
};

export function TransactionDetailView({
  locale,
  transactionId,
}: {
  locale: Locale;
  transactionId: string;
}) {
  const t = intakeMessages[locale];
  const [data, setData] = useState<DetailPayload | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [counterparties, setCounterparties] = useState<
    { id: string; name: string }[]
  >([]);
  const [companyId, setCompanyId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [taxFamily, setTaxFamily] =
    useState<(typeof intakeFamilies)[number]>("UNCLASSIFIED");
  const [documentType, setDocumentType] =
    useState<(typeof documentTypes)[number]>("SUPPLIER_INVOICE");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [documentDate, setDocumentDate] = useState("");
  const [taxPeriod, setTaxPeriod] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<
    { description: string; quantity: string; unitPrice: string }[]
  >([]);
  const [duplicates, setDuplicates] = useState<DuplicateWarning[]>([]);
  const [acknowledge, setAcknowledge] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function load() {
    try {
      const [detail, comp, cp] = await Promise.all([
        apiGet<DetailPayload>(`/api/transactions/${transactionId}`),
        apiGet<{ companies: { id: string; name: string }[] }>("/api/companies"),
        apiGet<{ counterparties: { id: string; name: string }[] }>(
          "/api/counterparties",
        ),
      ]);
      const tx = detail.transaction;
      setData(detail);
      setCompanies(comp.companies);
      setCounterparties(cp.counterparties);
      setCompanyId(tx.companyId);
      setCounterpartyId(tx.counterpartyId);
      setTaxFamily(tx.taxFamily);
      setDocumentType(tx.documentType);
      setInvoiceNumber(tx.invoiceNumber);
      setDocumentDate(tx.documentDate);
      setTaxPeriod(tx.taxPeriod);
      setDescription(tx.description ?? "");
      setLines(
        tx.lines.map((l) => ({
          description: l.description,
          quantity: l.quantity.replace(/\.?0+$/, "") || "0",
          unitPrice: l.unitPrice,
        })),
      );
      setDuplicates(tx.duplicates);
      setAcknowledge(false);
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    }
  }
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("uploadError") === "1"
    ) {
      setFeedback(t.uploadFailedAfterCreate);
    }
    void load();
  }, [transactionId]);

  if (!data) {
    return (
      <div className="space-y-4">
        <Link
          className="text-sm underline"
          href={`/${locale}/app/transactions`}
        >
          {t.backToList}
        </Link>
        {feedback ? (
          <p role="alert" className="rounded-md border p-4 text-sm">
            {feedback}
          </p>
        ) : (
          <Skeleton className="h-48 w-full" />
        )}
      </div>
    );
  }
  const tx = data.transaction;
  const canPrepare = can(data.role, "draft.prepare");
  const canEdit = canPrepare && allows(tx.status, "edit");
  const previewDoc = tx.documents.find((d) => d.id === previewDocId) ?? null;

  const linePreview = lines.map((line) => {
    try {
      return lineAmount(line.quantity.trim(), line.unitPrice.trim());
    } catch {
      return null;
    }
  });
  const totalPreview = linePreview.every((item) => item !== null)
    ? sumAmounts(linePreview as string[])
    : null;

  async function saveRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const draft: DraftInput = {
      companyId,
      counterpartyId,
      taxFamily,
      documentType,
      invoiceNumber,
      documentDate,
      taxPeriod,
      currency: "IDR",
      description: description || undefined,
      lines,
    };
    try {
      await apiPost(`/api/transactions/${tx.id}`, {
        action: "update",
        version: tx.version,
        draft,
        acknowledgeDuplicates: acknowledge,
      });
      await load();
      setFeedback(t.saved);
    } catch (error) {
      if (
        error instanceof ApiFailure &&
        error.code === "DUPLICATE_WARNING" &&
        error.duplicates.length
      ) {
        setDuplicates(error.duplicates);
      }
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement | null;
    const chosen = input?.files?.[0];
    if (!chosen) return;
    setBusy(true);
    setFeedback("");
    try {
      const created = await apiUpload<{ id: string }>(
        `/api/transactions/${tx.id}/documents`,
        chosen,
      );
      form.reset();
      await load();
      setPreviewDocId(created.id);
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  async function postComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost(`/api/transactions/${tx.id}`, {
        action: "comment",
        body: commentBody,
      });
      setCommentBody("");
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  async function voidDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost(`/api/transactions/${tx.id}`, {
        action: "void",
        version: tx.version,
        reason: voidReason,
      });
      setVoidReason("");
      await load();
      setFeedback(t.saved);
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link
          className="text-sm underline"
          href={`/${locale}/app/transactions`}
        >
          {t.backToList}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-mono text-3xl font-semibold">
            {tx.invoiceNumber}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge active={tx.status !== "VOIDED"}>
              {t.statuses[tx.status]}
            </StatusBadge>
            <StatusBadge>
              {t.version} {tx.version}
            </StatusBadge>
            <StatusBadge>{t.sources[tx.source]}</StatusBadge>
          </div>
        </div>
        <p className="rounded-md border bg-muted/30 p-3 text-xs leading-6">
          {t.neutralNotice}
        </p>
        {tx.status === "VOIDED" && (
          <p role="status" className="rounded-md border p-4 text-sm">
            {t.voidedBanner} {tx.voidReason ? `(${tx.voidReason})` : ""}
          </p>
        )}
        {feedback && (
          <p
            role="status"
            aria-live="polite"
            className="rounded-md border p-3 text-sm"
          >
            {feedback}
          </p>
        )}
      </header>
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-6 rounded-lg border p-5">
          <form onSubmit={saveRevision} className="space-y-4">
            <fieldset disabled={!canEdit || busy} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t.company}</span>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
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
                  <span>{t.counterparty}</span>
                  <select
                    value={counterpartyId}
                    onChange={(e) => setCounterpartyId(e.target.value)}
                    className="min-h-11 w-full rounded-md border bg-background px-3"
                  >
                    {counterparties.map((cp) => (
                      <option key={cp.id} value={cp.id}>
                        {cp.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t.taxFamily}</span>
                  <select
                    value={taxFamily}
                    onChange={(e) =>
                      setTaxFamily(
                        e.target.value as (typeof intakeFamilies)[number],
                      )
                    }
                    className="min-h-11 w-full rounded-md border bg-background px-3"
                  >
                    {intakeFamilies.map((f) => (
                      <option key={f} value={f}>
                        {t.families[f]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t.documentType}</span>
                  <select
                    value={documentType}
                    onChange={(e) =>
                      setDocumentType(
                        e.target.value as (typeof documentTypes)[number],
                      )
                    }
                    className="min-h-11 w-full rounded-md border bg-background px-3"
                  >
                    {documentTypes.map((d) => (
                      <option key={d} value={d}>
                        {t.documentTypes[d]}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label={t.invoiceNumber}
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  required
                  maxLength={64}
                />
                <Field
                  label={t.documentDate}
                  type="date"
                  value={documentDate}
                  onChange={(e) => setDocumentDate(e.target.value)}
                  required
                />
                <Field
                  label={t.taxPeriod}
                  value={taxPeriod}
                  onChange={(e) => setTaxPeriod(e.target.value)}
                  pattern="\d{4}-(0[1-9]|1[0-2])"
                  required
                />
                <Field label={t.currency} value={tx.currency} readOnly />
              </div>
              <Field
                label={t.description}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{t.lines}</h2>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setLines([
                          ...lines,
                          { description: "", quantity: "1", unitPrice: "0.00" },
                        ])
                      }
                    >
                      {t.addLine}
                    </Button>
                  )}
                </div>
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className="grid gap-3 rounded-md border p-3 sm:grid-cols-3"
                  >
                    <Field
                      label={`${t.lineDescription} #${index + 1}`}
                      value={line.description}
                      onChange={(e) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          description: e.target.value,
                        };
                        setLines(next);
                      }}
                      required
                    />
                    <Field
                      label={`${t.quantity} #${index + 1}`}
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          quantity: e.target.value,
                        };
                        setLines(next);
                      }}
                      required
                    />
                    <Field
                      label={`${t.unitPrice} #${index + 1}`}
                      value={line.unitPrice}
                      onChange={(e) => {
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          unitPrice: e.target.value,
                        };
                        setLines(next);
                      }}
                      required
                    />
                  </div>
                ))}
                <p className="text-right font-mono font-semibold">
                  {t.totalAmount}:{" "}
                  {totalPreview
                    ? formatAmountString(totalPreview, locale)
                    : formatAmountString(tx.totalAmount, locale)}
                </p>
              </div>
              {duplicates.length > 0 && (
                <div className="space-y-2 rounded-md border p-3 text-sm">
                  <p className="font-semibold">{t.duplicateHeading}</p>
                  <ul className="space-y-1 font-mono text-xs">
                    {duplicates.map((dup) => (
                      <li key={dup.id}>
                        {dup.invoiceNumber} · {dup.documentDate} ·{" "}
                        {formatAmountString(dup.totalAmount, locale)}
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={acknowledge}
                        onChange={(e) => setAcknowledge(e.target.checked)}
                      />
                      <span>{t.acknowledgeDuplicates}</span>
                    </label>
                  )}
                </div>
              )}
              {canEdit && <Submit busy={busy}>{t.saveRevision}</Submit>}
            </fieldset>
          </form>
          {canPrepare && allows(tx.status, "void") && (
            <form
              onSubmit={voidDraft}
              className="space-y-3 border-t pt-4 text-sm"
            >
              <h2 className="font-semibold">{t.voidTitle}</h2>
              <Field
                label={t.voidReason}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                required
                maxLength={500}
              />
              <Button type="submit" variant="outline" disabled={busy}>
                {t.voidConfirm}
              </Button>
            </form>
          )}
        </section>
        <section className="space-y-6 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">{t.documents}</h2>
          {!tx.documents.length ? (
            <p className="text-sm text-muted-foreground">{t.noDocuments}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {tx.documents.map((doc) => {
                const url = `/api/transactions/${tx.id}/documents/${doc.id}`;
                return (
                  <li key={doc.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium break-all">
                        {doc.originalName}
                      </span>
                      <span className="font-mono text-xs">
                        {doc.mimeType} · {doc.sizeBytes} B
                      </span>
                    </div>
                    <p className="font-mono text-xs break-all text-muted-foreground">
                      {t.sha256}: {doc.sha256}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.scanNotConfigured}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setPreviewDocId(
                            previewDocId === doc.id ? null : doc.id,
                          )
                        }
                      >
                        {previewDocId === doc.id
                          ? t.hidePreview
                          : t.previewDocument}
                      </Button>
                      <a
                        className="underline py-2 text-xs"
                        href={`${url}?download=1`}
                      >
                        {t.downloadDocument}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {previewDoc && (
            <div className="rounded-md border p-3">
              {previewDoc.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/transactions/${tx.id}/documents/${previewDoc.id}`}
                  alt={previewDoc.originalName}
                  className="max-h-96 w-auto"
                />
              ) : (
                <iframe
                  title={previewDoc.originalName}
                  src={`/api/transactions/${tx.id}/documents/${previewDoc.id}`}
                  className="h-96 w-full rounded border"
                />
              )}
            </div>
          )}
          {canPrepare && allows(tx.status, "attach") && (
            <form onSubmit={uploadFile} className="space-y-3 border-t pt-4">
              <label className="block space-y-2 text-sm font-medium">
                <span>{t.optionalSourceFile}</span>
                <input
                  type="file"
                  name="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="block w-full text-sm"
                />
              </label>
              <Submit busy={busy}>{t.uploadDocument}</Submit>
            </form>
          )}
          <div className="space-y-3 border-t pt-4">
            <TransactionReviewPanel
              locale={locale}
              transactionId={tx.id}
              transactionVersion={tx.version}
              transactionStatus={tx.status}
              currentFamily={tx.taxFamily}
              onChanged={load}
            />
          </div>
          <div className="space-y-3 border-t pt-4">
            <TransactionOcrPanel
              locale={locale}
              transactionId={tx.id}
              transactionStatus={tx.status}
              canPrepare={canPrepare}
              documents={tx.documents.map((d) => ({
                id: d.id,
                originalName: d.originalName,
              }))}
              onApplied={load}
            />
          </div>
          <div className="space-y-3 border-t pt-4">
            <h2 className="text-lg font-semibold">{t.comments}</h2>
            {!tx.comments.length ? (
              <p className="text-sm text-muted-foreground">{t.noComments}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tx.comments.map((c) => (
                  <li key={c.id} className="rounded-md border p-3">
                    <p className="break-words">{c.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.authorName} ·{" "}
                      {formatDate(new Date(c.createdAt), locale)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {allows(tx.status, "comment") && (
              <form onSubmit={postComment} className="space-y-3">
                <Field
                  label={t.commentBody}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  required
                  maxLength={2000}
                />
                <Submit busy={busy}>{t.addComment}</Submit>
              </form>
            )}
          </div>
          <div className="space-y-3 border-t pt-4">
            <h2 className="text-lg font-semibold">{t.history}</h2>
            <ul className="space-y-2 text-xs">
              {tx.events.map((event) => (
                <li key={event.id} className="rounded-md border p-3">
                  <div className="font-mono font-medium">{event.action}</div>
                  <div className="text-muted-foreground">
                    {event.actorName} ·{" "}
                    {formatDate(new Date(event.createdAt), locale)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
