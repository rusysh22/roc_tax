import type { Prisma } from "../../generated/prisma/client";
import type { LicenseStatus } from "../../lib/billing/schemas";
import { verifyBerlangganEd25519 } from "./crypto";

type Tx = Prisma.TransactionClient;

export type ResolvedWorkspaceEntitlements = {
  adapterMode: "NOT_CONFIGURED" | "SYNTHETIC_TEST" | "BERLANGGAN_LIVE";
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

/**
 * Single centralized server-side paid-entitlement evaluator.
 * Reads limits strictly from verified provider entitlements (never hardcoded
 * paid quotas), enforces `saasLicensingApproved === true` + Ed25519 signature +
 * license expiry, and never weakens local 72h / 1-day / 3-total trial rules.
 */
export async function resolveWorkspaceEntitlements(
  tx: Tx,
  organizationId: string,
  now: Date,
): Promise<ResolvedWorkspaceEntitlements> {
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );

  const [
    config,
    license,
    companiesCount,
    membersCount,
    monthTransactionsCount,
    monthXmlExportsCount,
  ] = await Promise.all([
    tx.billingConfig.findUnique({ where: { id: "default" } }),
    tx.organizationLicense.findUnique({ where: { organizationId } }),
    tx.company.count({ where: { organizationId, archivedAt: null } }),
    tx.membership.count({ where: { organizationId } }),
    tx.transaction.count({
      where: {
        organizationId,
        createdAt: { gte: monthStart },
        status: { not: "VOIDED" },
      },
    }),
    tx.xmlExportBatch.count({
      where: { organizationId, exportedAt: { gte: monthStart } },
    }),
  ]);

  const adapterMode = config?.adapterMode ?? "NOT_CONFIGURED";
  const saasLicensingApproved = config?.saasLicensingApproved ?? false;
  const rawStatus: LicenseStatus = license?.status ?? "NOT_CONFIGURED";

  const hasValidStatus = rawStatus === "ACTIVE" || rawStatus === "GRACE";
  const notExpired =
    !license?.licenseExpiresAt ||
    license.licenseExpiresAt.getTime() > now.getTime() ||
    rawStatus === "GRACE";

  const signatureOk =
    Boolean(license?.entitlementEnvelope) &&
    Boolean(license?.entitlementSignature) &&
    Boolean(config?.ed25519PublicKey) &&
    verifyBerlangganEd25519(
      license?.entitlementEnvelope,
      license?.entitlementSignature,
      config?.ed25519PublicKey,
    );

  const nonProductionTestActive =
    adapterMode === "SYNTHETIC_TEST" &&
    hasValidStatus &&
    notExpired &&
    signatureOk;

  const paidAccessEnabled =
    adapterMode === "BERLANGGAN_LIVE" &&
    saasLicensingApproved &&
    hasValidStatus &&
    notExpired &&
    signatureOk;

  const readEntitlements =
    (paidAccessEnabled || nonProductionTestActive) && license?.entitlements
      ? (license.entitlements as Record<
          string,
          string | number | boolean | null
        >)
      : {};

  return {
    adapterMode,
    saasLicensingApproved,
    paidAccessEnabled,
    nonProductionTestActive,
    licenseStatus:
      adapterMode === "BERLANGGAN_LIVE" && !saasLicensingApproved && license
        ? "COMPATIBILITY_BLOCKED"
        : rawStatus,
    planCode:
      paidAccessEnabled || nonProductionTestActive
        ? (license?.planCode ?? null)
        : null,
    entitlements: readEntitlements,
    usage: {
      companiesCount,
      membersCount,
      monthTransactionsCount,
      monthXmlExportsCount,
    },
  };
}
