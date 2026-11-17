"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { exportMessages } from "@/i18n/exports";
import { formatDate } from "@/i18n/format";
import { allTaxFamilies } from "@/lib/intake/tax-rules";
import type { XmlTemplateStatus } from "@/lib/export/bppu-spec";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type TemplateRow = {
  id: string;
  taxFamily: string;
  versionTag: string;
  sourceUrl: string;
  sourceLabel: string;
  sourcePublishedAt: string | null;
  sourceSha256: string;
  referenceUrl: string | null;
  referenceSha256: string | null;
  xsdSchemaHash: string;
  status: XmlTemplateStatus;
  fixtureVerified: boolean;
  notes: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
};

export function AdminXmlTemplatesView({ locale }: { locale: Locale }) {
  const t = exportMessages[locale];
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [taxFamily, setTaxFamily] = useState("PPN_FAKTUR_KELUARAN");
  const [versionTag, setVersionTag] = useState("");
  const [sourceUrl, setSourceUrl] = useState(
    "https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml",
  );
  const [sourceLabel, setSourceLabel] = useState("");
  const [sourceSha256, setSourceSha256] = useState("");
  const [xsdSchemaHash, setXsdSchemaHash] = useState("");
  const [fixtureVerified, setFixtureVerified] = useState(false);

  function formatErr(error: unknown) {
    if (error instanceof ApiFailure) {
      const map = t.errors as Record<string, string>;
      if (map[error.code]) return map[error.code];
    }
    return formatFailure(error, locale);
  }

  async function load() {
    setLoading(true);
    try {
      const payload = await apiGet<{ templates: TemplateRow[] }>(
        "/api/admin/xml-templates",
      );
      setTemplates(payload.templates);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onRegister(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/admin/xml-templates", {
        action: "create",
        taxFamily,
        versionTag,
        sourceUrl,
        sourceLabel,
        sourceSha256,
        xsdSchemaHash,
        fixtureVerified,
      });
      setVersionTag("");
      setSourceLabel("");
      setSourceSha256("");
      setXsdSchemaHash("");
      setFixtureVerified(false);
      await load();
      setFeedback(t.templateSaved);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(templateId: string, status: XmlTemplateStatus) {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/admin/xml-templates", {
        action: "set_status",
        templateId,
        status,
      });
      await load();
      setFeedback(t.templateSaved);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.adminTitle}</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.adminIntro}
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

      <form
        onSubmit={onRegister}
        className="space-y-4 rounded-lg border p-6 text-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 font-medium">
            {t.familyLabel}
            <select
              value={taxFamily}
              onChange={(e) => setTaxFamily(e.target.value)}
              className="min-h-11 rounded-md border bg-background px-3 text-sm"
            >
              {allTaxFamilies
                .filter((f) => f !== "UNCLASSIFIED")
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          </label>
          <Field
            label={t.versionTagLabel}
            value={versionTag}
            onChange={(e) => setVersionTag(e.target.value)}
            required
          />
          <Field
            label={t.sourceUrlLabel}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            required
          />
          <Field
            label={t.sourceLabelField}
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            required
          />
          <Field
            label={t.sourceShaField}
            value={sourceSha256}
            onChange={(e) => setSourceSha256(e.target.value)}
            pattern="[a-fA-F0-9]{64}"
            required
          />
          <Field
            label={t.xsdHashField}
            value={xsdSchemaHash}
            onChange={(e) => setXsdSchemaHash(e.target.value)}
            pattern="[a-fA-F0-9]{64}"
            required
          />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={fixtureVerified}
            onChange={(e) => setFixtureVerified(e.target.checked)}
          />
          <span>{t.fixtureVerifiedLabel}</span>
        </label>
        <Submit busy={busy}>{t.registerButton}</Submit>
      </form>

      <div className="space-y-4">
        {templates.map((tpl) => (
          <article
            key={tpl.id}
            className="space-y-2 rounded-lg border p-5 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="font-mono text-sm">
                  {tpl.taxFamily} · {tpl.versionTag}
                </strong>
                <StatusBadge>{tpl.status}</StatusBadge>
                <StatusBadge>
                  fixtureVerified={String(tpl.fixtureVerified)}
                </StatusBadge>
              </div>
              <div className="flex flex-wrap gap-2">
                {tpl.status !== "VERIFIED" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void setStatus(tpl.id, "VERIFIED")}
                  >
                    {t.verifyButton}
                  </Button>
                )}
                {tpl.status !== "RETIRED" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void setStatus(tpl.id, "RETIRED")}
                  >
                    {t.retireButton}
                  </Button>
                )}
              </div>
            </div>
            <p className="break-all text-muted-foreground">
              {tpl.sourceLabel} — {tpl.sourceUrl}
            </p>
            <p className="break-all font-mono">
              {t.sourceShaLabel}: {tpl.sourceSha256} · {t.schemaShaLabel}:{" "}
              {tpl.xsdSchemaHash}
            </p>
            {tpl.verifiedAt && (
              <p className="text-muted-foreground">
                {tpl.verifiedBy} ·{" "}
                {formatDate(new Date(tpl.verifiedAt), locale)}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
