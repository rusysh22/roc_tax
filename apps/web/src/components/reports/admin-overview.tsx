"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { formatDate } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type AdminOverviewPayload = {
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
  orgPagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
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
  jobPagination: {
    page: number;
    pageSize: number;
    totalRows: number;
    totalPages: number;
  };
  jobs: {
    id: string;
    organizationId: string;
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

type InspectedDiagnostics = {
  privacyMode: "REDACTED_DIAGNOSTICS_ONLY";
  organization: { id: string; name: string; createdAt: string };
  grant: { id: string; expiresAt: string };
  transactionStatusBreakdown: { status: string; count: number }[];
  recentExportBatches: {
    id: string;
    taxFamily: string;
    taxPeriod: string;
    exportVersion: number;
    itemCount: number;
    xmlSha256Prefix: string;
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

export function AdminOverviewView({
  locale,
  focusJobs = false,
}: {
  locale: Locale;
  focusJobs?: boolean;
}) {
  const t = reportMessages[locale];
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orgPage, setOrgPage] = useState(1);
  const [jobPage, setJobPage] = useState(1);
  const [jobStatus, setJobStatus] = useState("");
  const [inspectReason, setInspectReason] = useState(
    "Customer support troubleshooting",
  );
  const [inspected, setInspected] = useState<InspectedDiagnostics | null>(null);

  async function load(
    nextOrgPage = orgPage,
    nextJobPage = jobPage,
    nextJobStatus = jobStatus,
  ) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        orgPage: String(nextOrgPage),
        jobPage: String(nextJobPage),
        pageSize: "10",
      });
      if (nextJobStatus) params.set("jobStatus", nextJobStatus);
      const payload = await apiGet<AdminOverviewPayload>(
        `/api/admin/overview?${params.toString()}`,
      );
      setData(payload);
      setOrgPage(payload.orgPagination.page);
      setJobPage(payload.jobPagination.page);
    } catch (err) {
      setError(
        err instanceof ApiFailure ? err.code : formatFailure(err, locale),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, 1, "");
  }, []);

  async function onInspect(
    organizationId: string,
    grantId: string,
    e?: FormEvent,
  ) {
    e?.preventDefault();
    setError("");
    try {
      const result = await apiPost<InspectedDiagnostics>(
        "/api/admin/support-access",
        {
          organizationId,
          grantId,
          reason: inspectReason.trim() || "Support diagnostics",
        },
      );
      setInspected(result);
    } catch (err) {
      setError(formatFailure(err, locale));
    }
  }

  if (loading && !data) return <Skeleton className="h-52 w-full" />;
  if (!data) {
    return (
      <p role="alert" className="max-w-xl rounded-lg border p-6 text-sm">
        {error}
      </p>
    );
  }

  const h = data.platformHealth;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {focusJobs ? t.adminJobsTitle : t.adminTitle}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          {t.adminIntro}
        </p>
        <p role="note" className="rounded-md border bg-muted/30 p-3 text-xs">
          {t.adminPrivacyBanner}
        </p>
      </div>

      <nav className="flex flex-wrap gap-3 text-xs">
        <Link
          href={`/${locale}/admin/tax-rules`}
          className="rounded-md border px-3 py-2 hover:bg-muted"
        >
          {t.adminLinks.taxRules}
        </Link>
        <Link
          href={`/${locale}/admin/xml-templates`}
          className="rounded-md border px-3 py-2 hover:bg-muted"
        >
          {t.adminLinks.xmlTemplates}
        </Link>
        <Link
          href={`/${locale}/admin/ocr-providers`}
          className="rounded-md border px-3 py-2 hover:bg-muted"
        >
          {t.adminLinks.ocrProviders}
        </Link>
        <Link
          href={`/${locale}/admin/billing`}
          className="rounded-md border px-3 py-2 hover:bg-muted"
        >
          {t.adminLinks.billing}
        </Link>
        <Link
          href={`/${locale}/admin/jobs`}
          className="rounded-md border px-3 py-2 hover:bg-muted"
        >
          {t.adminLinks.jobs}
        </Link>
      </nav>

      {error && (
        <p role="alert" className="rounded-md border p-3 text-sm">
          {error}
        </p>
      )}

      {!focusJobs && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-lg border p-4">
              <p className="font-semibold">{t.adminLinks.taxRules}</p>
              <p className="mt-2 font-mono text-muted-foreground">
                smeApproved={h.taxRules.smeApproved} · test=
                {h.taxRules.nonProductionTest} · draft={h.taxRules.draft}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">{t.adminLinks.xmlTemplates}</p>
              <p className="mt-2 font-mono text-muted-foreground">
                verified={h.xmlTemplates.verified} · unverified=
                {h.xmlTemplates.unverified}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">{t.adminLinks.ocrProviders}</p>
              <p className="mt-2 font-mono text-muted-foreground">
                enabled={h.ocrProviders.enabled}/{h.ocrProviders.total} ·
                deadLetter={h.ocrJobs.deadLetter}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-semibold">{t.adminLinks.billing}</p>
              <p className="mt-2 font-mono text-muted-foreground">
                {h.billing.adapterMode} · webhooks={h.billing.webhookValid}/
                {h.billing.webhookTotal}
              </p>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-semibold">{t.adminOrgsTitle}</h2>
              <div className="w-72">
                <Field
                  label={t.inspectReasonPlaceholder}
                  value={inspectReason}
                  onChange={(e) => setInspectReason(e.target.value)}
                />
              </div>
            </div>

            <div className="scroll-thin overflow-x-auto rounded-xl border bg-surface shadow-xs">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">{t.adminOrgsTitle}</caption>
                <thead className="border-b bg-surface-2 text-muted-foreground">
                  <tr>
                    <th scope="col" className="p-3 font-medium">
                      Org
                    </th>
                    <th scope="col" className="p-3 font-medium">
                      Counts (members/companies/tx/xml)
                    </th>
                    <th scope="col" className="p-3 font-medium">
                      License
                    </th>
                    <th scope="col" className="p-3 font-medium">
                      {t.inspectTitle}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.organizations.map((org) => (
                    <tr key={org.id} className="border-b">
                      <td className="p-3">
                        <div className="font-semibold">{org.name}</div>
                        <div className="font-mono text-muted-foreground">
                          {org.id}
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        {org.memberCount} / {org.companyCount} /{" "}
                        {org.transactionCount} / {org.exportBatchCount}
                      </td>
                      <td className="p-3">
                        <StatusBadge>{org.licenseStatus}</StatusBadge>
                      </td>
                      <td className="p-3">
                        {org.activeSupportGrantId ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              void onInspect(org.id, org.activeSupportGrantId!)
                            }
                          >
                            {t.inspectButton}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">
                            NO_ACTIVE_GRANT
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <nav
              aria-label={t.adminOrgsTitle}
              className="flex items-center justify-between text-xs"
            >
              <span>
                {data.orgPagination.page} / {data.orgPagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || data.orgPagination.page <= 1}
                  onClick={() =>
                    void load(data.orgPagination.page - 1, jobPage, jobStatus)
                  }
                >
                  {t.prevPage}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    loading ||
                    data.orgPagination.page >= data.orgPagination.totalPages
                  }
                  onClick={() =>
                    void load(data.orgPagination.page + 1, jobPage, jobStatus)
                  }
                >
                  {t.nextPage}
                </Button>
              </div>
            </nav>

            {inspected && (
              <div className="space-y-3 rounded-lg border p-5 text-xs">
                <div className="flex items-center justify-between">
                  <strong>
                    {inspected.organization.name} ({inspected.privacyMode})
                  </strong>
                  <StatusBadge>{inspected.grant.id}</StatusBadge>
                </div>
                <pre className="overflow-x-auto rounded bg-muted/40 p-3 font-mono">
                  {JSON.stringify(inspected, null, 2)}
                </pre>
              </div>
            )}
          </section>
        </>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t.adminJobsTitle}</h2>
          <select
            aria-label={t.adminJobsTitle}
            value={jobStatus}
            onChange={(e) => {
              const next = e.target.value;
              setJobStatus(next);
              void load(orgPage, 1, next);
            }}
            className="min-h-10 rounded-md border bg-background px-3 text-xs"
          >
            <option value="">ALL</option>
            {[
              "QUEUED",
              "RUNNING",
              "SUCCEEDED",
              "FAILED_RETRYABLE",
              "DEAD_LETTER",
              "CANCELLED",
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="scroll-thin overflow-x-auto rounded-xl border bg-surface shadow-xs">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{t.adminJobsTitle}</caption>
            <thead className="border-b bg-surface-2 text-muted-foreground">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  Job / Org
                </th>
                <th scope="col" className="p-3 font-medium">
                  Provider
                </th>
                <th scope="col" className="p-3 font-medium">
                  Status / Attempts
                </th>
                <th scope="col" className="p-3 font-medium">
                  Error / Created
                </th>
              </tr>
            </thead>
            <tbody>
              {data.jobs.map((job) => (
                <tr key={job.id} className="border-b font-mono">
                  <td className="p-3">
                    <div>{job.id}</div>
                    <div className="text-muted-foreground">
                      {job.organizationId}
                    </div>
                  </td>
                  <td className="p-3">
                    {job.providerSlug} ({job.adapterKey})
                  </td>
                  <td className="p-3">
                    <StatusBadge>{job.status}</StatusBadge> ({job.attemptCount}/
                    {job.maxAttempts})
                  </td>
                  <td className="p-3">
                    <div>{job.errorCode ?? "-"}</div>
                    <div className="text-muted-foreground">
                      {formatDate(new Date(job.createdAt), locale)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <nav
          aria-label={t.adminJobsTitle}
          className="flex items-center justify-between text-xs"
        >
          <span>
            {data.jobPagination.page} / {data.jobPagination.totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || data.jobPagination.page <= 1}
              onClick={() =>
                void load(orgPage, data.jobPagination.page - 1, jobStatus)
              }
            >
              {t.prevPage}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={
                loading ||
                data.jobPagination.page >= data.jobPagination.totalPages
              }
              onClick={() =>
                void load(orgPage, data.jobPagination.page + 1, jobStatus)
              }
            >
              {t.nextPage}
            </Button>
          </div>
        </nav>
      </section>
    </div>
  );
}
