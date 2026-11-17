"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/messages";
import { billingMessages } from "@/i18n/billing";
import { siteMessages } from "@/i18n/site";
import { formatDate } from "@/i18n/format";
import type {
  BerlangganCatalogPlan,
  BillingAdapterMode,
  LicenseStatus,
} from "@/lib/billing/schemas";
import { can, type Role } from "@/server/workspaces/policy";
import { Button } from "@/components/ui/button";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Field, Submit } from "@/components/account/forms";
import {
  ApiFailure,
  apiGet,
  apiPost,
  formatFailure,
} from "@/components/intake/client";

type OrgBillingPayload = {
  role: Role;
  compatibilityGate: {
    adapterMode: BillingAdapterMode;
    saasLicensingApproved: boolean;
    compatibilityNote: string;
    storefrontUrl: string | null;
    catalogPlans: BerlangganCatalogPlan[];
  };
  trial: {
    activatedAt: string;
    expiresAt: string;
    usedTotal: number;
    maxTotal: number;
    maxPerJakartaDay: number;
  } | null;
  license: {
    licenseKeyHint: string | null;
    fingerprint: string;
    status: LicenseStatus;
    rawStatus: LicenseStatus;
    planCode: string | null;
    lastErrorCode: string | null;
    tokenExpiresAt: string | null;
    licenseExpiresAt: string | null;
    lastValidatedAt: string | null;
  } | null;
  entitlementSummary: {
    adapterMode: BillingAdapterMode;
    saasLicensingApproved: boolean;
    paidAccessEnabled: boolean;
    nonProductionTestActive: boolean;
    licenseStatus: LicenseStatus;
    planCode: string | null;
    entitlements: Record<string, string | number | boolean | null>;
    usage: {
      companiesCount: number;
      membersCount: number;
      monthTransactionsCount: number;
      monthXmlExportsCount: number;
    };
  };
};

export function OrgBillingView({ locale }: { locale: Locale }) {
  const t = billingMessages[locale];
  const site = siteMessages[locale];
  const [data, setData] = useState<OrgBillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [noWorkspace, setNoWorkspace] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

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
      const payload = await apiGet<OrgBillingPayload>("/api/billing");
      setData(payload);
      setNoWorkspace(false);
    } catch (error) {
      if (error instanceof ApiFailure && error.code === "NO_WORKSPACE") {
        setNoWorkspace(true);
      } else {
        setFeedback(formatErr(error));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onActivate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/billing", {
        action: "activate",
        licenseKey,
        ...(fingerprint.trim() ? { fingerprint: fingerprint.trim() } : {}),
      });
      setLicenseKey("");
      await load();
      setFeedback(t.savedOk);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "validate" | "deactivate") {
    setBusy(true);
    setFeedback("");
    try {
      await apiPost("/api/billing", { action });
      await load();
      setFeedback(t.savedOk);
    } catch (error) {
      setFeedback(formatErr(error));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-44 w-full" />;

  if (noWorkspace) {
    return (
      <div className="max-w-xl space-y-4 rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">{t.orgTitle}</h1>
        <p className="text-sm text-muted-foreground">{site.noActiveBody}</p>
        <Link href={`/${locale}/app/settings`} className="text-sm underline">
          {site.manageWorkspace}
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <p role="alert" className="max-w-xl rounded-lg border p-6 text-sm">
        {feedback || site.appError}
      </p>
    );
  }

  const canManage = can(data.role, "team.manage");
  const gate = data.compatibilityGate;
  const entEntries = Object.entries(data.entitlementSummary.entitlements);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.orgTitle}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t.orgIntro}</p>
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

      <section
        className="space-y-3 rounded-lg border p-6"
        data-billing-compatibility={
          gate.saasLicensingApproved ? "APPROVED" : "PENDING"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t.gateWarningTitle}</h2>
          <StatusBadge>{t.modes[gate.adapterMode]}</StatusBadge>
        </div>
        <p
          role="alert"
          className="rounded-md border bg-muted/30 p-3 text-xs leading-6"
        >
          {gate.adapterMode === "BERLANGGAN_LIVE" && gate.saasLicensingApproved
            ? t.gateLiveBanner
            : gate.adapterMode === "SYNTHETIC_TEST"
              ? t.gateSyntheticBanner
              : t.gateBlockedBanner}
        </p>
        {gate.compatibilityNote && (
          <p className="text-xs text-muted-foreground">
            {gate.compatibilityNote}
          </p>
        )}
        {gate.storefrontUrl ? (
          <a
            href={gate.storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-medium underline"
          >
            {t.storefrontLinkLabel}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t.noStorefrontNotice}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-6 text-sm">
        <h2 className="text-lg font-semibold">{t.trialSectionTitle}</h2>
        <p className="text-xs leading-6 text-muted-foreground">
          {t.trialSummary}
        </p>
        {data.trial && (
          <p className="font-mono text-xs">
            used={data.trial.usedTotal}/{data.trial.maxTotal} · expires=
            {formatDate(new Date(data.trial.expiresAt), locale)}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border p-6 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t.licenseSectionTitle}</h2>
          <StatusBadge>
            {t.statuses[data.entitlementSummary.licenseStatus]}
          </StatusBadge>
        </div>

        {data.license && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <strong>Hint:</strong>{" "}
              <span className="font-mono">
                {data.license.licenseKeyHint ?? "-"}
              </span>
            </div>
            <div>
              <strong>Plan:</strong>{" "}
              <span className="font-mono">{data.license.planCode ?? "-"}</span>
            </div>
            <div>
              <strong>Fingerprint:</strong>{" "}
              <span className="font-mono">{data.license.fingerprint}</span>
            </div>
            <div>
              <strong>Last validated:</strong>{" "}
              {data.license.lastValidatedAt
                ? formatDate(new Date(data.license.lastValidatedAt), locale)
                : "-"}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">{t.entitlementsTitle}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              {t.usageLabels.companies}:{" "}
              <strong className="font-mono">
                {data.entitlementSummary.usage.companiesCount}
              </strong>
            </div>
            <div>
              {t.usageLabels.members}:{" "}
              <strong className="font-mono">
                {data.entitlementSummary.usage.membersCount}
              </strong>
            </div>
            <div>
              {t.usageLabels.monthTransactions}:{" "}
              <strong className="font-mono">
                {data.entitlementSummary.usage.monthTransactionsCount}
              </strong>
            </div>
            <div>
              {t.usageLabels.monthExports}:{" "}
              <strong className="font-mono">
                {data.entitlementSummary.usage.monthXmlExportsCount}
              </strong>
            </div>
          </div>

          {entEntries.length === 0 ? (
            <p className="text-muted-foreground">{t.noEntitlements}</p>
          ) : (
            <ul className="space-y-1 font-mono">
              {entEntries.map(([key, val]) => (
                <li key={key}>
                  {key}: {String(val)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border p-6">
        <h2 className="text-lg font-semibold">{t.activateTitle}</h2>
        {!canManage ? (
          <p role="alert" className="text-xs text-muted-foreground">
            {t.ownerOnlyNotice}
          </p>
        ) : (
          <form onSubmit={onActivate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={t.licenseKeyLabel}
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
              />
              <Field
                label={t.fingerprintLabel}
                value={fingerprint}
                onChange={(e) => setFingerprint(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Submit busy={busy}>{t.activateButton}</Submit>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !data.license}
                onClick={() => void runAction("validate")}
              >
                {t.validateButton}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !data.license}
                onClick={() => void runAction("deactivate")}
              >
                {t.deactivateButton}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
