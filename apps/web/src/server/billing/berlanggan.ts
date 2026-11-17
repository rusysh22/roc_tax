import {
  berlangganActivationResponseSchema,
  berlangganCatalogResponseSchema,
  type BerlangganActivationResponse,
  type BerlangganCatalogPlan,
} from "../../lib/billing/schemas";
import { signCanonicalEntitlement } from "./crypto";

export class BillingProviderError extends Error {
  constructor(
    public code:
      | "BILLING_NOT_CONFIGURED"
      | "PROVIDER_UNAVAILABLE"
      | "INVALID_PROVIDER_RESPONSE"
      | "PROVIDER_SECRET_MISSING",
  ) {
    super(code);
  }
}

export type BillingProviderAdapter = {
  fetchCatalogPlans(slug: string): Promise<BerlangganCatalogPlan[]>;
  activate(input: {
    licenseKey: string;
    fingerprint: string;
  }): Promise<BerlangganActivationResponse>;
  validate(input: {
    licenseKey: string;
    fingerprint: string;
  }): Promise<BerlangganActivationResponse>;
  deactivate(input: {
    licenseKey: string;
    fingerprint: string;
  }): Promise<BerlangganActivationResponse>;
  operationAuthorize(input: {
    licenseKey: string;
    fingerprint: string;
    operation: string;
  }): Promise<BerlangganActivationResponse>;
};

export function createBerlangganHttpAdapter(config: {
  apiBaseUrl: string;
  productSecret?: string | null;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): BillingProviderAdapter {
  const baseUrl = config.apiBaseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? 10000;
  const fetcher = config.fetchImpl ?? fetch;

  async function requestJson(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };
      if (init.body !== undefined) {
        headers["Content-Type"] = "application/json";
      }
      if (config.productSecret) {
        headers["X-Berlanggan-Secret"] = config.productSecret;
      }

      const response = await fetcher(`${baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new BillingProviderError("PROVIDER_UNAVAILABLE");
      }
      return await response.json();
    } catch (error) {
      if (error instanceof BillingProviderError) throw error;
      throw new BillingProviderError("PROVIDER_UNAVAILABLE");
    } finally {
      clearTimeout(timer);
    }
  }

  async function postActivation(path: string, body: unknown) {
    const raw = await requestJson(path, { method: "POST", body });
    const parsed = berlangganActivationResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BillingProviderError("INVALID_PROVIDER_RESPONSE");
    }
    return parsed.data;
  }

  return {
    async fetchCatalogPlans(slug) {
      const raw = await requestJson(
        `/v1/catalog/products/${encodeURIComponent(slug)}/plans`,
        { method: "GET" },
      );
      const parsed = berlangganCatalogResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new BillingProviderError("INVALID_PROVIDER_RESPONSE");
      }
      if (Array.isArray(parsed.data)) return parsed.data;
      if ("plans" in parsed.data && Array.isArray(parsed.data.plans)) {
        return parsed.data.plans;
      }
      if ("data" in parsed.data && Array.isArray(parsed.data.data)) {
        return parsed.data.data;
      }
      return [];
    },
    activate({ licenseKey, fingerprint }) {
      return postActivation("/v1/activate", {
        license_key: licenseKey,
        fingerprint,
      });
    },
    validate({ licenseKey, fingerprint }) {
      return postActivation("/v1/validate", {
        license_key: licenseKey,
        fingerprint,
      });
    },
    deactivate({ licenseKey, fingerprint }) {
      return postActivation("/v1/deactivate", {
        license_key: licenseKey,
        fingerprint,
      });
    },
    operationAuthorize({ licenseKey, fingerprint, operation }) {
      return postActivation("/v1/operation-authorize", {
        license_key: licenseKey,
        fingerprint,
        operation,
      });
    },
  };
}

/**
 * Deterministic test-double adapter for `SYNTHETIC_TEST` mode only.
 * Simulates every documented Berlanggan response status by licenseKey prefix:
 *   SYNTH-GRACE-*       -> `grace`
 *   SYNTH-EXPIRED-*     -> `expired`
 *   SYNTH-SUSPENDED-*   -> `suspended`
 *   SYNTH-REVOKED-*     -> `revoked`
 *   SYNTH-SEATFULL-*    -> `seat_full`
 *   SYNTH-RATELIMIT-*   -> `rate_limited`
 *   SYNTH-BADSIG-*      -> `active` with invalid Ed25519 signature (negative test)
 *   SYNTH-ACTIVE-*      -> `active` with valid Ed25519 signature over Canonical JSON
 */
export function createSyntheticBillingAdapter(
  privateKeyPem: string,
): BillingProviderAdapter {
  function evaluateKey(
    licenseKey: string,
    fingerprint: string,
  ): BerlangganActivationResponse {
    const now = Date.now();
    const tokenExp = new Date(now + 86400_000).toISOString();
    const licenseExp = new Date(now + 30 * 86400_000).toISOString();

    const makeEnvelope = (status: "active" | "grace") => {
      const entitlements = {
        MAX_COMPANIES: 5,
        MAX_MEMBERS: 10,
        MONTHLY_TRANSACTIONS: 250,
        MONTHLY_XML_EXPORTS: 250,
        ALLOW_EXTERNAL_OCR: false,
      };
      const envelope = {
        status,
        plan_code: "SYNTH-TEST-PRO",
        license_expires_at: licenseExp,
        fingerprint,
        entitlements,
      };
      return {
        status,
        plan_code: "SYNTH-TEST-PRO",
        token: `synth-token-${fingerprint}`,
        token_expires_at: tokenExp,
        license_expires_at: licenseExp,
        grace_days: status === "grace" ? 7 : 0,
        entitlements,
        entitlement: envelope,
        entitlement_signature: licenseKey.startsWith("SYNTH-BADSIG-")
          ? Buffer.from("0".repeat(64)).toString("base64")
          : signCanonicalEntitlement(envelope, privateKeyPem),
      };
    };

    if (
      licenseKey.startsWith("SYNTH-ACTIVE-") ||
      licenseKey.startsWith("SYNTH-BADSIG-")
    ) {
      return makeEnvelope("active");
    }
    if (licenseKey.startsWith("SYNTH-GRACE-")) {
      return makeEnvelope("grace");
    }
    if (licenseKey.startsWith("SYNTH-EXPIRED-")) {
      return {
        status: "expired",
        license_expires_at: new Date(now - 86400_000).toISOString(),
      };
    }
    if (licenseKey.startsWith("SYNTH-SUSPENDED-")) {
      return { status: "suspended" };
    }
    if (licenseKey.startsWith("SYNTH-REVOKED-")) {
      return { status: "revoked" };
    }
    if (licenseKey.startsWith("SYNTH-SEATFULL-")) {
      return { status: "seat_full" };
    }
    if (licenseKey.startsWith("SYNTH-RATELIMIT-")) {
      return { status: "rate_limited" };
    }
    return { status: "invalid" };
  }

  return {
    async fetchCatalogPlans() {
      return [];
    },
    async activate({ licenseKey, fingerprint }) {
      return evaluateKey(licenseKey, fingerprint);
    },
    async validate({ licenseKey, fingerprint }) {
      return evaluateKey(licenseKey, fingerprint);
    },
    async deactivate() {
      return { status: "invalid" };
    },
    async operationAuthorize({ licenseKey, fingerprint }) {
      return evaluateKey(licenseKey, fingerprint);
    },
  };
}
