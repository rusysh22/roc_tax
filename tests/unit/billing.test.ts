import { describe, expect, it } from "vitest";
import { billingMessages } from "../../apps/web/src/i18n/billing";
import { canonicalizeJson } from "../../apps/web/src/lib/billing/canonical";
import { adminBillingCommandSchema } from "../../apps/web/src/lib/billing/schemas";
import {
  createTestEd25519KeyPair,
  signCanonicalEntitlement,
  signWebhookHmac,
  verifyBerlangganEd25519,
  verifyBerlangganWebhookHmac,
} from "../../apps/web/src/server/billing/crypto";

describe("Berlanggan billing canonical JSON, Ed25519 & HMAC cryptography", () => {
  it("produces deterministic Canonical JSON matching Berlanggan specification", () => {
    const input = {
      z_flag: true,
      nested: { b: 2, a: "Pajak Kepatuhan — €100" },
      list: [3, { y: "y", x: "x" }, -0],
      a_num: 10,
      omit: undefined,
    };
    expect(canonicalizeJson(input)).toBe(
      '{"a_num":10,"list":[3,{"x":"x","y":"y"},0],"nested":{"a":"Pajak Kepatuhan — €100","b":2},"z_flag":true}',
    );
    expect(() => canonicalizeJson({ bad: Number.NaN })).toThrow(
      "CANONICAL_JSON_NON_FINITE_NUMBER",
    );
  });

  it("verifies Ed25519 entitlement signatures cleanly and rejects tampered or malformed inputs", () => {
    const pair = createTestEd25519KeyPair();
    const entitlement = {
      status: "active",
      plan_code: "PRO-ANNUAL",
      entitlements: { MAX_COMPANIES: 5, ALLOW_EXTERNAL_OCR: false },
    };
    const sig = signCanonicalEntitlement(entitlement, pair.privateKeyPem);

    expect(verifyBerlangganEd25519(entitlement, sig, pair.publicKeyPem)).toBe(
      true,
    );
    expect(
      verifyBerlangganEd25519(
        { ...entitlement, entitlements: { MAX_COMPANIES: 999 } },
        sig,
        pair.publicKeyPem,
      ),
    ).toBe(false);
    expect(
      verifyBerlangganEd25519(
        entitlement,
        sig,
        createTestEd25519KeyPair().publicKeyPem,
      ),
    ).toBe(false);
    expect(
      verifyBerlangganEd25519(entitlement, "bad-sig", pair.publicKeyPem),
    ).toBe(false);
  });

  it("verifies raw-body webhook HMAC-SHA256 and rejects tampered bodies", () => {
    const secret = "synthetic-webhook-secret-key-0123456789";
    const rawBody = Buffer.from(
      '{"event_id":"evt_1","event_type":"license.issued"}',
      "utf8",
    );
    const sig = signWebhookHmac(rawBody, secret);

    expect(verifyBerlangganWebhookHmac(rawBody, sig, secret)).toBe(true);
    expect(
      verifyBerlangganWebhookHmac(rawBody, sig.replace(/^sha256=/, ""), secret),
    ).toBe(true);
    expect(
      verifyBerlangganWebhookHmac(
        Buffer.from('{"event_id":"evt_2","event_type":"license.issued"}'),
        sig,
        secret,
      ),
    ).toBe(false);
    expect(verifyBerlangganWebhookHmac(rawBody, sig, "wrong-secret")).toBe(
      false,
    );
    expect(verifyBerlangganWebhookHmac(rawBody, undefined, secret)).toBe(false);
  });

  it("enforces SSRF URL & server-only secretRef rules and aligns bilingual billing messages", () => {
    expect(
      adminBillingCommandSchema.safeParse({
        action: "configure",
        adapterMode: "BERLANGGAN_LIVE",
        apiBaseUrl: "http://127.0.0.1:8080",
        saasLicensingApproved: false,
      }).success,
    ).toBe(false);
    expect(
      adminBillingCommandSchema.safeParse({
        action: "configure",
        adapterMode: "BERLANGGAN_LIVE",
        apiBaseUrl: "https://berlanggan.web.id",
        productSlug: "serentax",
        productSecretRef: "invalid_lowercase",
        saasLicensingApproved: false,
      }).success,
    ).toBe(false);
    expect(Object.keys(billingMessages.id).sort()).toEqual(
      Object.keys(billingMessages.en).sort(),
    );
    expect(Object.keys(billingMessages.id.statuses).sort()).toEqual(
      Object.keys(billingMessages.en.statuses).sort(),
    );
    expect(Object.keys(billingMessages.id.errors).sort()).toEqual(
      Object.keys(billingMessages.en.errors).sort(),
    );
  });
});
