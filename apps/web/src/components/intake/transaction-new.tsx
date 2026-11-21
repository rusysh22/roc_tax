"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { lineAmount, sumAmounts } from "@/lib/intake/decimal";
import {
  blockedIntakeFamilies,
  documentTypes,
  intakeFamilies,
  type DraftInput,
} from "@/lib/intake/schemas";
import { can, type Role } from "@/server/workspaces/policy";
import type { DuplicateWarning } from "@/server/intake/service";
import { TrialStrip } from "@/components/account/trial-strip";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  apiUpload,
  formatAmountString,
  formatFailure,
} from "./client";

type LineDraft = { description: string; quantity: string; unitPrice: string };

export function NewTransactionView({ locale }: { locale: Locale }) {
  const t = intakeMessages[locale];
  const site = siteMessages[locale];
  const acc = accountMessages[locale];
  const [role, setRole] = useState<Role | null>(null);
  const [companies, setCompanies] = useState<
    { id: string; name: string; archivedAt: string | null }[]
  >([]);
  const [counterparties, setCounterparties] = useState<
    { id: string; name: string; kind: string }[]
  >([]);
  const [companyId, setCompanyId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [taxFamily, setTaxFamily] =
    useState<(typeof intakeFamilies)[number]>("UNCLASSIFIED");
  const [documentType, setDocumentType] =
    useState<(typeof documentTypes)[number]>("SUPPLIER_INVOICE");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  // Default to today in Asia/Jakarta (the tax calendar), never a fixed date.
  const [documentDate, setDocumentDate] = useState(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      new Date(),
    ),
  );
  const [taxPeriod, setTaxPeriod] = useState(() => documentDate.slice(0, 7));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { description: "", quantity: "1", unitPrice: "0.00" },
  ]);
  const [file, setFile] = useState<File | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateWarning[]>([]);
  const [acknowledge, setAcknowledge] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<{
        role: Role;
        companies: { id: string; name: string; archivedAt: string | null }[];
      }>("/api/companies"),
      apiGet<{
        counterparties: { id: string; name: string; kind: string }[];
      }>("/api/counterparties"),
    ])
      .then(([comp, cp]) => {
        const activeCompanies = comp.companies.filter((c) => !c.archivedAt);
        setRole(comp.role);
        setCompanies(activeCompanies);
        setCounterparties(cp.counterparties);
        setCompanyId(activeCompanies[0]?.id ?? "");
        setCounterpartyId(cp.counterparties[0]?.id ?? "");
      })
      .catch((error) => {
        if (error instanceof ApiFailure && error.code === "NO_WORKSPACE")
          setNoWorkspace(true);
        else setFeedback(formatFailure(error, locale));
      });
  }, []);

  function updateDraft<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setIdempotencyKey(crypto.randomUUID());
    setAcknowledge(false);
  }

  function buildDraft(): DraftInput {
    return {
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
  }

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

  async function runCheck() {
    setBusy(true);
    setFeedback("");
    try {
      const result = await apiPost<{ duplicates: DuplicateWarning[] }>(
        "/api/transactions",
        { action: "check", draft: buildDraft() },
      );
      setDuplicates(result.duplicates);
      setFeedback(
        result.duplicates.length ? t.errors.DUPLICATE_WARNING : t.saved,
      );
    } catch (error) {
      setFeedback(formatFailure(error, locale));
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      const created = await apiPost<{ transactionId: string }>(
        "/api/transactions",
        {
          action: "create",
          idempotencyKey,
          draft: buildDraft(),
          acknowledgeDuplicates: acknowledge,
        },
      );
      if (file) {
        try {
          await apiUpload(
            `/api/transactions/${created.transactionId}/documents`,
            file,
          );
        } catch {
          window.location.assign(
            `/${locale}/app/transactions/${created.transactionId}?uploadError=1`,
          );
          return;
        }
      }
      window.location.assign(
        `/${locale}/app/transactions/${created.transactionId}`,
      );
    } catch (error) {
      if (
        error instanceof ApiFailure &&
        error.code === "DUPLICATE_WARNING" &&
        error.duplicates.length
      ) {
        setDuplicates(error.duplicates);
      }
      setFeedback(formatFailure(error, locale));
      setBusy(false);
    }
  }

  if (noWorkspace) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">{t.newTransaction}</h1>
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
    <div className="max-w-4xl space-y-8">
      <header className="space-y-2">
        <Link
          className="text-sm underline"
          href={`/${locale}/app/transactions`}
        >
          {t.backToList}
        </Link>
        <h1 className="text-3xl font-semibold">{t.newTransaction}</h1>
        <p className="text-sm text-muted-foreground">{t.wizardSteps}</p>
        <p className="rounded-md border bg-muted/30 p-3 text-xs leading-6">
          {t.neutralNotice}
        </p>
      </header>
      <TrialStrip locale={locale} />
      {!canPrepare ? (
        <p role="alert" className="rounded-md border p-5 text-sm">
          {t.preparerRequired}
        </p>
      ) : !companies.length || !counterparties.length ? (
        <div className="space-y-4 rounded-md border p-5 text-sm">
          <p>{t.setupRequired}</p>
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
        <form onSubmit={submit} className="space-y-6 rounded-lg border p-6">
          {feedback && (
            <p role="alert" className="rounded-md border p-3 text-sm">
              {feedback}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium">
              <span>{t.company}</span>
              <select
                value={companyId}
                onChange={(e) => updateDraft(setCompanyId, e.target.value)}
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
                onChange={(e) => updateDraft(setCounterpartyId, e.target.value)}
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
                  updateDraft(
                    setTaxFamily,
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
                {blockedIntakeFamilies.map((f) => (
                  <option key={f} value={f} disabled>
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
                  updateDraft(
                    setDocumentType,
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
              name="invoiceNumber"
              value={invoiceNumber}
              onChange={(e) => updateDraft(setInvoiceNumber, e.target.value)}
              minLength={1}
              maxLength={64}
              required
            />
            <Field
              label={t.documentDate}
              name="documentDate"
              type="date"
              value={documentDate}
              onChange={(e) => {
                const v = e.target.value;
                updateDraft(setDocumentDate, v);
                if (/^\d{4}-\d{2}/.test(v)) setTaxPeriod(v.slice(0, 7));
              }}
              required
            />
            <Field
              label={t.taxPeriod}
              name="taxPeriod"
              value={taxPeriod}
              onChange={(e) => updateDraft(setTaxPeriod, e.target.value)}
              pattern="\d{4}-(0[1-9]|1[0-2])"
              required
            />
            <Field
              label={t.currency}
              name="currency"
              value="IDR"
              readOnly
              aria-readonly="true"
            />
          </div>
          <p className="text-xs text-muted-foreground">{t.blockedFamilyNote}</p>
          <Field
            label={t.description}
            name="description"
            value={description}
            onChange={(e) => updateDraft(setDescription, e.target.value)}
            maxLength={1000}
          />
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{t.lines}</h2>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  updateDraft(setLines, [
                    ...lines,
                    { description: "", quantity: "1", unitPrice: "0.00" },
                  ])
                }
              >
                {t.addLine}
              </Button>
            </div>
            {lines.map((line, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-md border p-4 sm:grid-cols-4"
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
                    updateDraft(setLines, next);
                  }}
                  required
                  maxLength={500}
                />
                <Field
                  label={`${t.quantity} #${index + 1}`}
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...next[index], quantity: e.target.value };
                    updateDraft(setLines, next);
                  }}
                  required
                />
                <Field
                  label={`${t.unitPrice} #${index + 1}`}
                  value={line.unitPrice}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...next[index], unitPrice: e.target.value };
                    updateDraft(setLines, next);
                  }}
                  required
                />
                <div className="flex flex-col justify-between text-sm">
                  <span className="font-medium">{t.lineTotal}</span>
                  <span className="font-mono">
                    {linePreview[index]
                      ? formatAmountString(linePreview[index]!, locale)
                      : "—"}
                  </span>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateDraft(
                          setLines,
                          lines.filter((_, i) => i !== index),
                        )
                      }
                    >
                      {t.removeLine}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-right font-mono text-base font-semibold">
              {t.totalAmount}:{" "}
              {totalPreview ? formatAmountString(totalPreview, locale) : "—"}
            </p>
          </section>
          <label className="block space-y-2 text-sm font-medium">
            <span>{t.optionalSourceFile}</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
          </label>
          {duplicates.length > 0 && (
            <section
              role="region"
              aria-label={t.duplicateHeading}
              className="space-y-3 rounded-md border p-4 text-sm"
            >
              <h3 className="font-semibold">{t.duplicateHeading}</h3>
              <ul className="space-y-2">
                {duplicates.map((dup) => (
                  <li
                    key={dup.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="font-mono">
                      {dup.invoiceNumber} · {dup.documentDate} ·{" "}
                      {formatAmountString(dup.totalAmount, locale)} ·{" "}
                      {dup.counterpartyName}
                    </span>
                    <StatusBadge>
                      {dup.exactAmount ? t.exactMatch : t.invoiceMatch}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={acknowledge}
                  onChange={(e) => setAcknowledge(e.target.checked)}
                />
                <span>{t.acknowledgeDuplicates}</span>
              </label>
            </section>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={runCheck}
            >
              {t.checkDraft}
            </Button>
            <Submit busy={busy}>{t.createDraft}</Submit>
          </div>
        </form>
      )}
    </div>
  );
}
