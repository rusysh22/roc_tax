"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { formatDate } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
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

  return (
    <div className="space-y-3 rounded-md border p-4 text-xs">
      <h3 className="text-sm font-semibold">{t.supportSectionTitle}</h3>
      <p className="text-muted-foreground">{t.supportSectionIntro}</p>
      {feedback && (
        <p role="alert" className="rounded border p-2">
          {feedback}
        </p>
      )}
      <form onSubmit={onGrant} className="grid gap-3 md:grid-cols-3">
        <Field
          label={t.supportReasonLabel}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          minLength={5}
          required
        />
        <Field
          label={t.supportDurationLabel}
          type="number"
          min={15}
          max={120}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          required
        />
        <div className="flex items-end">
          <Submit busy={busy}>{t.supportGrantButton}</Submit>
        </div>
      </form>
      {data.grants.length > 0 && (
        <ul className="space-y-2">
          {data.grants.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"
            >
              <span>
                <StatusBadge>{g.status}</StatusBadge> · {g.reason} · exp{" "}
                {formatDate(new Date(g.expiresAt), locale)}
              </span>
              {g.status === "ACTIVE" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void onRevoke(g.id)}
                >
                  {t.supportRevokeButton}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {data.audits.length > 0 && (
        <div className="space-y-1 border-t pt-2">
          <p className="font-semibold">{t.supportAuditsTitle}</p>
          <ul className="space-y-1 font-mono text-muted-foreground">
            {data.audits.map((a) => (
              <li key={a.id}>
                {a.action} · {a.reason} ·{" "}
                {formatDate(new Date(a.accessedAt), locale)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
