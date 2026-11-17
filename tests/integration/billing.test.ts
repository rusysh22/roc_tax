import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { postgresOptions } from "../../apps/web/src/server/postgres";
import { PrismaClient } from "../../apps/web/src/generated/prisma/client";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import {
  createTestEd25519KeyPair,
  signCanonicalEntitlement,
  signWebhookHmac,
} from "../../apps/web/src/server/billing/crypto";
import { billingService } from "../../apps/web/src/server/billing/service";
import { readPublicCatalog } from "../../apps/web/src/server/billing/public-catalog";
import type { Role } from "../../apps/web/src/server/workspaces/policy";

const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test")) {
  throw new Error("Isolated _test database required");
}
const db = new PrismaClient({
  adapter: new PrismaPg({ ...postgresOptions(url), max: 15 }),
});
const crypto = createTaxCrypto(
  "synthetic-billing-integration-secret-0123456789",
);

const users: string[] = [];
const orgs: string[] = [];
const webhookEventIds: string[] = [];

async function createActor(
  role: Role = "OWNER",
  platformRole: "NONE" | "SUPERADMIN" = "NONE",
) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic Billing ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
      platformRole,
    },
  });
  const org = await db.organization.create({
    data: {
      name: "Synthetic Billing Org",
      legalName: "PT Synthetic Billing",
      memberships: { create: { userId, role } },
    },
  });
  orgs.push(org.id);
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: org.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { userId, sessionId, organizationId: org.id };
}

async function addMember(organizationId: string, role: Role) {
  const userId = randomUUID();
  users.push(userId);
  await db.user.create({
    data: {
      id: userId,
      name: `Synthetic ${role}`,
      email: `${userId}@example.test`,
      emailVerified: true,
    },
  });
  await db.membership.create({
    data: { organizationId, userId, role },
  });
  const sessionId = randomUUID();
  await db.session.create({
    data: {
      id: sessionId,
      token: randomUUID(),
      userId,
      activeOrganizationId: organizationId,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  return { userId, sessionId };
}

afterAll(async () => {
  await db.billingConfig.updateMany({
    where: { id: "default" },
    data: {
      adapterMode: "NOT_CONFIGURED",
      apiBaseUrl: null,
      productSlug: null,
      storefrontUrl: null,
      productSecretRef: null,
      webhookSecretRef: null,
      ed25519PublicKey: null,
      saasLicensingApproved: false,
      catalogSnapshot: null as unknown as undefined,
      catalogFetchedAt: null,
    },
  });
  await db.organization.deleteMany({ where: { id: { in: orgs } } });
  if (webhookEventIds.length > 0) {
    await db.billingWebhookEvent.deleteMany({
      where: { eventId: { in: webhookEventIds } },
    });
  }
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

describe("Berlanggan billing adapter, compatibility gate & webhooks on PostgreSQL", () => {
  it("fails closed when NOT_CONFIGURED or when SaaS multi-tenant licensing is unapproved", async () => {
    const owner = await createActor("OWNER");
    const preparer = await addMember(owner.organizationId, "PREPARER");
    const admin = await createActor("OWNER", "SUPERADMIN");

    const svc = billingService(db, crypto);

    await expect(svc.listAdminBilling(owner.sessionId)).rejects.toThrow(
      "FORBIDDEN",
    );
    await expect(
      svc.executeOrgBillingCommand(owner.sessionId, {
        action: "activate",
        licenseKey: "SYNTH-KEY-0001",
      }),
    ).rejects.toThrow("BILLING_NOT_CONFIGURED");
    await expect(
      svc.executeOrgBillingCommand(preparer.sessionId, {
        action: "activate",
        licenseKey: "SYNTH-KEY-0001",
      }),
    ).rejects.toThrow("FORBIDDEN");

    await svc.mutateAdminBilling(admin.sessionId, {
      action: "configure",
      adapterMode: "BERLANGGAN_LIVE",
      apiBaseUrl: "https://berlanggan.web.id",
      productSlug: "serentax-synthetic",
      storefrontUrl: "https://berlanggan.web.id/p/serentax-synthetic",
      saasLicensingApproved: false,
      compatibilityNote: "Waiting vendor confirmation",
    });

    await expect(
      svc.executeOrgBillingCommand(owner.sessionId, {
        action: "activate",
        licenseKey: "SYNTH-KEY-0001",
      }),
    ).rejects.toThrow("SAAS_LICENSING_UNAPPROVED");

    const cat = await readPublicCatalog(db);
    expect(cat.state).toBe("NOT_CONFIGURED");
    expect(cat.checkoutUrl).toBeNull();
  });

  it("verifies catalog retrieval, Ed25519 Canonical JSON activation, negative statuses, webhook HMAC & replay", async () => {
    const owner = await createActor("OWNER");
    const admin = await createActor("OWNER", "SUPERADMIN");
    const keyPair = createTestEd25519KeyPair();
    const webhookSecret = "synthetic-berlanggan-hmac-secret-0123456789";

    const mockPlans = [
      {
        slug: "synth-team",
        name: "Synthetic Team",
        price: 199000,
        currency: "IDR",
        interval: "monthly",
        seat_limit: 5,
        entitlements: { MAX_COMPANIES: 3, ALLOW_EXTERNAL_OCR: false },
      },
    ];

    let providerNextStatus: string = "active";
    let tamperSignature = false;

    const fakeFetch: typeof fetch = async (input) => {
      const target = String(input);
      if (target.endsWith("/v1/catalog/products/serentax-synthetic/plans")) {
        return new Response(JSON.stringify({ plans: mockPlans }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (target.endsWith("/v1/activate") || target.endsWith("/v1/validate")) {
        const exp = new Date(Date.now() + 86400000).toISOString();
        const envelope = {
          status: providerNextStatus,
          plan_code: "synth-team",
          license_expires_at: exp,
          entitlements: { MAX_COMPANIES: 3, ALLOW_EXTERNAL_OCR: false },
        };
        const sig = signCanonicalEntitlement(envelope, keyPair.privateKeyPem);
        return new Response(
          JSON.stringify({
            status: providerNextStatus,
            plan_code: "synth-team",
            token: "signed-token",
            token_expires_at: exp,
            license_expires_at: exp,
            entitlements: envelope.entitlements,
            entitlement: envelope,
            entitlement_signature: tamperSignature
              ? Buffer.from("bad-signature-64-bytes-".padEnd(64, "0")).toString(
                  "base64",
                )
              : sig,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (target.endsWith("/v1/deactivate")) {
        return new Response(JSON.stringify({ status: "revoked" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };

    const svc = billingService(db, crypto, {
      env: {
        ...process.env,
        TEST_BERLANGGAN_PRODUCT_SECRET: "prod-sec-synthetic",
        TEST_BERLANGGAN_WEBHOOK_SECRET: webhookSecret,
      },
      fetchImpl: fakeFetch,
    });

    await svc.mutateAdminBilling(admin.sessionId, {
      action: "configure",
      adapterMode: "BERLANGGAN_LIVE",
      apiBaseUrl: "https://berlanggan.web.id",
      productSlug: "serentax-synthetic",
      storefrontUrl: "https://berlanggan.web.id/p/serentax-synthetic",
      productSecretRef: "TEST_BERLANGGAN_PRODUCT_SECRET",
      webhookSecretRef: "TEST_BERLANGGAN_WEBHOOK_SECRET",
      ed25519PublicKey: keyPair.publicKeyPem,
      saasLicensingApproved: true,
      compatibilityNote: "Synthetic integration test approval simulation",
    });

    const catRes = (await svc.mutateAdminBilling(admin.sessionId, {
      action: "fetch_catalog",
    })) as { plansCount: number };
    expect(catRes.plansCount).toBe(1);

    // Tampered Ed25519 signature must fail closed & not grant access.
    tamperSignature = true;
    await expect(
      svc.executeOrgBillingCommand(owner.sessionId, {
        action: "activate",
        licenseKey: "LIVE-KEY-TAMPER-1",
      }),
    ).rejects.toThrow("ENTITLEMENT_SIGNATURE_INVALID");
    const invalidState = await svc.getOrgBillingState(owner.sessionId);
    expect(invalidState.entitlementSummary.paidAccessEnabled).toBe(false);
    expect(invalidState.entitlementSummary.licenseStatus).toBe("INVALID");

    // Genuine Ed25519 signature over Canonical JSON unlocks provider entitlements.
    tamperSignature = false;
    providerNextStatus = "active";
    const activeRes = await svc.executeOrgBillingCommand(owner.sessionId, {
      action: "activate",
      licenseKey: "LIVE-KEY-VALID-1",
    });
    expect(activeRes.status).toBe("ACTIVE");
    const activeState = await svc.getOrgBillingState(owner.sessionId);
    expect(activeState.entitlementSummary.paidAccessEnabled).toBe(true);
    expect(activeState.entitlementSummary.entitlements).toEqual({
      MAX_COMPANIES: 3,
      ALLOW_EXTERNAL_OCR: false,
    });

    // All non-active statuses (seat_full, rate_limited, expired, revoked) fail closed.
    for (const [apiStatus, expected] of [
      ["seat_full", "SEAT_FULL"],
      ["rate_limited", "RATE_LIMITED"],
      ["expired", "EXPIRED"],
      ["grace", "GRACE"],
    ] as const) {
      providerNextStatus = apiStatus;
      const res = await svc.executeOrgBillingCommand(owner.sessionId, {
        action: "validate",
      });
      expect(res.status).toBe(expected);
      const st = await svc.getOrgBillingState(owner.sessionId);
      expect(st.entitlementSummary.paidAccessEnabled).toBe(
        expected === "GRACE",
      );
    }

    // Webhook HMAC negative check + license.suspended + idempotent replay + immutability.
    const evtId = `evt_${randomUUID()}`;
    webhookEventIds.push(evtId);
    const hookRaw = Buffer.from(
      JSON.stringify({
        event_id: evtId,
        event_type: "license.suspended",
        license_key: "LIVE-KEY-VALID-1",
      }),
      "utf8",
    );
    await expect(
      svc.receiveWebhook(hookRaw, "sha256=" + "f".repeat(64)),
    ).rejects.toThrow("INVALID_WEBHOOK_SIGNATURE");

    const validHmac = signWebhookHmac(hookRaw, webhookSecret);
    const firstHook = await svc.receiveWebhook(hookRaw, validHmac);
    expect(firstHook.replay).toBe(false);
    expect(firstHook.status).toBe("PROCESSED");

    const afterSuspend = await svc.getOrgBillingState(owner.sessionId);
    expect(afterSuspend.entitlementSummary.licenseStatus).toBe("SUSPENDED");
    expect(afterSuspend.entitlementSummary.paidAccessEnabled).toBe(false);

    const replayHook = await svc.receiveWebhook(hookRaw, validHmac);
    expect(replayHook.replay).toBe(true);

    // Immutability trigger blocks updates on BillingWebhookEvent.
    await expect(
      db.$executeRaw`UPDATE "BillingWebhookEvent" SET status = 'TAMPERED' WHERE "eventId" = ${evtId}`,
    ).rejects.toThrow();

    // Test license.renewed triggers live validation refresh and restores ACTIVE.
    providerNextStatus = "active";
    const renewId = `evt_${randomUUID()}`;
    webhookEventIds.push(renewId);
    const renewRaw = Buffer.from(
      JSON.stringify({
        event_id: renewId,
        event_type: "license.renewed",
        license_key: "LIVE-KEY-VALID-1",
      }),
      "utf8",
    );
    await svc.receiveWebhook(
      renewRaw,
      signWebhookHmac(renewRaw, webhookSecret),
    );
    const afterRenew = await svc.getOrgBillingState(owner.sessionId);
    expect(afterRenew.entitlementSummary.licenseStatus).toBe("ACTIVE");
    expect(afterRenew.entitlementSummary.paidAccessEnabled).toBe(true);
  });
});
