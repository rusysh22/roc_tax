"use client";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  ClipboardCheck,
  CreditCard,
  ScanText,
  ShieldCheck,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { adminMessages } from "@/i18n/admin";
import { codeLabel, codeOptions } from "@/i18n/codes";
import { fieldInfo } from "@/i18n/fields";
import { formatDate } from "@/i18n/format";
import { fmt, viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { CodeBadge } from "@/components/ui/code-badge";
import { Combobox } from "@/components/ui/combobox";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput } from "@/components/ui/field";
import { Badge, Notice, Skeleton } from "@/components/ui/status";
import { comboLabels } from "@/components/views/page-state";
import { LIST_PAGE_SIZE, Pager } from "@/components/views/list-view";
import { apiGet, apiPost, formatFailure } from "@/components/intake/client";
import { cn } from "@/lib/utils";

type Pagination = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};
type Payload = {
  platformHealth: {
    taxRules: {
      total: number;
      smeApproved: number;
      nonProductionTest: number;
      draft: number;
    };
    xmlTemplates: { verified: number; unverified: number; retired: number };
    ocrProviders: { total: number; vendorApproved: number; enabled: number };
    ocrJobs: {
      queued: number;
      running: number;
      succeeded: number;
      failedRetryable: number;
      deadLetter: number;
      cancelled: number;
    };
    billing: {
      adapterMode: string;
      saasLicensingApproved: boolean;
      webhookTotal: number;
      webhookValid: number;
      webhookRejected: number;
    };
  };
  orgPagination: Pagination;
  organizations: {
    id: string;
    name: string;
    createdAt: string;
    memberCount: number;
    companyCount: number;
    transactionCount: number;
    exportBatchCount: number;
    licenseStatus: string;
    activeSupportGrantId: string | null;
    activeSupportGrantExpiresAt: string | null;
  }[];
  jobPagination: Pagination;
  jobs: {
    id: string;
    organizationId: string;
    organizationName: string | null;
    providerSlug: string;
    adapterKey: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    errorCode: string | null;
    pageCount: number;
    createdAt: string;
    finishedAt: string | null;
  }[];
};
type Diagnostics = {
  organization: { id: string; name: string };
  grant: { id: string; expiresAt: string };
  transactionStatusBreakdown: { status: string; count: number }[];
  recentExportBatches: {
    id: string;
    taxFamily: string;
    taxPeriod: string;
    exportVersion: number;
    itemCount: number;
    exportedAt: string;
    latestOutcome: string | null;
  }[];
  recentFailedJobs: {
    id: string;
    status: string;
    errorCode: string | null;
    attemptCount: number;
    updatedAt: string;
  }[];
};
type Org = Payload["organizations"][number];

const th = "px-3 py-2.5 text-left font-semibold whitespace-nowrap";
const num = "px-3 py-2.5 text-right font-mono tabular-nums";

function Section({
  title,
  intro,
  actions,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-2">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function TableShell({
  children,
  footer,
  minWidth = "48rem",
}: {
  children: ReactNode;
  footer?: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-surface shadow-xs">
      <div className="scroll-thin max-h-[calc(100dvh-16rem)] overflow-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {footer}
    </div>
  );
}

function KpiCard({
  href,
  icon,
  tone,
  title,
  big,
  bigLabel,
  chips,
  openLabel,
}: {
  href: string;
  icon: ReactNode;
  tone: string;
  title: string;
  big: ReactNode;
  bigLabel: string;
  chips: ReactNode;
  openLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border bg-surface p-4 shadow-xs transition-colors hover:border-primary"
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tone,
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
        <ArrowRight
          aria-label={openLabel}
          className="ml-auto size-4 text-muted-foreground group-hover:text-primary"
        />
      </div>
      <p className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-bold",
            typeof big === "number"
              ? "font-mono text-2xl tabular-nums"
              : "text-lg",
          )}
        >
          {big}
        </span>
        <span className="text-xs text-muted-foreground">{bigLabel}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">{chips}</div>
    </Link>
  );
}

function useAdminOverview(locale: Locale) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({ orgPage: 1, jobPage: 1, jobStatus: "" });
  const load = useCallback(
    async (next: { orgPage: number; jobPage: number; jobStatus: string }) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          orgPage: String(next.orgPage),
          jobPage: String(next.jobPage),
          pageSize: String(LIST_PAGE_SIZE),
        });
        if (next.jobStatus) params.set("jobStatus", next.jobStatus);
        setData(await apiGet<Payload>(`/api/admin/overview?${params}`));
        setState(next);
      } catch (failure) {
        setError(formatFailure(failure, locale));
      } finally {
        setLoading(false);
      }
    },
    [locale],
  );
  useEffect(() => {
    void load({ orgPage: 1, jobPage: 1, jobStatus: "" });
  }, [load]);
  return { data, error, loading, state, load };
}

export function AdminOverviewView({
  locale,
  focusJobs = false,
}: {
  locale: Locale;
  focusJobs?: boolean;
}) {
  const t = adminMessages[locale];
  const v = viewMessages[locale];
  const labels = comboLabels(locale);
  const { data, error, loading, state, load } = useAdminOverview(locale);
  const [inspectOrg, setInspectOrg] = useState<Org | null>(null);
  const [reason, setReason] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [inspectError, setInspectError] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspect() {
    if (!inspectOrg?.activeSupportGrantId) return;
    setBusy(true);
    setInspectError("");
    try {
      setDiagnostics(
        await apiPost<Diagnostics>("/api/admin/support-access", {
          organizationId: inspectOrg.id,
          grantId: inspectOrg.activeSupportGrantId,
          reason: reason.trim(),
        }),
      );
    } catch (failure) {
      setInspectError(formatFailure(failure, locale));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <Skeleton className="h-64 w-full" />;
  if (!data)
    return (
      <Notice tone="danger" role="alert">
        {error}
      </Notice>
    );
  const h = data.platformHealth;
  const admin = `/${locale}/admin`;
  const date = (iso: string) => formatDate(new Date(iso), locale);

  const alerts = [
    h.ocrJobs.deadLetter > 0 && {
      tone: "danger" as const,
      text: fmt(t.alertDeadLetter, { n: h.ocrJobs.deadLetter }),
      href: `${admin}/jobs`,
    },
    h.billing.webhookRejected > 0 && {
      tone: "danger" as const,
      text: fmt(t.alertWebhookRejected, { n: h.billing.webhookRejected }),
      href: `${admin}/billing`,
    },
    h.taxRules.smeApproved === 0 && {
      tone: "warning" as const,
      text: t.alertNoSmeRules,
      href: `${admin}/tax-rules`,
    },
    !h.billing.saasLicensingApproved && {
      tone: "info" as const,
      text: t.alertSaasPending,
      href: `${admin}/billing`,
    },
  ].filter(Boolean) as {
    tone: "danger" | "warning" | "info";
    text: string;
    href: string;
  }[];

  const orgTotals = data.organizations.reduce(
    (acc, o) => ({
      members: acc.members + o.memberCount,
      companies: acc.companies + o.companyCount,
      transactions: acc.transactions + o.transactionCount,
      exports: acc.exports + o.exportBatchCount,
    }),
    { members: 0, companies: 0, transactions: 0, exports: 0 },
  );

  const jobsSection = (
    <Section
      title={focusJobs ? t.jobsList : t.jobsTitle}
      intro={focusJobs ? undefined : t.jobsIntro}
      actions={
        <div className="w-60">
          <Combobox
            aria-label={fieldInfo(locale, "admin.jobStatus").label}
            value={state.jobStatus || null}
            onChange={(value) =>
              void load({ ...state, jobPage: 1, jobStatus: value ?? "" })
            }
            options={codeOptions(locale, "ocrJobStatus")}
            labels={{ ...labels, placeholder: t.allStatuses }}
          />
        </div>
      }
    >
      {data.jobs.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-surface px-4 py-10 text-center text-sm text-muted-foreground">
          {t.noJobs}
        </p>
      ) : (
        <TableShell
          footer={
            <div className="flex justify-end border-t px-3 py-2">
              <Pager
                page={data.jobPagination.page}
                pageSize={data.jobPagination.pageSize}
                total={data.jobPagination.totalRows}
                onPage={(page) => void load({ ...state, jobPage: page })}
                v={v}
              />
            </div>
          }
        >
          <thead className="sticky top-0 bg-surface-2 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className={th}>{t.jobCreated}</th>
              <th className={th}>{t.workspace}</th>
              <th className={th}>{t.provider}</th>
              <th className={th}>{v.status}</th>
              <th className={`${th} text-right`}>{t.attempts}</th>
              <th className={`${th} text-right`}>{t.pages}</th>
              <th className={th}>{t.problem}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.jobs.map((job) => (
              <tr key={job.id}>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {date(job.createdAt)}
                </td>
                <td className="px-3 py-2.5 font-medium">
                  {job.organizationName ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <p>{job.providerSlug}</p>
                  <p className="text-xs text-muted-foreground">
                    {codeLabel(locale, "ocrAdapter", job.adapterKey)}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <CodeBadge domain="ocrJobStatus" code={job.status} />
                </td>
                <td className={num}>
                  {job.attemptCount}/{job.maxAttempts}
                </td>
                <td className={num}>{job.pageCount}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {job.errorCode
                    ? codeLabel(locale, "ocrError", job.errorCode)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
    </Section>
  );

  if (focusJobs)
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t.jobsTitle}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t.jobsIntro}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["QUEUED", h.ocrJobs.queued + h.ocrJobs.running],
              ["SUCCEEDED", h.ocrJobs.succeeded],
              ["FAILED_RETRYABLE", h.ocrJobs.failedRetryable],
              ["DEAD_LETTER", h.ocrJobs.deadLetter],
            ] as const
          ).map(([code, count]) => (
            <div
              key={code}
              className="rounded-xl border bg-surface p-4 shadow-xs"
            >
              <CodeBadge domain="ocrJobStatus" code={code} info={false} />
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums">
                {count}
              </p>
            </div>
          ))}
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        {jobsSection}
      </div>
    );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t.overviewTitle}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t.overviewIntro}
        </p>
      </div>
      <Notice tone="info">
        <span className="inline-flex items-start gap-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {t.privacyNote}
        </span>
      </Notice>
      {error && <Notice tone="danger">{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          href={`${admin}/tax-rules`}
          icon={<ClipboardCheck aria-hidden="true" className="size-4" />}
          tone="bg-success-soft text-success-fg"
          title={t.cardTaxRules}
          big={h.taxRules.smeApproved}
          bigLabel={t.cardTaxRulesBig}
          openLabel={t.open}
          chips={
            <>
              <Badge tone="amber">
                {t.test}: {h.taxRules.nonProductionTest}
              </Badge>
              <Badge tone="gray">
                {t.draft}: {h.taxRules.draft}
              </Badge>
            </>
          }
        />
        <KpiCard
          href={`${admin}/xml-templates`}
          icon={<Workflow aria-hidden="true" className="size-4" />}
          tone="bg-violet-soft text-violet-fg"
          title={t.cardTemplates}
          big={h.xmlTemplates.verified}
          bigLabel={t.cardTemplatesBig}
          openLabel={t.open}
          chips={
            <>
              <Badge tone="amber">
                {t.unverified}: {h.xmlTemplates.unverified}
              </Badge>
              <Badge tone="gray">
                {t.retired}: {h.xmlTemplates.retired}
              </Badge>
            </>
          }
        />
        <KpiCard
          href={`${admin}/ocr-providers`}
          icon={<ScanText aria-hidden="true" className="size-4" />}
          tone="bg-info-soft text-info-fg"
          title={t.cardOcr}
          big={h.ocrProviders.enabled}
          bigLabel={fmt(t.cardOcrBig, { total: h.ocrProviders.total })}
          openLabel={t.open}
          chips={
            <>
              <Badge tone="blue">
                {t.queued}: {h.ocrJobs.queued}
              </Badge>
              <Badge tone={h.ocrJobs.deadLetter ? "red" : "gray"}>
                {t.failed}: {h.ocrJobs.deadLetter}
              </Badge>
            </>
          }
        />
        <KpiCard
          href={`${admin}/billing`}
          icon={<CreditCard aria-hidden="true" className="size-4" />}
          tone="bg-warning-soft text-warning-fg"
          title={t.cardBilling}
          big={codeLabel(locale, "billingMode", h.billing.adapterMode)}
          bigLabel=""
          openLabel={t.open}
          chips={
            <>
              <Badge tone="green">
                {t.webhookValid}: {h.billing.webhookValid}
              </Badge>
              <Badge tone={h.billing.webhookRejected ? "red" : "gray"}>
                {t.webhookRejected}: {h.billing.webhookRejected}
              </Badge>
            </>
          }
        />
      </div>

      <Section title={t.attentionTitle}>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.allGood}</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li key={alert.text}>
                <Link
                  href={alert.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-surface-2",
                    alert.tone === "danger" &&
                      "border-danger/40 bg-danger-soft",
                    alert.tone === "warning" &&
                      "border-warning/40 bg-warning-soft",
                    alert.tone === "info" && "border-info/30 bg-info-soft",
                  )}
                >
                  <TriangleAlert
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  <span className="flex-1">{alert.text}</span>
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.workspacesTitle} intro={t.workspacesIntro}>
        <TableShell
          minWidth="60rem"
          footer={
            <div className="flex justify-end border-t px-3 py-2">
              <Pager
                page={data.orgPagination.page}
                pageSize={data.orgPagination.pageSize}
                total={data.orgPagination.totalRows}
                onPage={(page) => void load({ ...state, orgPage: page })}
                v={v}
              />
            </div>
          }
        >
          <thead className="sticky top-0 bg-surface-2 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className={th}>{t.workspace}</th>
              <th className={`${th} text-right`}>{t.members}</th>
              <th className={`${th} text-right`}>{t.companies}</th>
              <th className={`${th} text-right`}>{t.transactions}</th>
              <th className={`${th} text-right`}>{t.exports}</th>
              <th className={th}>{t.license}</th>
              <th className={th}>{t.support}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.organizations.map((org) => (
              <tr key={org.id}>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.created}: {date(org.createdAt)}
                  </p>
                </td>
                <td className={num}>{org.memberCount}</td>
                <td className={num}>{org.companyCount}</td>
                <td className={num}>{org.transactionCount}</td>
                <td className={num}>{org.exportBatchCount}</td>
                <td className="px-3 py-2.5">
                  <CodeBadge domain="licenseStatus" code={org.licenseStatus} />
                </td>
                <td className="px-3 py-2.5">
                  {org.activeSupportGrantId ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="amber" dot>
                        {fmt(t.supportUntil, {
                          date: org.activeSupportGrantExpiresAt
                            ? date(org.activeSupportGrantExpiresAt)
                            : "—",
                        })}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInspectOrg(org);
                          setDiagnostics(null);
                          setReason("");
                          setInspectError("");
                        }}
                      >
                        {t.inspect}
                      </Button>
                    </div>
                  ) : (
                    <Badge tone="gray">{t.noGrant}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 bg-surface-2">
            <tr className="border-t-2 border-border-strong font-bold">
              <td className="px-3 py-2.5">{t.total}</td>
              <td className={num}>{orgTotals.members}</td>
              <td className={num}>{orgTotals.companies}</td>
              <td className={num}>{orgTotals.transactions}</td>
              <td className={num}>{orgTotals.exports}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </TableShell>
      </Section>

      {jobsSection}

      <Dialog
        open={inspectOrg !== null}
        onClose={() => setInspectOrg(null)}
        title={inspectOrg ? fmt(t.inspectTitle, { name: inspectOrg.name }) : ""}
        closeLabel={v.cancel}
        footer={
          diagnostics ? (
            <Button variant="outline" onClick={() => setInspectOrg(null)}>
              {v.cancel}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setInspectOrg(null)}>
                {v.cancel}
              </Button>
              <Button
                disabled={busy || reason.trim().length < 5}
                onClick={() => void inspect()}
              >
                {t.inspectRun}
              </Button>
            </>
          )
        }
      >
        {!diagnostics ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t.inspectIntro}</p>
            {inspectError && <Notice tone="danger">{inspectError}</Notice>}
            <FormField field="admin.inspectReason" required>
              <TextInput
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
            </FormField>
          </div>
        ) : (
          <div className="space-y-5 text-sm">
            <div className="space-y-2">
              <h3 className="font-semibold">{t.statusBreakdown}</h3>
              {diagnostics.transactionStatusBreakdown.length === 0 ? (
                <p className="text-muted-foreground">{t.none}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {diagnostics.transactionStatusBreakdown.map((s) => (
                    <li
                      key={s.status}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1"
                    >
                      <CodeBadge
                        domain="transactionStatus"
                        code={s.status}
                        info={false}
                      />
                      <span className="font-mono font-bold">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t.recentExports}</h3>
              {diagnostics.recentExportBatches.length === 0 ? (
                <p className="text-muted-foreground">{t.none}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {diagnostics.recentExportBatches.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <span>
                        {codeLabel(locale, "taxFamily", b.taxFamily)} ·{" "}
                        <span className="font-mono">{b.taxPeriod}</span> · v
                        {b.exportVersion} · {b.itemCount}
                      </span>
                      <CodeBadge
                        domain="coretaxOutcome"
                        code={b.latestOutcome ?? "NONE"}
                        info={false}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">{t.recentFailures}</h3>
              {diagnostics.recentFailedJobs.length === 0 ? (
                <p className="text-muted-foreground">{t.none}</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {diagnostics.recentFailedJobs.map((j) => (
                    <li
                      key={j.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                    >
                      <CodeBadge
                        domain="ocrJobStatus"
                        code={j.status}
                        info={false}
                      />
                      <span className="text-xs text-muted-foreground">
                        {j.errorCode
                          ? codeLabel(locale, "ocrError", j.errorCode)
                          : "—"}{" "}
                        · {date(j.updatedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
