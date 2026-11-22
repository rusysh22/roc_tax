"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { formatDate } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Submit } from "@/components/account/forms";
import { FormField, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/status";
import { PagedFooter, usePaged } from "@/components/views/paged";
import { codeLabel } from "@/i18n/codes";
import { viewMessages } from "@/i18n/views";
import { apiGet, apiPost, formatFailure } from "@/components/intake/client";

type SupportPayload = {
  grants: {
    id: string;
    reason: string;
    status: "ACTIVE" | "REVOKED";
    expiresAt: string;
    revokedAt: string | null;
    createdAt: string;
  }[];
  audits: {
    id: string;
    grantId: string;
    action: string;
    reason: string;
    accessedAt: string;
  }[];
};

export function SupportAccessPanel({ locale }: { locale: Locale }) {
  const t = reportMessages[locale];
  const [data, setData] = useState<SupportPayload | null>(null);
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [busy, setBusy] = useState(false);
  const grantsPage = usePaged(data?.grants ?? []);
  const auditsPage = usePaged(data?.audits ?? []);
  const [feedback, setFeedback] = useState("");

  async function load() {
    try {
      setData(await apiGet<SupportPayload>("/api/workspaces/support-access"));
    } catch {
      // Hidden when non-OWNER/ADMIN or no active workspace.
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onGrant(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/workspaces/support-access", {
        action: "grant",
        reason,
        durationMinutes: Number(durationMinutes),
      });
      setReason("");
      await load();
    } catch (err) {
      setFeedback(formatFailure(err, locale));
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(grantId: string) {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/workspaces/support-access", {
        action: "revoke",
        grantId,
      });
      await load();
    } catch (err) {
      setFeedback(formatFailure(err, locale));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const v = viewMessages[locale];

  return (
    <section className="space-y-5">
      <div className="space-y-0.5 border-b pb-2">
        <h2 className="text-base font-semibold">{t.supportSectionTitle}</h2>
        <p className="text-sm text-muted-foreground">{t.supportSectionIntro}</p>
      </div>
      {feedback && (
        <Notice tone="danger" role="alert">
          {feedback}
        </Notice>
      )}
      <form onSubmit={onGrant} className="grid max-w-2xl gap-y-3">
        <FormField
          field="support.reason"
          label={t.supportReasonLabel}
          required
          layout="inline"
        >
          <TextInput
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
          />
        </FormField>
        <FormField
          field="support.duration"
          label={t.supportDurationLabel}
          required
          layout="inline"
        >
          <TextInput
            type="number"
            min={15}
            max={120}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </FormField>
        <div className="flex justify-end">
          <Submit busy={busy}>{t.supportGrantButton}</Submit>
        </div>
      </form>
      {grantsPage.total > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {v.status}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.supportReasonLabel}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {v.until}
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {grantsPage.rows.map((g) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2.5">
                      <CodeBadge domain="supportAccess" code={g.status} />
                    </td>
                    <td className="px-3 py-2.5">{g.reason}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatDate(new Date(g.expiresAt), locale)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {g.status === "ACTIVE" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onClick={() => void onRevoke(g.id)}
                        >
                          {t.supportRevokeButton}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PagedFooter paged={grantsPage} v={v} />
        </div>
      )}
      {auditsPage.total > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t.supportAuditsTitle}</h3>
          <ul className="divide-y rounded-lg border text-sm">
            {auditsPage.rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap justify-between gap-2 px-3 py-2"
              >
                <span>
                  <span className="font-medium">
                    {codeLabel(locale, "auditAction", a.action)}
                  </span>{" "}
                  <span className="text-muted-foreground">· {a.reason}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(new Date(a.accessedAt), locale)}
                </span>
              </li>
            ))}
          </ul>
          <PagedFooter paged={auditsPage} v={v} />
        </div>
      )}
    </section>
  );
}
