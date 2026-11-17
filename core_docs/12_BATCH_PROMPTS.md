# AI Vibe Coding Implementation — Sequential Batch Prompts

**How to use:** The AI coding agent first receives `01_MASTER_PROMPT.md` + all project docs. Send **one** batch prompt at a time. The agent must stop after each batch, report tests, and update `03_MEMORY.md` and `13_DECISIONS_AND_OPEN_ITEMS.md`. Do not let it jump ahead. Product owner reviews diff before next batch.

---

## BATCH 00 — Bootstrap / Guardrails

**Prompt to paste:**

> BATCH 00 — Bootstrap SerenTax repository. Read all product specs, verify Next.js/App Router and library versions against current official docs, and create a production-sensible Next.js + TypeScript strict monorepo-style modular monolith (single app, optionally worker package), Tailwind/shadcn, lint, formatter, Zod, Prisma/Postgres, Vitest, Playwright configuration, local Docker Compose Postgres + Redis, `.env.example`, English code and bilingual UI scaffolding. Implement a minimal public page with monochrome brand, i18n routing, and health status endpoint that reveals no secrets. Create the project folders, CI pipeline, error boundary, and docs references. No live tax calculations, OCR, XML generator, payment integration or fake success. Add setup instructions and run available install/lint/typecheck/test/build. Report versions and tests. Update agent memory. STOP.

**Acceptance:** app starts, id/en route switch, CSS tokens, Prisma connection ready, test command passes, full repo scaffold, secrets ignored.

## BATCH 01 — Authentication, Organizations & RBAC

**Prompt to paste:**

> BATCH 01 — Implement secure signup/signin, verified email, session management, password recovery if password auth chosen, account profile, organization creation, invitation acceptance, active organization switcher, membership roles (Preparer, Reviewer, Approver, Owner/Admin) and protected routes. Every user-owned server action must check actual authenticated actor and membership. Add Prisma migrations and server-side policy helpers. Add role/tenant isolation integration tests, invitation replay tests, revocation tests and bilingual accessible UI states. Never auto-assign superadmin. No billing bypass or production personal data. Report and STOP.

**Acceptance:** authenticated paths secure; user A cannot read B; revoked users fail; role checks tested.

## BATCH 02 — Trial 72h + Atomic Usage Quota

**Prompt to paste:**

> BATCH 02 — Implement a once-only verified-account trial at first activation: 72h duration from server timestamp, 1 newly persisted transaction per Jakarta local calendar date, at most 3 trial transactions ever per account across all workspaces. Build server quota service using atomic database transaction and uniqueness/locking strategy, usage ledger and idempotency keys; create test-only eligible transaction stub/model with structurally valid minimal fields, clearly marked internal test infrastructure and not UI tax output. Deletion/edit/retry must not refund/count again. Add dashboard trial strip with expiry in WIB, remaining daily/overall counters and descriptive errors; test 10 simultaneous creates, cross-timezone boundaries, multiple organizations, retries, expires, failures. Never rely on UI-only validation. STOP.

**Acceptance:** concurrency race closes; 1/day and 3 total reliably enforced.

## BATCH 03 — Design System, Marketing & Core App Shell

**Prompt to paste:**

> BATCH 03 — Implement SerenTax monochrome design system from `07_DESIGN_SYSTEM.md`: landing, features, how-it-works, pricing placeholder driven by billing adapter state (NOT hardcoded prices), FAQ, Terms/Privacy placeholders explicitly marked pending legal review, responsive app dashboard/nav, organization switcher, language switch id/en, theme and skeleton/empty/error states. Brand `SerenTax` pun on serentak, premium black-white-gray, no flashy gradients. Accessible keyboard-friendly components. Show supported/not-yet-supported families honestly. Include screenshots or visual QA if environment supports; E2E navigation and i18n tests. STOP.

**Acceptance:** responsive desktop/mobile pages, localized, truthful features/pricing states.

## BATCH 04 — Company, Counterparty & Transaction Intake

**Prompt to paste:**

> BATCH 04 — Implement secure company tax profiles, organization counterparties, manual transaction wizard, transaction list/detail, draft state machine, duplicate checks and source document metadata from `02_PRD.md`. Use precise tax-neutral validated fields, decimal-safe monetary representation, no hardcoded tax rates or fake XML. Add secure private file storage adapter and PDF/JPG/PNG MIME/size/magic validations. Add source invoice upload, tenant-scoped document viewer, comments and basic audit. All creation operations go through Batch 02 atomic quota service. Add integration tests for manual single creation, duplicate warnings, quota and tenant access. STOP.

**Acceptance:** accountant creates/revises safe manual draft with clear validations; quota respected.

## BATCH 05 — Spreadsheet Import & Batch Preview

**Prompt to paste:**

> BATCH 05 — Build XLSX/CSV import templates for a tax-neutral normalized transaction model, row mapping and preview, invalid-row feedback, download error report, duplicate checks, import batch history and idempotent batch processing. For each accepted row, enforce exact trial/paid quota BEFORE persisting; no hidden partial overrides or queue bypass. If trial allows one/day, explain that multiple rows cannot all be created. Avoid Excel formula injection in exports and formula execution on imports. Support id/en and tests for malformed Excel, mixed valid/invalid rows, multi-tenant access and concurrent imports. STOP.

**Acceptance:** row-by-row errors and no quota bypass.

## BATCH 06 — Configurable AI OCR Provider

**Prompt to paste:**

> BATCH 06 — Implement pluggable OCR adapter with NONE/manual as default, platform superadmin provider registry, server-side secret references, allowed provider selection, model/region/timeouts/page and spend caps, asynchronous job, safe extracted candidate fields, confidence/provenance and side-by-side correction UI. Implement one real provider adapter **only if its official documented API and credentials are available**; otherwise implement the adapter contract and synthetic test adapter, mark production OCR NOT_CONFIGURED. Never send documents to external AI without approved vendor/processors settings. Add retries, dead letter, audit, no-secret leaks, tests for invalid files, provider errors, prompt injection text, low confidence and manual fallback. STOP.

**Acceptance:** manual survives without OCR; provider swap no tax domain rewrite; no unapproved egress.

## BATCH 07 — Tax Classification, Rule Engine & Review Workflow

**Prompt to paste:**

> BATCH 07 — Implement deterministic, versioned, effective-dated tax rule engine, tax family selection, decision evidence, missing-data blockers, decimal-safe calculations and user-facing field errors. Do not seed unverified Indonesian tax codes/tariffs or claim full statutory coverage. Add per-organization Reviewer/Approver workflow: submit, request changes, approve/reject, revision locking, comments, segregation-of-duties policy, before/after audit. For PPh21 and PPh26 show requirement for additional payroll/treaty data instead of invoice-only inference. Implement test fixtures with synthetic reference rules explicitly labeled NON_PRODUCTION, and block production tax approval until reviewed rule catalog exists. STOP.

**Acceptance:** no silent classification; approvals irreversible without controlled reopen; source/rule version preserved.

## BATCH 08 — Coretax XML Template Registry & First Verified Export

**Prompt to paste:**

> BATCH 08 — Build official DJP template registry, versioned field mapping, fixture harness and secure XML exporter. FIRST obtain actual template/converter for BPPU from `https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml`, record source URL/date/hash and derive the real schema, element order and field definitions from that source. Do not invent XML tags or export a dummy 'valid' format. If source cannot be obtained or mapped confidently, implement registry/UI and fail closed with `TEMPLATE_UNVERIFIED`, document exact blocker; no production XML generator. Once verified, use anonymized fixtures and test against official converter/reference, amounts, special chars, encoding, duplicates, dates. Generate only from approved snapshots, store immutably and provide manual Coretax upload guidance. STOP.

**Acceptance:** true source-verified BPPU export or explicit blocked family; immutable history; no false Coretax accepted claim.

## BATCH 09 — Berlanggan Subscription & Licensing (compatibility gate)

**Prompt to paste:**

> BATCH 09 — Read `08_BILLING_BERLANGGAN.md` and live `https://berlanggan.web.id/docs/` including seller plans, activation, signed entitlement, heartbeat, webhook. Build a typed Berlanggan BillingProvider Adapter, catalog retrieval `GET /v1/catalog/products/{slug}/plans` after verifying OpenAPI fields, configured/verified external storefront URL and secure `license.issued/renewed/suspended` webhook receiver with HMAC raw-body verification, idempotency and validation refresh. Implement server-only activation/validate logic and cryptographic trust using official canonical JSON requirements; handle active, grace, expired, suspended, revoked, invalid, seat_full, rate_limited. Crucial: provider docs describe on-premise device fingerprint/seat; **do not enable production SaaS paid access until provider has approved correct server-hosted tenant licensing semantics**. Pending compatibility, use safe `BILLING_NOT_CONFIGURED` state/test doubles and transparent UI. Define paid entitlements and usage centrally but read values only from provider. Trial remains local 72h/1/day/3 total. No fabricated checkout endpoint or price. Include negative tests and STOP.

**Acceptance:** genuine signature checks, verified external catalog and correct fail-closed/compatibility gating.

## BATCH 10 — Reconciliation, Reports & Superadmin

**Prompt to paste:**

> BATCH 10 — Implement XML export history, user-recorded manual Coretax upload results (submitted/accepted/rejected), evidence/ref with verification context, reconciliation report, search/filter by tax family and period, usage/plan report, and restricted superadmin tools for tax template/rule approval, OCR provider health, billing webhook health and background jobs. Strict tenant scopes, no ability to see raw customer content by default, audited support access. Dashboards communicate 'recorded manually', not live Coretax integration. Add paginated accessible tables and tests. STOP.

**Acceptance:** precise history and status semantics; superadmin doesn't bypass privacy.

## BATCH 11 — Security/Legal Hardening & Production Readiness

**Prompt to paste:**

> BATCH 11 — Conduct a full audit against `10_SECURITY_LEGAL.md` and `11_TEST_AND_ACCEPTANCE.md`: cross-tenant IDOR, RBAC, auth sessions/MFA, CSRF/XSS/SSRF, upload malware/pdf bombs, XML unsafe parsing, secrets/leaks, signed webhooks, provider activation, quota concurrency, backup/restore, queue idempotency, observability redaction, accessibility/i18n, data export/deletion, legal pages with product owner/legal placeholders. Run all integration/E2E tests and build; create deployment/rollback runbook, operations dashboard and launch blocker checklist. Never claim PSE registration or Tax sign-off is done without documentary evidence. STOP.

**Acceptance:** no critical security issues; transparent launch readiness and pending external approvals.

## BATCH 12 — Optional Next Phase: D365 F&O / ERP Connector

**Prompt to paste:**

> BATCH 12 (OPTIONAL, DO NOT START WITHOUT PRODUCT OWNER APPROVAL) — Design a read-only ERP export/import adapter for D365 Finance & Operations to reconcile AP Invoice Journal, AR Free Text/Sales Invoice and tax transaction summaries into SerenTax normalized transactions. Start with CSV/Excel import and stable source references, not privileged direct ERP API by default. Add mapping UI, company-specific settings, financial dimensions optional, PII redaction, duplicate prevention, amount reconcile and audit, and an isolation/security plan. Only implement OData/Data Entity integration after confirming customer tenant permissions and actual supported entity schema. Do not post/reverse any D365 accounting transaction. STOP.

**Acceptance:** safe read-only reconciliation; no production D365 mutations.

---

## Standard command appended to EVERY batch (paste if the agent skips QA)

> Before you say 'done': show exact changed file paths, migrations, test commands and results, security decisions, remaining blockers, API assumptions checked against source, and a clear next-batch handoff. Update the project MEMORY and DECISIONS files. Do not claim success without executed verification.
