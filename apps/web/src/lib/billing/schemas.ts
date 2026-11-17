import { z } from "zod";
import { isSafeHttpsEndpointUrl, isValidSecretRefName } from "../intake/ocr";

export const billingAdapterModes = [
  "NOT_CONFIGURED",
  "SYNTHETIC_TEST",
  "BERLANGGAN_LIVE",
] as const;
export type BillingAdapterMode = (typeof billingAdapterModes)[number];

export const berlangganApiStatuses = [
  "active",
  "grace",
  "expired",
  "suspended",
  "revoked",
  "invalid",
  "seat_full",
  "rate_limited",
] as const;
export type BerlangganApiStatus = (typeof berlangganApiStatuses)[number];

export const licenseStatuses = [
  "NOT_CONFIGURED",
  "ACTIVE",
  "GRACE",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED",
  "INVALID",
  "SEAT_FULL",
  "RATE_LIMITED",
  "COMPATIBILITY_BLOCKED",
] as const;
export type LicenseStatus = (typeof licenseStatuses)[number];

export function mapApiStatusToLicenseStatus(
  status: BerlangganApiStatus,
): LicenseStatus {
  return status.toUpperCase() as LicenseStatus;
}

export const berlangganEntitlementMapSchema = z.record(
  z.string().min(1).max(64),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

export const berlangganPlanSchema = z
  .object({
    slug: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    price: z.union([z.number().nonnegative(), z.string().trim().min(1)]),
    currency: z.string().trim().min(3).max(10),
    interval: z.string().trim().min(1).max(32),
    seat_limit: z.number().int().positive().nullable().optional(),
    entitlements: berlangganEntitlementMapSchema.default({}),
  })
  .passthrough();
export type BerlangganCatalogPlan = z.infer<typeof berlangganPlanSchema>;

export const berlangganCatalogResponseSchema = z.union([
  z.object({ plans: z.array(berlangganPlanSchema) }).passthrough(),
  z.object({ data: z.array(berlangganPlanSchema) }).passthrough(),
  z.array(berlangganPlanSchema),
]);

export const berlangganActivationResponseSchema = z
  .object({
    status: z.enum(berlangganApiStatuses),
    token: z.string().min(1).max(4096).nullable().optional(),
    plan_code: z.string().trim().max(80).nullable().optional(),
    token_expires_at: z.string().datetime().nullable().optional(),
    license_expires_at: z.string().datetime().nullable().optional(),
    grace_days: z.number().int().min(0).max(365).nullable().optional(),
    entitlements: berlangganEntitlementMapSchema.optional(),
    entitlement: z.record(z.string(), z.unknown()).nullable().optional(),
    entitlement_signature: z.string().min(1).max(1024).nullable().optional(),
  })
  .passthrough();
export type BerlangganActivationResponse = z.infer<
  typeof berlangganActivationResponseSchema
>;

export const berlangganWebhookPayloadSchema = z
  .object({
    event_id: z.string().trim().min(1).max(120),
    event_type: z.enum([
      "license.issued",
      "license.renewed",
      "license.suspended",
    ]),
    occurred_at: z.string().datetime().optional(),
    license_key: z.string().trim().min(4).max(256).optional(),
    plan_code: z.string().trim().max(80).optional(),
    status: z.enum(berlangganApiStatuses).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type BerlangganWebhookPayload = z.infer<
  typeof berlangganWebhookPayloadSchema
>;

export const adminBillingCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("configure"),
      adapterMode: z.enum(billingAdapterModes),
      apiBaseUrl: z
        .string()
        .trim()
        .max(300)
        .nullable()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => !v || isSafeHttpsEndpointUrl(v), {
          message: "INVALID_ENDPOINT_URL",
        }),
      productSlug: z
        .string()
        .trim()
        .max(80)
        .nullable()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => !v || /^[a-z0-9][a-z0-9-]{1,78}$/.test(v), {
          message: "INVALID_PRODUCT_SLUG",
        }),
      storefrontUrl: z
        .string()
        .trim()
        .max(300)
        .nullable()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => !v || isSafeHttpsEndpointUrl(v), {
          message: "INVALID_STOREFRONT_URL",
        }),
      productSecretRef: z
        .string()
        .trim()
        .max(64)
        .nullable()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => !v || isValidSecretRefName(v), {
          message: "INVALID_SECRET_REF",
        }),
      webhookSecretRef: z
        .string()
        .trim()
        .max(64)
        .nullable()
        .optional()
        .transform((v) => (v ? v : null))
        .refine((v) => !v || isValidSecretRefName(v), {
          message: "INVALID_SECRET_REF",
        }),
      ed25519PublicKey: z
        .string()
        .trim()
        .max(2048)
        .nullable()
        .optional()
        .transform((v) => (v ? v : null)),
      saasLicensingApproved: z.boolean().default(false),
      compatibilityNote: z.string().trim().max(500).default(""),
    })
    .strict(),
  z.object({ action: z.literal("fetch_catalog") }).strict(),
]);
export type AdminBillingCommand = z.infer<typeof adminBillingCommandSchema>;

export const orgBillingCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("activate"),
      licenseKey: z.string().trim().min(6).max(256),
      fingerprint: z
        .string()
        .trim()
        .min(6)
        .max(128)
        .regex(/^[A-Za-z0-9._:-]+$/)
        .optional(),
    })
    .strict(),
  z.object({ action: z.literal("validate") }).strict(),
  z.object({ action: z.literal("deactivate") }).strict(),
]);
export type OrgBillingCommand = z.infer<typeof orgBillingCommandSchema>;

/**
 * Central paid-entitlement key definitions. Actual limits/flags MUST be read
 * solely from verified Berlanggan entitlements, never hardcoded as defaults.
 */
export const paidEntitlementKeys = [
  "MAX_COMPANIES",
  "MAX_MEMBERS",
  "MONTHLY_TRANSACTIONS",
  "MONTHLY_XML_EXPORTS",
  "ALLOW_EXTERNAL_OCR",
] as const;
export type PaidEntitlementKey = (typeof paidEntitlementKeys)[number];
