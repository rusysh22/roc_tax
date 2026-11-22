"use client";
import { useState } from "react";
import { Play, PowerOff } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { formatDate } from "@/i18n/format";
import { salesMessages } from "@/i18n/sales";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput } from "@/components/ui/field";
import { Notice, Skeleton } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { comboLabels } from "@/components/views/page-state";
import { PagedFooter, usePaged } from "@/components/views/paged";
import { useResource } from "@/components/views/use-resource";
import { apiGet, apiPost, formatFailure } from "@/components/intake/client";

type Termination = {
  id: string;
  workspace: string;
  organizationId: string;
  status: "REQUESTED" | "CANCELLED" | "TERMINATED" | "PURGED";
  reason: string;
  requestedAt: string;
  effectiveAt: string;
  purgeAfter: string | null;
  purgedAt: string | null;
  purgedDocuments: number;
};
type Payload = {
  noticeDays: number;
  retentionDays: number | null;
  terminations: Termination[];
};

export function AdminLifecycle({
  locale,
  workspaces,
}: {
  locale: Locale;
  workspaces: { id: string; name: string }[];
}) {
  const t = salesMessages[locale];
  const v = viewMessages[locale];
  const toast = useToast();
  const { data, error, reload } = useResource(() =>
    apiGet<Payload>("/api/admin/lifecycle"),
  );
  const [dialog, setDialog] = useState<{
    organizationId: string | null;
    reason: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const paged = usePaged(data?.terminations ?? []);

  async function post(
    body: unknown,
    done?: (r: Record<string, number>) => void,
  ) {
    setBusy(true);
    try {
      const result = await apiPost<Record<string, number>>(
        "/api/admin/lifecycle",
        body,
      );
      done?.(result);
      setDialog(null);
      await reload();
    } catch (failure) {
      toast.error(formatFailure(failure, locale));
    } finally {
      setBusy(false);
    }
  }

  if (error)
    return <Notice tone="danger">{formatFailure(error, locale)}</Notice>;
  if (!data) return <Skeleton className="h-40 w-full" />;
  const date = (iso: string | null) =>
    iso ? formatDate(new Date(iso), locale) : "—";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.lifecycleIntro}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {t.notice}:{" "}
          <span className="font-semibold">
            {fmt(t.daysValue, { n: data.noticeDays })}
          </span>{" "}
          · {t.retention}:{" "}
          <span className="font-semibold">
            {data.retentionDays
              ? fmt(t.daysValue, { n: data.retentionDays })
              : t.notSet}
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void post({ action: "run" }, (r) =>
                toast.success(
                  fmt(t.runResult, {
                    terminated: r.terminated ?? 0,
                    purged: r.purgedWorkspaces ?? 0,
                    docs: r.purgedDocuments ?? 0,
                  }),
                ),
              )
            }
          >
            <Play aria-hidden="true" />
            <span>{t.runNow}</span>
          </Button>
          <Button
            variant="danger"
            onClick={() => setDialog({ organizationId: null, reason: "" })}
          >
            <PowerOff aria-hidden="true" />
            <span>{t.terminate}</span>
          </Button>
        </div>
      </div>
      {data.terminations.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t.noTerminations}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-surface-2 text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.workspace}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {v.status}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {t.received}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {accountLabel(locale, "effective")}
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold">
                    {accountLabel(locale, "purge")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paged.rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{r.workspace}</p>
                      {r.reason && (
                        <p className="text-xs text-muted-foreground">
                          {r.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <CodeBadge domain="terminationStatus" code={r.status} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {date(r.requestedAt)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {date(r.effectiveAt)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.purgedAt
                        ? `${date(r.purgedAt)} (${r.purgedDocuments})`
                        : date(r.purgeAfter)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PagedFooter paged={paged} v={v} />
        </div>
      )}
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={t.terminateTitle}
        size="sm"
        closeLabel={v.cancel}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {v.cancel}
            </Button>
            <Button
              variant="danger"
              disabled={
                busy ||
                !dialog?.organizationId ||
                (dialog?.reason.trim().length ?? 0) < 3
              }
              onClick={() =>
                dialog?.organizationId &&
                void post({
                  action: "terminate",
                  organizationId: dialog.organizationId,
                  reason: dialog.reason,
                })
              }
            >
              {t.terminate}
            </Button>
          </>
        }
      >
        {dialog && (
          <div className="space-y-3">
            <FormField field="lifecycle.workspace" required>
              <Combobox
                value={dialog.organizationId}
                onChange={(value) =>
                  setDialog({ ...dialog, organizationId: value })
                }
                options={workspaces.map((w) => ({
                  value: w.id,
                  label: w.name,
                }))}
                labels={comboLabels(locale)}
              />
            </FormField>
            <FormField field="lifecycle.reason" required>
              <TextInput
                value={dialog.reason}
                onChange={(e) =>
                  setDialog({ ...dialog, reason: e.target.value })
                }
                maxLength={1000}
              />
            </FormField>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function accountLabel(locale: Locale, key: "effective" | "purge") {
  const labels = {
    id: { effective: "Berlaku mulai", purge: "Penghapusan dokumen" },
    en: { effective: "Effective on", purge: "Document deletion" },
  } as const;
  return labels[locale][key];
}
