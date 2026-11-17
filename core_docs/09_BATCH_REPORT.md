# Batch 09 — Berlanggan Subscription & Licensing (Compatibility Gate)

Date: 2026-11-17. Scope: Batch 09 only.

## Implemented

- **Canonical JSON & Cryptographic Trust (`apps/web/src/lib/billing/canonical.ts`, `apps/web/src/server/billing/crypto.ts`):** Implements Berlanggan's official Canonical JSON serialization (`sort_keys=True`, compact `,`/`:`, unescaped UTF-8) and verifies Ed25519 `entitlement_signature` values over canonical payloads alongside constant-time `timingSafeEqual` HMAC-SHA256 verification (`X-Berlanggan-Signature`) over exact raw webhook bytes.
- **Typed Berlanggan Adapter & Test Double (`apps/web/src/server/billing/berlanggan.ts`, `apps/web/src/lib/billing/schemas.ts`):** Implements `GET /v1/catalog/products/{slug}/plans`, `POST /v1/activate`, `/v1/validate`, `/v1/deactivate`, and `/v1/operation-authorize` with server-only `X-Berlanggan-Secret`, strict Zod response validation, handling of all 8 documented statuses (`active`, `grace`, `expired`, `suspended`, `revoked`, `invalid`, `seat_full`, `rate_limited`), plus an isolated `SYNTHETIC_TEST` test double that never grants production paid access.
- **Fail-Closed Compatibility Gate & Centralized Entitlements (`apps/web/src/server/billing/entitlements.ts`, `service.ts`, `catalog.ts`):** Defaults `BillingConfig` to `adapterMode = NOT_CONFIGURED` and `saasLicensingApproved = false`. Production live activations/checks fail closed (`BILLING_NOT_CONFIGURED` or `SAAS_LICENSING_UNAPPROVED`) until Berlanggan approves server-hosted multi-tenant SaaS licensing semantics. `/pricing` stays `NOT_CONFIGURED` with zero fabricated prices or checkout links; paid entitlements/limits are read solely from signed provider payloads; local account trials (`72h`, `1/Jakarta-day`, `3 total`) remain untouched.
- **Webhook Receiver, Superadmin Billing Config & Workspace Billing UI (`/api/webhooks/berlanggan`, `/[locale]/admin/billing`, `/[locale]/app/settings/billing`):** Receives `license.issued`, `license.renewed`, and `license.suspended` webhooks with raw-body HMAC verification, `eventId` idempotency, append-only `BillingWebhookEvent` logging, suspension enforcement, and `/v1/validate` refresh. Superadmin configures HTTPS SSRF-validated endpoints, verified `storefrontUrl`, server env secret refs, Ed25519 public key, and compatibility sign-off; workspace `OWNER`/`ADMIN` manage encrypted license activation/validation/deactivation.

## Database migrations

Yes: `202611160009_billing_berlanggan`.

Adds `BillingAdapterMode`, `LicenseStatus`, `BillingConfig` (seeded as `NOT_CONFIGURED`, `saasLicensingApproved = false`), `OrganizationLicense`, `BillingWebhookEvent`, and `BEFORE UPDATE` immutability trigger on `BillingWebhookEvent`.

## Security

- Direct live integration with `BERLANGGAN_LIVE` fails closed with `SAAS_LICENSING_UNAPPROVED` while `saasLicensingApproved === false`, preventing unapproved device-fingerprint seat misuse for multi-tenant SaaS access.
- `productSecretRef` and `webhookSecretRef` store only server env var names; raw secrets never enter PostgreSQL or browser payloads. HTTPS endpoint/storefront URLs enforce SSRF protections (`isSafeHttpsEndpointUrl`).
- Organization `licenseKey` credentials are encrypted with tenant+field AAD AES-256-GCM (`BILLING_LICENSE_KEY`) and matched via HMAC/SHA-256 digests.
- Webhooks reject unauthenticated/forged signatures (`401 INVALID_WEBHOOK_SIGNATURE`) before JSON parsing and deduplicate retries idempotently via unique `eventId`.
- Superadmin routes (`/api/admin/billing`, `/[locale]/admin/billing`) enforce `platformRole === "SUPERADMIN"`; workspace billing mutations require `team.manage` (`OWNER`/`ADMIN`).

## Executed verification

Verified against isolated PostgreSQL 17.11 (`serentax_test`), Next.js standalone build, and Playwright E2E runner.

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160009_billing_berlanggan/migration.sql`
- `README.md`
- `apps/web/src/lib/billing/canonical.ts`
- `apps/web/src/lib/billing/schemas.ts`
- `apps/web/src/server/billing/crypto.ts`
- `apps/web/src/server/billing/berlanggan.ts`
- `apps/web/src/server/billing/entitlements.ts`
- `apps/web/src/server/billing/service.ts`
- `apps/web/src/server/billing/catalog.ts`
- `apps/web/src/server/billing/public-catalog.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/admin/billing/route.ts`
- `apps/web/src/app/api/billing/route.ts`
- `apps/web/src/app/api/webhooks/berlanggan/route.ts`
- `apps/web/src/app/[locale]/admin/billing/page.tsx`
- `apps/web/src/app/[locale]/app/settings/billing/page.tsx`
- `apps/web/src/components/billing/admin-billing.tsx`
- `apps/web/src/components/billing/org-billing.tsx`
- `apps/web/src/components/account/workspace.tsx`
- `apps/web/src/components/marketing/content.tsx`
- `apps/web/src/i18n/billing.ts`
- `tests/unit/billing.test.ts`
- `tests/integration/billing.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/09_BATCH_REPORT.md`

## Open items & next batch

- Written confirmation from Berlanggan on server-hosted multi-tenant SaaS licensing semantics (along with live OpenAPI verification once network/vendor access is active, seller `productSlug`, verified `storefrontUrl`, `productSecretRef`, `webhookSecretRef`, and Ed25519 public key) remains a prerequisite before enabling `saasLicensingApproved = true` in production.
- Tax SME rule approvals, remaining DJP XML templates, external OCR vendor credentials, missing specs 05–11, and host Docker/WSL2 IT policy remain open.
- Next batch: **10 — Reconciliation, Reports & Superadmin**. Stop here and await explicit instruction.
