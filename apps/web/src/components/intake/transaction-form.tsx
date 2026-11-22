"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  Ban,
  Calculator,
  CheckCheck,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { codeLabel } from "@/i18n/codes";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { taxMessages } from "@/i18n/tax";
import { shellMessages } from "@/i18n/shell";
import { fmt, viewMessages } from "@/i18n/views";
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
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import {
  Checkbox,
  FieldGroup,
  FormField,
  ReadValue,
  TextArea,
  TextInput,
} from "@/components/ui/field";
import { MenuItem } from "@/components/ui/menu";
import { Notice } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  Chatter,
  FormBody,
  FormPage,
  SheetTitle,
  StatusBar,
} from "@/components/views/form-view";
import { NoWorkspace, comboLabels } from "@/components/views/page-state";
import { useResource } from "@/components/views/use-resource";
import { TaxTab } from "@/components/tax/tax-tab";
import { useTransactionReview } from "@/components/tax/use-review";
import { TransactionOcrPanel } from "@/components/ocr/transaction-ocr";
import {
  ApiFailure,
  apiGet,
  apiDelete,
  apiPost,
  apiUpload,
  formatAmountString,
  formatFailure,
} from "./client";
import { TransactionStatusBadge, transactionSteps } from "./transaction-status";

type Detail = {
  role: Role;
  transaction: {
    id: string;
    version: number;
    companyId: string;
    counterpartyId: string;
    company: { id: string; name: string; legalName: string };
    counterparty: {
      id: string;
      name: string;
      kind: string;
      identityType: string;
      identityHint: string | null;
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
    voidReason: string | null;
    createdAt: string;
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
      createdAt: string;
      deletedAt: string | null;
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
      createdAt: string;
    }[];
    duplicates: DuplicateWarning[];
  };
};
type Line = { description: string; quantity: string; unitPrice: string };
type Draft = {
  companyId: string | null;
  counterpartyId: string | null;
  counterpartyLabel: string;
  taxFamily: (typeof intakeFamilies)[number];
  documentType: (typeof documentTypes)[number];
  invoiceNumber: string;
  documentDate: string;
  taxPeriod: string;
  description: string;
  lines: Line[];
};

const jakartaToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
    new Date(),
  );

function blankDraft(): Draft {
  const today = jakartaToday();
  return {
    companyId: null,
    counterpartyId: null,
    counterpartyLabel: "",
    taxFamily: "UNCLASSIFIED",
    documentType: "SUPPLIER_INVOICE",
    invoiceNumber: "",
    documentDate: today,
    taxPeriod: today.slice(0, 7),
    description: "",
    lines: [{ description: "", quantity: "1", unitPrice: "0.00" }],
  };
}

function toDraft(tx: Detail["transaction"]): Draft {
  return {
    companyId: tx.companyId,
    counterpartyId: tx.counterpartyId,
    counterpartyLabel: tx.counterparty.name,
    taxFamily: tx.taxFamily,
    documentType: tx.documentType,
    invoiceNumber: tx.invoiceNumber,
    documentDate: tx.documentDate,
    taxPeriod: tx.taxPeriod,
    description: tx.description ?? "",
    lines: tx.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity.replace(/\.?0+$/, "") || "0",
      unitPrice: l.unitPrice,
    })),
  };
}

function safeLine(line: Line) {
  try {
    return lineAmount(line.quantity.trim(), line.unitPrice.trim());
  } catch {
    return null;
  }
}

/** Searches active counterparties on the server (no 50-row limit). */
async function searchCounterparties(query: string): Promise<ComboOption[]> {
  const params = new URLSearchParams({ pageSize: "50" });
  if (query.trim()) params.set("q", query.trim());
  const result = await apiGet<{
    counterparties: {
      id: string;
      name: string;
      kind: string;
      identityHint: string | null;
    }[];
  }>(`/api/counterparties?${params}`);
  return result.counterparties.map((c) => ({
    value: c.id,
    label: c.name,
    description: c.identityHint ? `•••• ${c.identityHint}` : undefined,
  }));
}

type Prompt = "request_changes" | "reopen" | "void" | "approve" | null;

export function TransactionForm({
  locale,
  transactionId,
}: {
  locale: Locale;
  transactionId: string | null;
}) {
  const t = intakeMessages[locale];
  const tax = taxMessages[locale];
  const s = shellMessages[locale];
  const v = viewMessages[locale];
  const router = useRouter();
  const toast = useToast();
  const creating = transactionId === null;

  const detail = useResource(
    () =>
      creating
        ? Promise.resolve(null)
        : apiGet<Detail>(`/api/transactions/${transactionId}`),
    [transactionId],
  );
  const companies = useResource(() =>
    apiGet<{
      role: Role;
      companies: { id: string; name: string; archivedAt: string | null }[];
    }>("/api/companies"),
  );
  const tx = detail.data?.transaction ?? null;
  const role = detail.data?.role ?? companies.data?.role;
  const canPrepare = role ? can(role, "draft.prepare") : false;
  const canManageTeam = role ? can(role, "team.manage") : false;
  const editable = creating
    ? canPrepare
    : Boolean(tx && canPrepare && allows(tx.status, "edit"));

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [initial, setInitial] = useState<Draft>(blankDraft);
  const [duplicates, setDuplicates] = useState<DuplicateWarning[]>([]);
  const [acknowledge, setAcknowledge] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [reason, setReason] = useState("");
  const [soleAck, setSoleAck] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState(false);
  async function deleteDocument() {
    if (!tx || !deletingDoc) return;
    setDocBusy(true);
    try {
      await apiDelete(`/api/transactions/${tx.id}/documents/${deletingDoc}`);
      toast.success(t.documentDeleted);
      setDeletingDoc(null);
      await detail.reload();
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setDocBusy(false);
    }
  }
  const [uploading, setUploading] = useState(false);

  const reloadAll = useCallback(async () => {
    await detail.reload();
  }, [detail]);

  const review = useTransactionReview({
    locale,
    transactionId: tx?.id ?? null,
    version: tx?.version ?? 0,
    status: tx?.status ?? "DRAFT",
    family: tx?.taxFamily ?? "UNCLASSIFIED",
    onChanged: reloadAll,
  });

  const mode = creating ? "create" : editing ? "edit" : "read";
  const lineAmounts = draft.lines.map(safeLine);
  const total = lineAmounts.every((a) => a !== null)
    ? sumAmounts(lineAmounts as string[])
    : null;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setLine = (index: number, patch: Partial<Line>) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));

  const companyOptions = useMemo(
    () =>
      (companies.data?.companies ?? [])
        .filter((c) => !c.archivedAt || c.id === draft.companyId)
        .map((c) => ({ value: c.id, label: c.name })),
    [companies.data, draft.companyId],
  );
  const effectiveDraft =
    creating && !draft.companyId && companyOptions[0]
      ? { ...draft, companyId: companyOptions[0].value }
      : draft;

  function buildDraft(): DraftInput {
    return {
      companyId: effectiveDraft.companyId ?? "",
      counterpartyId: effectiveDraft.counterpartyId ?? "",
      taxFamily: effectiveDraft.taxFamily,
      documentType: effectiveDraft.documentType,
      invoiceNumber: effectiveDraft.invoiceNumber,
      documentDate: effectiveDraft.documentDate,
      taxPeriod: effectiveDraft.taxPeriod,
      currency: "IDR",
      description: effectiveDraft.description || undefined,
      lines: effectiveDraft.lines,
    };
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (creating) {
        const created = await apiPost<{ transactionId: string }>(
          "/api/transactions",
          {
            action: "create",
            idempotencyKey,
            draft: buildDraft(),
            acknowledgeDuplicates: acknowledge,
          },
        );
        if (pendingFile) {
          try {
            await apiUpload(
              `/api/transactions/${created.transactionId}/documents`,
              pendingFile,
            );
          } catch {
            toast.error(t.uploadFailedAfterCreate);
          }
        }
        toast.success(v.created);
        router.replace(`/${locale}/app/transactions/${created.transactionId}`);
        return;
      }
      if (!tx) return;
      await apiPost(`/api/transactions/${tx.id}`, {
        action: "update",
        version: tx.version,
        draft: buildDraft(),
        acknowledgeDuplicates: acknowledge,
      });
      await detail.reload();
      setEditing(false);
      setDuplicates([]);
      toast.success(v.saved);
    } catch (failure) {
      if (
        failure instanceof ApiFailure &&
        failure.code === "DUPLICATE_WARNING" &&
        failure.duplicates.length
      ) {
        setDuplicates(failure.duplicates);
        setAcknowledge(false);
        // A changed payload needs a fresh idempotency key.
        if (creating) setIdempotencyKey(crypto.randomUUID());
      }
      setError(formatFailure(failure, locale));
    } finally {
      setSaving(false);
    }
  }

  async function runReview(payload: Record<string, unknown>, success: string) {
    const message = await review.run(payload);
    if (message) toast.error(message);
    else toast.success(success);
    return !message;
  }

  async function confirmPrompt() {
    if (!tx) return;
    let ok = false;
    if (prompt === "void") {
      try {
        await apiPost(`/api/transactions/${tx.id}`, {
          action: "void",
          version: tx.version,
          reason,
        });
        await detail.reload();
        toast.success(v.saved);
        ok = true;
      } catch (failure) {
        toast.error(formatFailure(failure, locale));
      }
    } else if (prompt === "approve") {
      ok = await runReview(
        {
          action: "approve",
          version: tx.version,
          soleUserOverrideAck: soleAck,
        },
        tax.saved,
      );
    } else if (prompt) {
      ok = await runReview(
        { action: prompt, version: tx.version, reason },
        tax.saved,
      );
    }
    if (ok) {
      setPrompt(null);
      setReason("");
      setSoleAck(false);
    }
  }

  async function upload(file: File) {
    if (!tx) return;
    setUploading(true);
    try {
      const created = await apiUpload<{ id: string }>(
        `/api/transactions/${tx.id}/documents`,
        file,
      );
      await detail.reload();
      setPreview(created.id);
      toast.success(v.saved);
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setUploading(false);
    }
  }

  if (detail.noWorkspace || companies.noWorkspace)
    return <NoWorkspace locale={locale} />;
  const notFound = !creating && detail.data === null && detail.error !== null;
  const status = tx?.status ?? "DRAFT";
  const c = review.can;
  const labels = comboLabels(locale);
  const showForm = mode !== "read";

  const headerButtons = tx ? (
    <>
      {c.submit && (
        <Button
          type="button"
          disabled={review.busy}
          onClick={() =>
            void runReview({ action: "submit", version: tx.version }, tax.saved)
          }
        >
          <Send aria-hidden="true" />
          <span>{tax.submitButton}</span>
        </Button>
      )}
      {c.approve && (
        <Button
          type="button"
          variant="success"
          disabled={review.busy}
          onClick={() =>
            review.data?.segregationPolicy === "SOLE_USER_EXCEPTION"
              ? setPrompt("approve")
              : void runReview(
                  { action: "approve", version: tx.version },
                  tax.saved,
                )
          }
        >
          <CheckCheck aria-hidden="true" />
          <span>{tax.approveButton}</span>
        </Button>
      )}
      {c.evaluate && !editing && (
        <Button
          type="button"
          variant={c.submit ? "outline" : "default"}
          disabled={review.busy}
          onClick={async () => {
            const message = await review.evaluate();
            if (message) toast.error(message);
            else toast.success(tax.saved);
          }}
        >
          <Calculator aria-hidden="true" />
          <span>{tax.evaluateButton}</span>
        </Button>
      )}
      {c.requestChanges && (
        <Button
          type="button"
          variant="warning"
          disabled={review.busy}
          onClick={() => setPrompt("request_changes")}
        >
          <Undo2 aria-hidden="true" />
          <span>{tax.requestChangesButton}</span>
        </Button>
      )}
      {c.reopen && (
        <Button
          type="button"
          variant="outline"
          disabled={review.busy}
          onClick={() => setPrompt("reopen")}
        >
          <RotateCcw aria-hidden="true" />
          <span>{tax.reopenButton}</span>
        </Button>
      )}
      {["APPROVED", "EXPORTED", "CORETAX_REJECTED"].includes(status) && (
        <Button asChild variant="outline">
          <Link href={`/${locale}/app/exports`}>
            <FileSpreadsheet aria-hidden="true" />
            <span>{s.menuExports}</span>
          </Link>
        </Button>
      )}
    </>
  ) : null;

  const linesEditor = (
    <div className="space-y-3">
      <div className="scroll-thin overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr className="border-b">
              <th scope="col" className="w-10 px-3 py-2 text-left">
                #
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                {t.lineDescription}
              </th>
              <th scope="col" className="w-28 px-3 py-2 text-right">
                {t.quantity}
              </th>
              <th scope="col" className="w-44 px-3 py-2 text-right">
                {t.unitPrice}
              </th>
              <th scope="col" className="w-44 px-3 py-2 text-right">
                {t.totalAmount}
              </th>
              {showForm && <th scope="col" className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {(showForm ? draft.lines : (tx?.lines ?? [])).map((line, index) => {
              const amount = showForm
                ? lineAmounts[index]
                : (tx?.lines[index]?.amount ?? null);
              return (
                <tr key={index} className="border-b last:border-b-0">
                  <td className="px-3 py-2 align-top text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {showForm ? (
                      <TextInput
                        aria-label={`${t.lineDescription} #${index + 1}`}
                        value={line.description}
                        onChange={(e) =>
                          setLine(index, { description: e.target.value })
                        }
                        maxLength={500}
                        required
                      />
                    ) : (
                      <span className="block py-2">{line.description}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {showForm ? (
                      <TextInput
                        aria-label={`${t.quantity} #${index + 1}`}
                        value={line.quantity}
                        onChange={(e) =>
                          setLine(index, { quantity: e.target.value })
                        }
                        inputMode="decimal"
                        className="text-right tabular-nums"
                        required
                      />
                    ) : (
                      <span className="block py-2 text-right tabular-nums">
                        {line.quantity.replace(/\.?0+$/, "")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {showForm ? (
                      <TextInput
                        aria-label={`${t.unitPrice} #${index + 1}`}
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLine(index, { unitPrice: e.target.value })
                        }
                        inputMode="decimal"
                        className="text-right font-mono"
                        required
                      />
                    ) : (
                      <span className="block py-2 text-right font-mono">
                        {formatAmountString(line.unitPrice, locale)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right align-top font-mono whitespace-nowrap">
                    {amount ? formatAmountString(amount, locale) : "—"}
                  </td>
                  {showForm && (
                    <td className="px-1 py-1.5 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`${v.delete} #${index + 1}`}
                        disabled={draft.lines.length <= 1}
                        onClick={() =>
                          set({
                            lines: draft.lines.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border-strong bg-surface-2">
              <td
                colSpan={4}
                className="px-3 py-2.5 text-right text-sm font-bold"
              >
                {t.totalAmount}
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                {showForm
                  ? total
                    ? formatAmountString(total, locale)
                    : "—"
                  : formatAmountString(tx?.totalAmount ?? "0.00", locale)}
              </td>
              {showForm && <td />}
            </tr>
          </tfoot>
        </table>
      </div>
      {showForm && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set({
              lines: [
                ...draft.lines,
                { description: "", quantity: "1", unitPrice: "0.00" },
              ],
            })
          }
        >
          <Plus aria-hidden="true" />
          <span>{t.addLine}</span>
        </Button>
      )}
    </div>
  );

  const documentsTab = (
    <div className="space-y-4">
      {creating ? (
        <FormField
          field="transaction.attachment"
          label={t.optionalSourceFile}
          help={t.scanNotConfigured}
        >
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
        </FormField>
      ) : (
        <>
          {!tx?.documents.length ? (
            <p className="text-sm text-muted-foreground">{t.noDocuments}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {tx.documents.map((doc) => {
                const url = `/api/transactions/${tx.id}/documents/${doc.id}`;
                if (doc.deletedAt)
                  return (
                    <li
                      key={doc.id}
                      className="space-y-1 px-4 py-3 text-sm text-muted-foreground"
                    >
                      <span className="font-medium break-all line-through">
                        {doc.originalName}
                      </span>
                      <p className="text-xs">
                        {fmt(t.documentDeletedOn, {
                          date: formatDate(new Date(doc.deletedAt), locale),
                        })}{" "}
                        · {t.sha256}:{" "}
                        <span className="font-mono break-all">
                          {doc.sha256}
                        </span>
                      </p>
                    </li>
                  );
                return (
                  <li key={doc.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium break-all">
                        {doc.originalName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPreview(preview === doc.id ? null : doc.id)
                          }
                        >
                          {preview === doc.id ? (
                            <EyeOff aria-hidden="true" />
                          ) : (
                            <Eye aria-hidden="true" />
                          )}
                          <span>
                            {preview === doc.id
                              ? t.hidePreview
                              : t.previewDocument}
                          </span>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <a href={`${url}?download=1`}>
                            <Download aria-hidden="true" />
                            <span>{t.downloadDocument}</span>
                          </a>
                        </Button>
                        {(canPrepare || canManageTeam) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:bg-danger-soft"
                            onClick={() => setDeletingDoc(doc.id)}
                          >
                            <Trash2 aria-hidden="true" />
                            <span>{t.deleteDocument}</span>
                          </Button>
                        )}
                      </span>
                    </div>
                    <p className="font-mono text-xs break-all text-muted-foreground">
                      {doc.mimeType} · {doc.sizeBytes} B · {t.sha256}:{" "}
                      {doc.sha256}
                    </p>
                    {preview === doc.id &&
                      (doc.mimeType.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={doc.originalName}
                          className="max-h-[32rem] w-auto rounded border"
                        />
                      ) : (
                        <iframe
                          title={doc.originalName}
                          src={url}
                          className="h-[32rem] w-full rounded border"
                        />
                      ))}
                  </li>
                );
              })}
            </ul>
          )}
          <ConfirmDialog
            open={deletingDoc !== null}
            title={t.deleteDocumentTitle}
            body={t.deleteDocumentBody}
            confirmLabel={t.deleteDocument}
            cancelLabel={v.cancel}
            busy={docBusy}
            onConfirm={() => void deleteDocument()}
            onCancel={() => setDeletingDoc(null)}
          />
          {tx && canPrepare && allows(tx.status, "attach") && (
            <label className="inline-flex cursor-pointer items-center gap-2">
              <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium shadow-xs hover:bg-surface-2">
                <Upload aria-hidden="true" className="size-4" />
                {uploading ? v.saving : t.uploadDocument}
              </span>
              <input
                type="file"
                className="sr-only"
                disabled={uploading}
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void upload(file);
                }}
              />
            </label>
          )}
          <p className="text-xs text-muted-foreground">{t.scanNotConfigured}</p>
        </>
      )}
    </div>
  );

  const headerFields = (
    <div className="grid gap-x-12 gap-y-5 lg:grid-cols-2">
      <FieldGroup>
        <FormField
          field="transaction.companyId"
          label={t.company}
          required={showForm}
          layout="inline"
        >
          {showForm ? (
            <Combobox
              value={effectiveDraft.companyId}
              onChange={(value) => set({ companyId: value })}
              options={companyOptions}
              labels={labels}
            />
          ) : (
            <ReadValue>
              <Link
                href={`/${locale}/app/companies/${tx?.companyId}`}
                className="hover:underline"
              >
                {tx?.company.name}
              </Link>
            </ReadValue>
          )}
        </FormField>
        <FormField
          field="transaction.counterpartyId"
          label={t.counterparty}
          required={showForm}
          layout="inline"
        >
          {showForm ? (
            <Combobox
              value={draft.counterpartyId}
              selectedLabel={draft.counterpartyLabel}
              onChange={(value, option) =>
                set({
                  counterpartyId: value,
                  counterpartyLabel: option?.label ?? "",
                })
              }
              loadOptions={searchCounterparties}
              labels={labels}
            />
          ) : (
            <ReadValue>
              <Link
                href={`/${locale}/app/counterparties/${tx?.counterpartyId}`}
                className="hover:underline"
              >
                {tx?.counterparty.name}
              </Link>
            </ReadValue>
          )}
        </FormField>
        <FormField
          field="transaction.taxFamily"
          label={t.taxFamily}
          required={showForm}
          layout="inline"
        >
          {showForm ? (
            <Combobox
              value={draft.taxFamily}
              onChange={(value) =>
                value && set({ taxFamily: value as Draft["taxFamily"] })
              }
              options={intakeFamilies.map((f) => ({
                value: f,
                label: t.families[f],
              }))}
              labels={labels}
            />
          ) : (
            <ReadValue>{tx ? t.families[tx.taxFamily] : null}</ReadValue>
          )}
        </FormField>
        <FormField
          field="transaction.documentType"
          label={t.documentType}
          required={showForm}
          layout="inline"
        >
          {showForm ? (
            <Combobox
              value={draft.documentType}
              onChange={(value) =>
                value && set({ documentType: value as Draft["documentType"] })
              }
              options={documentTypes.map((d) => ({
                value: d,
                label: t.documentTypes[d],
              }))}
              labels={labels}
            />
          ) : (
            <ReadValue>
              {tx ? t.documentTypes[tx.documentType] : null}
            </ReadValue>
          )}
        </FormField>
      </FieldGroup>
      <FieldGroup>
        <FormField
          field="transaction.documentDate"
          label={t.documentDate}
          required={showForm}
          layout="inline"
        >
          {showForm ? (
            <TextInput
              type="date"
              value={draft.documentDate}
              onChange={(e) => {
                const value = e.target.value;
                set({
                  documentDate: value,
                  // Keep the period in step with the date unless edited separately.
                  ...(draft.taxPeriod === draft.documentDate.slice(0, 7) &&
                  value
                    ? { taxPeriod: value.slice(0, 7) }
                    : {}),
                });
              }}
            />
          ) : (
            <ReadValue mono>{tx?.documentDate}</ReadValue>
          )}
        </FormField>
        <FormField
          field="transaction.taxPeriod"
          label={t.taxPeriod}
          required={showForm}
          layout="inline"
        >
          {showForm ? (
            <TextInput
              value={draft.taxPeriod}
              onChange={(e) => set({ taxPeriod: e.target.value })}
              pattern="\d{4}-(0[1-9]|1[0-2])"
              placeholder="YYYY-MM"
              className="font-mono"
            />
          ) : (
            <ReadValue mono>{tx?.taxPeriod}</ReadValue>
          )}
        </FormField>
        <FormField
          field="transaction.currency"
          label={t.currency}
          layout="inline"
        >
          <ReadValue mono>IDR</ReadValue>
        </FormField>
        {tx && (
          <FormField
            field="transaction.source"
            label={t.source}
            layout="inline"
          >
            <ReadValue>
              {t.sources[tx.source]} · {t.version} {tx.version}
            </ReadValue>
          </FormField>
        )}
      </FieldGroup>
    </div>
  );

  const sheet = (
    <div className="space-y-6">
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-foreground px-4 py-3 text-sm font-medium"
        >
          {error}
        </p>
      )}
      {duplicates.length > 0 && (
        <Notice tone="warning" title={t.duplicateHeading}>
          <ul className="space-y-0.5 font-mono text-xs">
            {duplicates.map((dup) => (
              <li key={dup.id}>
                {dup.invoiceNumber} · {dup.documentDate} ·{" "}
                {formatAmountString(dup.totalAmount, locale)}
              </li>
            ))}
          </ul>
          {showForm && (
            <Checkbox
              className="mt-3 text-foreground"
              label={t.acknowledgeDuplicates}
              checked={acknowledge}
              onChange={(e) => setAcknowledge(e.target.checked)}
            />
          )}
        </Notice>
      )}
      {showForm ? (
        <FormField
          field="transaction.invoiceNumber"
          label={t.invoiceNumber}
          required
        >
          <TextInput
            value={draft.invoiceNumber}
            onChange={(e) => set({ invoiceNumber: e.target.value })}
            maxLength={64}
            autoFocus={creating}
            className="font-mono text-lg font-semibold"
          />
        </FormField>
      ) : (
        <SheetTitle
          label={t.invoiceNumber}
          aside={
            tx && <TransactionStatusBadge status={tx.status} locale={locale} />
          }
        >
          <span className="font-mono">{tx?.invoiceNumber}</span>
        </SheetTitle>
      )}
      {headerFields}
      {showForm ? (
        <FormField field="transaction.description" label={t.description}>
          <TextArea
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={1000}
            rows={2}
          />
        </FormField>
      ) : (
        tx?.description && (
          <FormField field="transaction.description" label={t.description}>
            <ReadValue className="min-h-0 py-0">{tx.description}</ReadValue>
          </FormField>
        )
      )}
      <p className="text-xs text-muted-foreground">{t.neutralNotice}</p>
      <Tabs
        label={v.details}
        items={[
          {
            id: "lines",
            label: t.lines,
            badge: (showForm ? draft.lines : (tx?.lines ?? [])).length,
            content: linesEditor,
          },
          {
            id: "tax",
            label: tax.panelTitle.split(",")[0],
            hidden: creating,
            content: tx ? (
              <TaxTab
                locale={locale}
                review={review}
                status={tx.status}
                onEvaluate={async () => {
                  const message = await review.evaluate();
                  if (message) toast.error(message);
                  else toast.success(tax.saved);
                }}
              />
            ) : null,
          },
          {
            id: "documents",
            label: t.documents,
            badge: creating
              ? pendingFile
                ? 1
                : 0
              : (tx?.documents.length ?? 0),
            content: documentsTab,
          },
          {
            id: "ocr",
            label: "OCR",
            hidden: creating,
            content: tx ? (
              <TransactionOcrPanel
                locale={locale}
                transactionId={tx.id}
                transactionStatus={tx.status}
                canPrepare={canPrepare}
                documents={tx.documents.map((d) => ({
                  id: d.id,
                  originalName: d.originalName,
                }))}
                onApplied={reloadAll}
              />
            ) : null,
          },
        ]}
      />
    </div>
  );

  return (
    <FormPage
      locale={locale}
      model="transactions"
      breadcrumbs={[
        { label: s.menuTransactions, href: `/${locale}/app/transactions` },
        {
          label: creating
            ? v.new
            : (tx?.invoiceNumber ?? (notFound ? v.notFound : "…")),
        },
      ]}
      recordId={transactionId ?? undefined}
      hrefFor={(id) => `/${locale}/app/transactions/${id}`}
      mode={mode}
      dirty={
        creating
          ? draft.invoiceNumber !== ""
          : JSON.stringify(draft) !== JSON.stringify(initial)
      }
      saving={saving}
      canEdit={editable}
      onEdit={() => {
        if (!tx) return;
        setDraft(toDraft(tx));
        setInitial(toDraft(tx));
        setDuplicates(tx.duplicates);
        setAcknowledge(false);
        setError(null);
        setEditing(true);
      }}
      onDiscard={() => {
        if (creating) router.push(`/${locale}/app/transactions`);
        else {
          setEditing(false);
          setError(null);
        }
      }}
      ribbon={status === "VOIDED" ? t.statuses.VOIDED : undefined}
      loading={!creating && detail.data === null && !notFound}
      banner={
        tx?.status === "VOIDED" ? (
          <Notice tone="warning" role="status">
            {t.voidedBanner} {tx.voidReason ? `(${tx.voidReason})` : ""}
          </Notice>
        ) : creating && !canPrepare && role ? (
          <Notice tone="warning" role="alert">
            {t.preparerRequired}
          </Notice>
        ) : undefined
      }
      statusBar={
        tx ? (
          <StatusBar
            steps={transactionSteps(locale, status)}
            current={status}
            buttons={headerButtons}
            label={t.status}
          />
        ) : undefined
      }
      gear={
        tx && canPrepare && allows(tx.status, "void")
          ? (close) => (
              <MenuItem
                danger
                icon={<Ban />}
                onSelect={() => {
                  close();
                  setPrompt("void");
                }}
              >
                {t.voidConfirm}
              </MenuItem>
            )
          : undefined
      }
      chatter={
        tx ? (
          <Chatter
            locale={locale}
            comments={tx.comments.map((c) => ({
              id: c.id,
              author: c.authorName,
              at: c.createdAt,
              body: c.body,
            }))}
            log={tx.events.map((e) => ({
              id: e.id,
              author: e.actorName,
              at: e.createdAt,
              action: codeLabel(locale, "auditAction", e.action),
            }))}
            canComment={allows(tx.status, "comment")}
            emptyComments={t.noComments}
            commentLabel={t.commentBody}
            onComment={async (body) => {
              try {
                await apiPost(`/api/transactions/${tx.id}`, {
                  action: "comment",
                  body,
                });
                await detail.reload();
              } catch (failure) {
                toast.error(formatFailure(failure, locale));
                throw failure;
              }
            }}
          />
        ) : undefined
      }
    >
      {notFound ? (
        <p role="alert" className="text-sm">
          {v.notFound}
        </p>
      ) : showForm ? (
        <FormBody
          model="transactions"
          onSubmit={() => void save()}
          disabled={saving || !editable}
        >
          {sheet}
        </FormBody>
      ) : (
        sheet
      )}
      <Dialog
        open={prompt !== null}
        onClose={() => setPrompt(null)}
        size="sm"
        closeLabel={v.cancel}
        title={
          prompt === "void"
            ? t.voidTitle
            : prompt === "approve"
              ? tax.approveButton
              : prompt === "reopen"
                ? tax.reopenButton
                : tax.requestChangesButton
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPrompt(null)}
            >
              {v.cancel}
            </Button>
            <Button
              type="button"
              variant={
                prompt === "void"
                  ? "danger"
                  : prompt === "approve"
                    ? "success"
                    : prompt === "request_changes"
                      ? "warning"
                      : "default"
              }
              disabled={
                review.busy ||
                (prompt === "approve" ? !soleAck : reason.trim().length < 2)
              }
              onClick={() => void confirmPrompt()}
            >
              {prompt === "void"
                ? t.voidConfirm
                : prompt === "approve"
                  ? tax.approveButton
                  : prompt === "reopen"
                    ? tax.reopenButton
                    : tax.requestChangesButton}
            </Button>
          </>
        }
      >
        {prompt === "approve" ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium">{tax.soleUserWarning}</p>
            <Checkbox
              label={tax.soleUserAckLabel}
              checked={soleAck}
              onChange={(e) => setSoleAck(e.target.checked)}
            />
          </div>
        ) : (
          <FormField
            field={
              prompt === "void"
                ? "transaction.voidReason"
                : "tax.decisionReason"
            }
            label={prompt === "void" ? t.voidReason : tax.reasonLabel}
            required
          >
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={prompt === "void" ? 500 : 1000}
              rows={3}
              autoFocus
            />
          </FormField>
        )}
      </Dialog>
    </FormPage>
  );
}
