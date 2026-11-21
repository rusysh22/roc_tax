# SerenTax Agent Memory — Durable Project Context

## Immutable product identity

- Product: **SerenTax**, pun on Indonesian word _Serentak_.
- Positioning: Indonesian tax document preparation and Coretax-compatible XML export, not tax filing automation, not DJP/PJAP representation.
- Target users: accounting clerks, tax staff, tax manager/approver, company admins, internal SerenTax superadmin.
- Default locale `id`, optional `en`; currency IDR, timezone Asia/Jakarta for daily quota; data UTC.
- Visual: intentionally black-white-neutral grayscale. No colorful fintech dashboard aesthetic.
- Framework Next.js + TypeScript; server-only tax, billing, auth, OCR credentials.

## Permanent business rules

- Trial 72h from verified trial activation, max 1 new transaction in each Asia/Jakarta local date and max 3 new transactions total per account, across workspaces.
- Subscription plans/prices must be managed in Berlanggan; SerenTax consumes provider catalog/entitlements; no arbitrary local pricing source-of-truth.
- Entitlement checks must guard server actions/API and background jobs, not just components.
- OCR is configurable, optional, vendor-neutral; manual entry works without it.
- Tax calculation/classification is deterministic and effective-dated, with human review.
- XML only from verified official DJP template per version; manual Coretax upload.
- Each operation is tenant-scoped; audit logs on sensitive operations.

## Verified external findings, 2026-11-15

- DJP provides publicly downloadable XML templates/converters, including distinct BPMP, BP21, BP26, BPA1/BPA2, BPPU, BPNR, and Faktur Keluaran families.
- Berlanggan seller has products, monthly/yearly plans and configurable entitlement pairs. Activation API supports `POST /v1/activate`, `/v1/validate`, `/v1/deactivate`, `/v1/operation-authorize`, and `GET /v1/catalog/products/{slug}/plans`. Webhooks include `license.issued`, `.renewed`, `.suspended` with signed requests.
- Important caveat: Berlanggan documentation presents activation as **on-premise device/fingerprint licensing**. There is no publicly documented generic SaaS checkout API in the inspected docs. Compatibility for SerenTax server-side tenant licensing must be confirmed before paid launch.

## Memory hygiene (MANDATORY)

Each batch must maintain this file with the headings below. Never store passwords, API keys, license keys, NPWP/NIK, real invoice data, secrets, or user personal data in project memory.

### Current phase

- Batch 10 implemented on 2026-11-17. Verification and handoff are in `10_BATCH_REPORT.md`.
- 2026-11-22 local readiness pass (not Batch 11): subscription-entitled creation via `EntitledUsage`, default workspace on sign-in, synthetic billing key derived from server secret, UI/copy fixes, `npm run db:seed:dev` demo workspace, and core-flow browser E2E. Details in `13_DECISIONS_AND_OPEN_ITEMS.md`. Docker Desktop WSL2 blocker remains an endpoint `DenyDeviceClasses` Group Policy; native PostgreSQL testing continues independently.

### Completed batches

- 00 implementation: npm workspace, Next App Router, strict TypeScript, monochrome bilingual public preview, error/loading boundaries, liveness endpoint, Prisma/Postgres configuration, local Compose, Dockerfile, CI and tests. Database/container runtime acceptance remains pending because Docker engine is unavailable.
- 01: Better Auth verified email/password, recovery, session listing/revocation, profile, organizations, per-session workspace selection, invitations, Owner/Admin/Preparer/Reviewer/Approver policy, tenant-scoped API and audit events. Migration applied and security integration tests run against isolated real PostgreSQL. Real SMTP-to-local-capture browser flow verified. No customer data or external email used.
- 02: once-only verified-account trial activation; 72-hour database timestamps; atomic 1/Jakarta-day and 3-total account-wide ledger; request idempotency; dashboard countdown/quota/status; test-only neutral draft persistence. No real transaction creation endpoint, tax output or paid bypass. PostgreSQL tests cover concurrent creation across organizations, retries, rollback, expiry and no refunds.

- 03: bilingual public marketing pages, truthful billing-adapter catalog state, pending-review legal placeholders, monochrome light/dark tokens, accessible responsive app shell, overview, workspace selector and account/team settings. Unreleased transaction/import/export routes remain explicit placeholders. No migrations or live provider calls.
- 04: company tax profiles and counterparties with AES-256-GCM encrypted tax IDs, tenant HMAC blind indexes and 4-char hints; manual tax-neutral transaction intake wired through Batch 02's atomic `trialService.create`; fixed-point bigint decimal math; duplicate invoice/amount warnings; draft revision locking, voiding, comments and append-only audit events; private source document storage and viewer (PDF/JPG/PNG MIME + extension + magic-byte validation, SHA-256 deduplication, `NOT_SCANNED` malware status). No hardcoded tax rates, OCR or XML generation.
- 05: CSV/XLSX import templates for the tax-neutral transaction model, column mapping and row-by-row preview, formula-injection rejection on import and neutralization on export, downloadable CSV error report, duplicate checks, immutable `ImportBatch` history, and idempotent batch commits guarded by Batch 02's atomic `trialService.create` (rejecting multi-row valid batches up front under the 1/day trial rule without partial writes).
- 06: pluggable OCR adapter (`NONE` default, `SYNTHETIC_TEST` local no-egress adapter, `EXTERNAL_NOT_CONFIGURED` fail-closed production marker), Superadmin provider registry (`User.platformRole` defaulting to `NONE` and never auto-assigned), server-only `secretRef` env names, SSRF endpoint validation, tenant consent & monthly page/spend caps, async `OcrJob` queue with `FOR UPDATE SKIP LOCKED`, exponential backoff retries, `DEAD_LETTER` + manual fallback, prompt-injection sanitization, low-confidence verification gates on Tax ID/currency/amounts, and side-by-side correction UI with provenance audit.
- 07: deterministic effective-dated `TaxRule` registry (`platformRole === "SUPERADMIN"`), explicit `NON_PRODUCTION_TEST` fixture isolation, blocking `APPROVED` unless `SME_APPROVED`, `bigint` rational rate math with versioned rounding modes, explicit payroll (`PPH21`) and treaty/SKD (`PPH26`) input blockers, visible recalculation diffs, `OrganizationTaxPolicy` segregation-of-duties (`STRICT_SEPARATION` default, `SOLE_USER_EXCEPTION` with mandatory acknowledgement), transaction review/request-changes/approve/reopen workflow with revision locking, and trigger-immutable `TaxEvaluation` / `TaxEvaluationSnapshot` audit history.
- 08: official DJP XML template registry (`/[locale]/admin/xml-templates`, `XmlTemplate`), source-verified BPPU v.3 schema/element order/validation (`pajak.go.id` `BPPU Excel to XML v.3.xlsx` + `bppu.zip`), fail-closed `TEMPLATE_UNVERIFIED` gate for all other 7 tax families, canonical XXE-proof BPPU serializer & validator, private SHA-256-verified XML batch exports (`XmlExportBatch`/`XmlExportItem`, `exportVersion` regeneration history, `BEFORE UPDATE` immutability triggers), and append-only manual Coretax upload outcomes (`XmlExportOutcome`, `CORETAX_ACCEPTED`/`CORETAX_REJECTED`, controlled reopen on rejection).
- 09: Berlanggan HTTP adapter + `SYNTHETIC_TEST` test double (`BillingConfig`, `OrganizationLicense`, `BillingWebhookEvent`), Canonical JSON Ed25519 signature verification (`entitlement_signature`), raw-body HMAC-SHA256 webhook receiver with idempotent `eventId` dedup and immutability trigger, central provider-only entitlement resolution, strict compatibility gate (`BILLING_NOT_CONFIGURED` / `saasLicensingApproved === false` default blocking SaaS paid access until vendor confirmation), and local trial rules preserved.
- 10: manual Coretax outcome recording expanded (`CORETAX_SUBMITTED`, `CORETAX_ACCEPTED`, `CORETAX_REJECTED` with verification context), paginated accessible reconciliation report + usage/plan summary + formula-safe CSV export (`/[locale]/app/reconciliation`), overview dashboard cards, privacy-preserving Superadmin operations & job queue console (`/[locale]/admin`, `/[locale]/admin/jobs`), and consent-based time-boxed `SupportAccessGrant` + immutable `SupportAccessAudit`.

### Approved technical decisions

- Next.js, TypeScript strict, PostgreSQL/Prisma, Tailwind/shadcn, i18n, provider adapters.
- Node 24; Next 16.4.6; React 19.3.1; Prisma 7.10.1 (stable, not Prisma 8 release candidate); Tailwind 4.3.5. Exact versions are locked.
- No domain schema, customer records, auth endpoints, payment, tax or OCR execution in Batch 00. Liveness does not assert dependency readiness.
- ESLint 10 uses official Next and TypeScript plugins directly because the bundled Next config retains ESLint 9-only peers. Scoped minimatch 11.0.1 override addresses the development dependency advisory; remove when upstream adopts the fix.
- Better Auth 1.7.25 with Prisma transactions, no cookie session cache, verified-email requirement, hashed verification identifiers, and password-reset session revocation. Same-origin POST and bounded JSON at HTTP boundaries. No automatic superadmin or platform role exists.
- Workspace permissions are re-read from database; protected operations and membership changes share an organization row lock. Last-owner removal is forbidden. Owner/Admin do not implicitly gain tax review/approval privileges. Invitation tokens are hashed, single-use, email-bound, and expire after 48 hours.
- All PostgreSQL pools explicitly enforce UTC session timezone. Batch 02 found that a non-UTC database default shifts timestamp round trips in the installed Prisma pg adapter; regression tests verify real instants and Jakarta dates. No existing customer timestamp data was altered.
- Trial creation locks organization then account; persistence, receipt and audit commit together. Ledger has no draft/organization cascade, unique account/day and idempotency keys, and slots constrained to 1–3. Activation and ledger updates are blocked by database triggers.
- Company and counterparty tax identifiers (NPWP, NIK, NITKU, foreign TIN) are encrypted with AES-256-GCM using tenant+field AAD, indexed per workspace with HMAC-SHA256 for duplicate checks, and never returned in plaintext by list/detail endpoints. Format checks are structural only, never claimed as live DJP lookups.
- Manual transaction creation uses `trialService.create`; validation or unacknowledged duplicate failures abort inside the transaction before consuming quota. Edits, comments, document attachments, and voiding do not consume or refund trial quota. PPh 21 and PPh 26 families are locked in invoice intake because they require payroll or treaty facts beyond an invoice.
- Transaction creation uses exactly one quota source: a verified license (signed `MONTHLY_TRANSACTIONS`, Jakarta month, `null` = unlimited, absent = fail closed, non-refundable `EntitledUsage` receipts) or, without one, the unchanged trial ledger.
- New sessions default to the last-used still-valid workspace (else the oldest membership); membership is still re-verified on every request.
- Monetary values use `Decimal(20,2)` and quantities `Decimal(18,4)` with exact bigint fixed-point arithmetic; line products requiring sub-cent rounding are rejected until a rule-versioned rounding policy is approved.

### Open blockers

- Referenced specifications 05–11 were not supplied. Bootstrap proceeded using explicit requirements from the five available documents; missing specs remain required for relevant later work.
- Docker Desktop start was attempted, but the engine returns an HTTP 500 error. Isolated native PostgreSQL 17.11 successfully ran migrations and integration tests; Compose containers and Redis remain unverified. CI has not run remotely.
- Per latest user instruction, do not spend this batch investigating Docker. Native PostgreSQL testing continues independently.
- Real deployment needs SMTP credentials, auth secret, HTTPS and a trusted client-IP ingress header. Elevated-role MFA and full operations/retention policy remain production gates; not a production sign-off.
- SerenTax is nested inside a parent Git repository. CI requires this folder to be the repository root or a deliberate parent-level workflow setup.
- Confirm Berlanggan SaaS license/fingerprint/seat compatibility, actual seller product slug and seller/product checkout URL.
- Retrieve official DJP templates, schema versions, and sample known-good XML before implementing any export generator.
- Tax SME approval for object codes, tariffs, effective dates, and tax calculation policy.
- Choose data retention, residency, subprocessors, and legal/commercial terms after legal review.

### Next batch

- 11 - Security/Legal Hardening & Production Readiness. Await explicit next-batch instruction. No automatic continuation.
