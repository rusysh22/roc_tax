import type { PrismaClient } from "../../generated/prisma/client";
import type { BerlangganCatalogPlan } from "../../lib/billing/schemas";

export type PublicCatalog = {
  state:
    "NOT_CONFIGURED" | "PENDING_VERIFICATION" | "AVAILABLE" | "UNAVAILABLE";
  plans: BerlangganCatalogPlan[];
  checkoutUrl: string | null;
};

/**
 * Pure database reader for the public pricing catalog. Fails closed to
 * `NOT_CONFIGURED` until `adapterMode === "BERLANGGAN_LIVE"`,
 * `saasLicensingApproved === true`, a verified external `storefrontUrl`, and a
 * fetched catalog snapshot exist. Never invents plans, prices, or checkout URLs.
 */
export async function readPublicCatalog(
  db: PrismaClient,
): Promise<PublicCatalog> {
  try {
    const config = await db.billingConfig.findUnique({
      where: { id: "default" },
    });
    if (
      !config ||
      config.adapterMode !== "BERLANGGAN_LIVE" ||
      !config.saasLicensingApproved ||
      !config.storefrontUrl ||
      !Array.isArray(config.catalogSnapshot)
    ) {
      return { state: "NOT_CONFIGURED", plans: [], checkoutUrl: null };
    }
    return {
      state: "AVAILABLE",
      plans: config.catalogSnapshot as BerlangganCatalogPlan[],
      checkoutUrl: config.storefrontUrl,
    };
  } catch {
    return { state: "UNAVAILABLE", plans: [], checkoutUrl: null };
  }
}
