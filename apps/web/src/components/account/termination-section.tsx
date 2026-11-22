"use client";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { formatDate } from "@/i18n/format";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormField, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPost, formatFailure } from "@/components/intake/client";

type Status = {
  canManage: boolean;
  noticeDays: number;
  retentionDays: number | null;
  termination: null | {
    status: "REQUESTED" | "TERMINATED" | "PURGED";
    effectiveAt: string;
    purgeAfter: string | null;
    purgedAt: string | null;
  };
};

/** Owner self-service subscription cancellation with notice + retention info. */
export function TerminationSection({ locale }: { locale: Locale }) {
  const t = accountMessages[locale].settings.privacy;
  const v = viewMessages[locale];
  const toast = useToast();
  const [data, setData] = useState<Status | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () =>
    apiGet<Status>("/api/workspace/termination")
      .then(setData)
      .catch(() => setData(null));
  useEffect(() => {
    void load();
  }, []);

  async function act(body: unknown) {
    setBusy(true);
    try {
      await apiPost("/api/workspace/termination", body);
      toast.success(accountMessages[locale].saved);
      setConfirm(false);
      await load();
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  const term = data.termination;
  const date = (iso: string) => formatDate(new Date(iso), locale);
  const retention = data.retentionDays
    ? fmt(t.retentionWithDays, { days: data.retentionDays })
    : t.retentionNone;

  return (
    <section className="space-y-4">
      <div className="space-y-0.5 border-b pb-2">
        <h2 className="text-base font-semibold">{t.terminationTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {fmt(t.terminationIntro, { notice: data.noticeDays, retention })}
        </p>
      </div>
      {term ? (
        <div className="space-y-3 rounded-lg border p-4">
          <CodeBadge domain="terminationStatus" code={term.status} />
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[14rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">{t.effectiveOn}</dt>
            <dd className="font-medium">{date(term.effectiveAt)}</dd>
            {term.purgedAt ? (
              <>
                <dt className="text-muted-foreground">{t.purgedOn}</dt>
                <dd className="font-medium">{date(term.purgedAt)}</dd>
              </>
            ) : term.purgeAfter ? (
              <>
                <dt className="text-muted-foreground">{t.purgeOn}</dt>
                <dd className="font-medium">{date(term.purgeAfter)}</dd>
              </>
            ) : null}
          </dl>
          {term.status === "REQUESTED" &&
            data.canManage &&
            new Date(term.effectiveAt) > new Date() && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void act({ action: "cancel" })}
              >
                {t.terminationCancel}
              </Button>
            )}
        </div>
      ) : data.canManage ? (
        <div className="max-w-2xl space-y-3">
          <FormField field="termination.reason">
            <TextArea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={1000}
            />
          </FormField>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <LogOut aria-hidden="true" />
            <span>{t.terminationRequest}</span>
          </Button>
        </div>
      ) : (
        <Notice tone="info">{t.terminationOwnerOnly}</Notice>
      )}
      <ConfirmDialog
        open={confirm}
        title={t.terminationConfirmTitle}
        body={t.terminationConfirmBody}
        confirmLabel={t.terminationRequest}
        cancelLabel={v.cancel}
        busy={busy}
        onConfirm={() => void act({ action: "request", reason })}
        onCancel={() => setConfirm(false)}
      />
    </section>
  );
}
