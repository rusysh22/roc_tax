# SerenTax

Batch 10 adds the reconciliation & usage report (`/[locale]/app/reconciliation`, `/api/reports/reconciliation`, formula-safe `/api/reports/reconciliation/export` CSV), overview status cards, enriched manual Coretax outcome recording (`CORETAX_SUBMITTED`, `CORETAX_ACCEPTED`, `CORETAX_REJECTED` with verification context), consent-based time-boxed `SupportAccessGrant` controls, and the privacy-preserving Superadmin console (`/[locale]/admin`, `/[locale]/admin/jobs`, `/api/admin/overview`, `/api/admin/support-access`). By default, Superadmin views aggregate health only without customer plaintext content or files.

## Local setup

Requires Node.js 24 LTS and Docker Desktop with the Linux engine running.

```powershell
npm ci
Copy-Item .env.example .env
# Edit .env: set a unique random BETTER_AUTH_SECRET (at least 32 characters).
# Set SMTP delivery; the local Compose Mailpit service captures development mail.
Copy-Item .env apps/web/.env.local
docker compose up -d
npm run db:generate
npm run db:validate
npm run db:migrate
npm run db:check
npm run dev
```

Open http://127.0.0.1:3000 (redirects to `/id`); `/en` is English. Account screens are `/{locale}/auth/sign-up`, `sign-in`, `verify`, `forgot`, and `reset`; the protected workspace screen is `/{locale}/app`. View local email at http://127.0.0.1:8025 and follow verification links. Invitation recipients sign in with the invited email, then reopen the invitation email link.

### Local setup without Docker (native PostgreSQL)

When Docker Desktop is unavailable, an embedded PostgreSQL 17 (`embedded-postgres`, in the git-ignored `.local-test-tools/`) runs natively on `127.0.0.1:55432`. Use a `*_dev` database for the app and keep `*_test` for automated tests. In `.env` and `apps/web/.env.local`, point `DATABASE_URL` at `.../serentax_dev`, set `BETTER_AUTH_URL=http://127.0.0.1:3000`, a random `BETTER_AUTH_SECRET`/`TAX_DATA_KEY` (32+ characters), and `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`. Then, in three terminals:

```powershell
node .local-test-tools/start-postgres.mjs   # PostgreSQL on 127.0.0.1:55432
node .local-test-tools/dev-mail.mjs         # prints captured emails (verification links)
npm run db:migrate; npm run dev
```

Open the app exactly at `http://127.0.0.1:3000`. Auth requests from another origin (for example `localhost:3000`) are rejected with `ORIGIN_MISMATCH` by design. If the dev server ever reloads a page in a loop, stop it, delete `apps/web/.next`, and start it again.

### Demo data (local only)

`npm run db:seed:dev` (add `-- --reset` to recreate) builds a synthetic demo workspace through the real services and refuses to run unless `DATABASE_URL` names a `*_dev` database. It creates a SUPERADMIN owner plus Preparer, Reviewer and Approver users (password `DevOnly-Passw0rd!2026`; emails are printed), a `SYNTHETIC_TEST` billing configuration with an active synthetic license (250 transactions/month), demo tax rules, two companies, eight counterparties, about 16 transactions across every workflow status, a 3-row import, and two BPPU XML exports with manual Coretax outcomes. The demo rules are marked `SME_APPROVED` with the citation "DEMO LOKAL — data sintetis, bukan persetujuan Tax SME" only so the full flow can run locally. They are not a Tax SME sign-off and must never reach a shared or production database.

The browser E2E for the core flow (draft → evaluate → submit → approve → XML export → Coretax outcome → reconciliation, plus role boundaries) runs against the seeded local dev stack: `npx playwright test --config playwright.flow.config.ts`. The default `npm run test:e2e` suite needs `DATABASE_URL` exported in the shell, because the standalone server does not read `apps/web/.env.local`.

Next development loads environment from `apps/web/.env.local`; root `.env` is loaded by Prisma CLI and the database check script. Supply configuration through process environment for standalone `npm start` and containers. Public pages build without secrets or database access. Never expose database, SMTP or auth secrets using a NEXT_PUBLIC prefix. An example empty secret deliberately leaves account services unavailable.

Migration `202611160001_auth_workspaces` creates identity/session/account/verification/rate-limit tables and organization/membership/invitation/audit tables. All timestamps use PostgreSQL timestamptz. Deploy with `npm run db:migrate`; no seed or superadmin is created. `db:check` executes a real `SELECT 1` using Prisma's PostgreSQL adapter and returns a nonzero exit code on failure. Redis is reserved for later jobs; auth rate limits use PostgreSQL. Compose ports bind only to loopback. Stop with `docker compose down`; do not add `-v` unless deliberately deleting local data.

## Quality checks

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

For database-backed tests, create a separate database whose name ends in `_test`, set `TEST_DATABASE_URL` to it, and apply the migration using `DATABASE_URL` pointing to that same isolated database. Then run `npm run test:integration` and `npm run test:e2e:auth`. The latter starts a local SMTP capture server on port 1026 and the built app on port 3000. No external mail is sent. Tests create unique synthetic identities and remove their organizations/users afterward. Expired verification/rate-limit metadata may remain in the disposable test database. Never use a customer database. Auth browser traces are disabled to avoid recording tokens/passwords.

Playwright starts the production build and checks desktop/mobile language navigation, layout overflow, unknown routes, and health response headers. Auth browser tests cover signup, email verification through SMTP, profile changes, workspace creation, invitations, session revocation and password reset. Browser screenshots are saved under ignored `test-results/`. CI applies migrations and runs real PostgreSQL integration tests. `GET /api/health` is process liveness only, not database, billing, or tax readiness.

## Authorization and deployment gates

Better Auth 1.7.25 manages passwords and database-backed sessions. Email verification is required before sign-in. Sessions last seven days with hourly refresh; cookie caching is disabled. Resetting a password revokes sessions. Verification identifiers and invitation tokens are hashed at rest. Only explicit auth routes are exposed, with bounded JSON bodies and same-origin POST checks.

Workspace selection is stored per session. Every workspace operation resolves the authenticated session and current database membership. Owner/Admin manage teams; only Owners grant or modify Owner/Admin memberships. Preparer, Reviewer and Approver are separate functional roles; Owner/Admin do not automatically gain tax approval. The last owner cannot be removed or demoted. Permission checks serialize with membership changes using an organization row lock. Revocation clears active workspace selections and invalidates outstanding invitations issued by that member. Invitations are single-use, email-bound, expire after 48 hours, and activate only after SMTP accepts delivery. A crash during delivery can leave a pending-delivery invitation; an authorized manager must cancel and recreate it.

The workspace creation ceiling (20 owned workspaces) and invitation throttle (20/hour per issuer) are abuse controls, not paid plan entitlements. Trials require a separate explicit activation by a verified account. No billing bypass is granted.

## Trial service (Batch 02)

Apply migration `202611160002_trial_quota` using `npm run db:migrate`. It adds `TrialAccount` and `TrialUsage`, database checks for exactly 72 hours, unique account/day and account/idempotency receipts, unique lifetime slots restricted to 1–3, and immutable-update triggers. There are no new environment variables or dependencies. Every application/test database pool now explicitly sets PostgreSQL session timezone to UTC to preserve Prisma timestamp round trips even when the database host defaults to another timezone.

`GET /api/trial` returns only the authenticated verified account's status. Same-origin `POST /api/trial` accepts exactly `{ "action": "activate" }`; repeated activation returns the original timestamps, including after expiration. It cannot accept a caller-supplied user, quota or time. Dashboard time uses the database timestamp with a monotonic local countdown, resynchronizing every 30 seconds and on window focus. Expiry and next daily window show seconds in WIB. The server remains authoritative; browser timers never authorize transactions.

The internal `trialService.create` obtains organization and user locks, revalidates current session/membership/Preparer permission, checks the account-wide trial and quota, persists the draft through the transaction callback, rechecks expiry, and commits a durable usage receipt plus audit event in the same transaction. Callers must validate and normalize the complete draft, generate its fingerprint on the server, and use only the supplied transaction for persistence. Never accept a fingerprint supplied by an untrusted client. No network I/O belongs inside this transaction. Future imports/jobs must use this same gate. Paid entitlement rules remain a separate future gate.

An idempotency key is global to the account and bound to the workspace plus payload fingerprint. A retry returns the existing receipt ID without another write, even when the draft was deleted or trial expired; it does not claim a deleted draft still exists. Changed data/workspace with the same key is rejected. A different key consumes a new slot only after successful persistence. Draft and organization deletion do not delete usage receipts or restore allowance. No API exposes deletion/reset of trial or ledger records; account erasure/retention policy must preserve the no-reset invariant in later legal work.

`test_trial_draft` is an explicitly synthetic, tax-neutral table created only by the isolated integration suite. It is absent from production migrations and has no HTTP endpoint or UI. Tests exercise SQL persistence/rollback rather than mocked quota success. Consequently, the trial is functional but user transaction intake is not yet available. No trial auto-activates on signup or workspace creation. Trial expiry leaves account/workspace reads and identity management available while new trial-funded transaction creation is rejected.

Docker investigation is deferred at the user's request. The existing isolated native PostgreSQL runner was used for this batch; container verification remains pending.

For non-loopback deployments require HTTPS, strong auth secrets, authenticated TLS SMTP, and `AUTH_PROXY_IP_HEADER` set to a client-IP header that your ingress replaces. Block direct access to the app to prevent header spoofing. Restrict database credentials, redact auth URLs in infrastructure logs, and never deploy Mailpit publicly. MFA policy for privileged users, full operational audit/retention, legal review, and the missing security specification remain production launch gates; Batch 01 is not a production sign-off.

## Structure and deployment

- `apps/web/src/app`: App Router pages and HTTP routes.
- `apps/web/src/components/ui`: locally owned shadcn-style UI primitives.
- `apps/web/src/i18n`: typed dictionaries and Jakarta-aware display formatting.
- `apps/web/src/server`: server-only infrastructure; future domain modules belong here with explicit authorization boundaries.
- `prisma`: PostgreSQL schema; generated client is ignored.
- `tests`: unit guardrails and Playwright browser acceptance.
- `core_docs`: authoritative supplied specifications and batch handoff.

Build a non-root standalone container with `docker build -t serentax .` and run it with `docker run --rm -p 127.0.0.1:3000:3000 serentax`. Set secrets via deployment environment, terminate HTTPS at a trusted ingress, and review production security requirements before any customer data is accepted. No production readiness claim is made by this scaffold.

This directory currently sits inside a parent Git repository. CI assumes SerenTax becomes the repository root; the workflow will not be discovered from a nested `.github` directory in that parent repository. No parent repository files were changed.

See the [Batch 02 report](core_docs/02_BATCH_REPORT.md), [Batch 01 report](core_docs/01_BATCH_REPORT.md), [Batch 00 report](core_docs/00_BATCH_REPORT.md), and [decisions](core_docs/13_DECISIONS_AND_OPEN_ITEMS.md) for verification and next steps.

## Batch 03 interface

Public routes under /id and /en include features, how-it-works, pricing, faq, security, terms and privacy. Pricing is explicitly not configured; legal pages require legal review. The app overview is /[locale]/app, with account/team administration at /[locale]/app/settings. Transaction, import and export pages show unreleased status. Language switching preserves the current route; light/dark preferences persist in browser storage. See core_docs/03_BATCH_REPORT.md for verification and the missing design-spec caveat.

## Batch 04 intake & master data

Migration `202611160003_intake` adds `Company`, `Counterparty`, `Transaction`, `TransactionLine`, `SourceDocument`, `TransactionComment`, and `TransactionEvent` with composite `(id, organizationId)` foreign keys and append-only triggers on comments and events.

- **Tax ID protection:** NPWP, NIK, NITKU, and foreign TIN values are validated structurally (never claimed as live DJP lookups), encrypted at rest with AES-256-GCM bound to the organization ID and field kind (`TAX_DATA_KEY`, falling back to `BETTER_AUTH_SECRET` in local development), indexed per tenant with HMAC-SHA256 for duplicate checks, and returned to the UI only as 4-character hints.
- **Atomic quota wiring:** `POST /api/transactions` (`action: "create"`) delegates exclusively to `trialService.create`. Validation failures and unacknowledged duplicate warnings throw inside the database transaction callback, rolling back both the draft and any trial receipt. Updating, commenting on, or voiding a draft never consumes or refunds trial quota.
- **Private source documents:** Uploaded PDF, JPG, and PNG files (max 10 MB) are checked for matching declared MIME, extension, and magic bytes, hashed with SHA-256, stored outside the public web root (`DOCUMENT_STORAGE_DIR`, defaulting to ignored `.local-storage/`), and served only through authenticated tenant-scoped routes with `nosniff` and restrictive CSP headers. Malware scanning is marked `NOT_SCANNED` until a scanner is configured.

## Batch 05 spreadsheet import & batch preview

Migration `202611160004_spreadsheet_import` adds `ImportBatch` and `Transaction.importBatchId` with composite `(id, organizationId)` foreign keys and an append-only `BEFORE UPDATE` trigger on `ImportBatch`.

- **Zero-dependency CSV/XLSX parser & serializer:** Parses UTF-8 CSV and OpenXML `.xlsx` (`sheet1.xml` + `sharedStrings.xml`) using Node's built-in `node:zlib` with strict byte/entry/row/column caps (`MAX_SPREADSHEET_BYTES = 2 MB`, `MAX_DECOMPRESSED_XML_BYTES = 8 MB`, max 200 data rows, max 32 columns) and rejects `<!DOCTYPE` / `<!ENTITY` declarations (`SPREADSHEET_UNSAFE_XML`).
- **Formula safety:** XLSX `<f>` formula elements and cell values starting with `=`, `+`, `-`, `@`, tab, CR, or LF are flagged as `FORMULA_INJECTION` and never executed. Exported template and error-report cells are neutralized with a leading `'`.
- **Quota enforcement before persistence:** Because the account trial allows at most 1 new transaction per Asia/Jakarta calendar day (and no paid entitlement is active until Batch 09), files with `> 1` valid row are blocked up front with `TRIAL_SINGLE_ROW_LIMIT` so no partial or hidden override ever occurs. Commits delegate to `trialService.create` and record an immutable `ImportBatch` row bound to `(organizationId, idempotencyKey)`.

## Batch 06 configurable AI OCR provider

Migrations `202611160005_ocr_provider` and `202611160006_user_platform_role` add `User.platformRole` (`NONE` default, never auto-assigned `SUPERADMIN`), `OcrProviderConfig`, `OrganizationOcrSetting`, `OcrJob`, and `OcrCandidate`.

- **Default `NONE` & explicit `NOT_CONFIGURED` external OCR:** Workspaces default to `NONE` (manual and spreadsheet intake work without OCR). No external AI provider API keys or vendor contracts are included, so external adapters remain `EXTERNAL_NOT_CONFIGURED` while `SYNTHETIC_TEST` enables local no-egress testing.
- **Server-only secrets & SSRF prevention:** `OcrProviderConfig` stores only environment variable names (`secretRef`), never API key values or browser-exposed credentials. External HTTPS endpoint URLs block loopback, private, link-local, and metadata IP ranges.
- **Tenant consent, caps & safe extraction:** Tenant `OWNER`/`ADMIN` selection requires vendor approval and explicit `externalAiConsent`. Jobs enforce per-document page limits and monthly tenant page/spend caps, neutralize prompt-injection directives, require explicit human verification on low-confidence Tax ID / currency / monetary fields, and record provenance plus before/after corrections in append-only `TransactionEvent` audit rows.

## Batch 07 tax rule engine & review workflow

- **Versioned effective-dated tax rules (`/[locale]/admin/tax-rules`, `/api/admin/tax-rules`):** Superadmin-managed (`platformRole === "SUPERADMIN"`) rule registry supporting `TaxFamily`, rational rate numerators/denominators, fixed-point `bigint` arithmetic (`HALF_UP`, `HALF_EVEN`, `DOWN`, `UP` documented per version), effective `validFrom`/`validTo` bounds, regulation reference, SME review metadata (`smeReviewedBy`, `smeReviewedAt`), `NON_PRODUCTION_TEST` synthetic test isolation, and lifecycle transitions (`DRAFT` -> `SME_APPROVED` -> `RETIRED`). Zero unverified Indonesian statutory tax rates are seeded.
- **Deterministic evaluation & explicit data gates (`apps/web/src/server/tax/engine.ts`):** Requires classified tax family (`UNCLASSIFIED` fails closed), counterfactual counterparty tax identity when required by a rule, and explicitly blocks `PPH21` without payroll context and `PPH26` without treaty/SKD (`Form DGT`) data. Recalculations persist append-only `TaxEvaluation` rows and surface visible calculation diffs against the prior evaluation.
- **Review, segregation of duties & immutable snapshots (`/api/tax/policy`, `/api/transactions/[id]/review`):** Supports `evaluate`, `submit`, `request_changes`, `approve`, and `reopen` with revision concurrency locks and review comments. Default `STRICT_SEPARATION` enforces that the final approver is distinct from the preparer/submitter; `SOLE_USER_EXCEPTION` requires explicit warning acknowledgement (`soleUserAck`) and is audited. Approving persists a trigger-protected `TaxEvaluationSnapshot` capturing rule ID/version/rate/rounding/totals/blockers so later rule updates never alter historical approved transactions. Production `APPROVED` strictly blocks `NON_PRODUCTION_TEST` or non-`SME_APPROVED` rules (`PRODUCTION_RULE_UNVERIFIED`).

## Batch 08 Coretax XML template registry & verified BPPU export

- **Official DJP BPPU v.3 source provenance (`apps/web/src/lib/export/bppu-spec.ts`):** Derived directly from DJP's official converter `BPPU Excel to XML v.3.xlsx` (`xl/xmlMaps.xml` `Schema3`, `BpuBulk_Map`, published `2025-09-04`, SHA-256 `b59813365bccdf9d63a47051d4d2b0b58c53351b8c981a6f33144be05b429089`) and official XML sample archive `bppu.zip` (`2024-12-10`, SHA-256 `8a90ea38737bd8d5f0563c12c11ec076b91138f0865ac9f46fd0d4414b004deb`, containing `bppu.xml` SHA-256 `bd52881b465315072fe3820f3f63b38b6e966d72e7da22ec94afcac1b55635e5`). Unsupported families (`PPN_FAKTUR_KELUARAN`, `PPH_UNIFIKASI_BPNR`, `PPH21_*`, `PPH26_BP26`) fail closed with `TEMPLATE_UNVERIFIED`.
- **Canonical XXE-safe BPPU serializer & validator (`apps/web/src/lib/export/bppu.ts`):** Emits UTF-8 `BpuBulk` XML in exact `Schema3` element order (`TaxBase` & `Rate` formatted without floating point, special characters escaped, `<SP2DNumber xsi:nil="true"/>` when applicable, `WithholdingDate` enforced `>=` tax period start, `Direct` SP2D validation) and self-validates before storage while rejecting DTD/DOCTYPE/ENTITY constructs.
- **Immutable export batches & manual Coretax outcomes (`/[locale]/app/exports`, `/api/exports`, `/[locale]/admin/xml-templates`):** Generates XML only from `APPROVED`/`EXPORTED` transactions sharing `(companyId, taxFamily, taxPeriod)` with valid `SME_APPROVED` snapshots, stores XML privately indexed by SHA-256 (`INTEGRITY_MISMATCH` check on download), increments `exportVersion` on regeneration without overwriting prior exports, and records manual `CORETAX_ACCEPTED` / `CORETAX_REJECTED` outcomes append-only (with controlled `CORETAX_REJECTED -> CHANGES_REQUESTED` reopen).

## Batch 09 Berlanggan subscription & licensing (compatibility gate)

- **Typed Berlanggan adapter & Canonical JSON Ed25519 trust (`apps/web/src/server/billing/berlanggan.ts`, `crypto.ts`, `canonical.ts`):** Implements `GET /v1/catalog/products/{slug}/plans`, `POST /v1/activate`, `/v1/validate`, `/v1/deactivate`, and `/v1/operation-authorize`, handles all documented statuses (`active`, `grace`, `expired`, `suspended`, `revoked`, `invalid`, `seat_full`, `rate_limited`), and verifies `entitlement_signature` with Ed25519 over Canonical JSON (`sort_keys`, compact `,`/`:`, unescaped UTF-8).
- **HMAC-SHA256 webhook receiver & idempotency (`/api/webhooks/berlanggan`):** Verifies `X-Berlanggan-Signature` over exact raw request bytes using `timingSafeEqual` before parsing JSON, prevents duplicate processing via `BillingWebhookEvent.eventId` uniqueness, refreshes server-side validation for `license.issued`/`license.renewed`, and suspends access immediately on `license.suspended`.
- **Fail-closed compatibility gate (`BILLING_NOT_CONFIGURED` / `SAAS_LICENSING_UNAPPROVED`):** Server-side paid access remains strictly disabled unless `adapterMode === "BERLANGGAN_LIVE"` AND `saasLicensingApproved === true` AND a verified external `storefrontUrl` + signed entitlement exist. Paid limits/flags are resolved centrally in `apps/web/src/server/billing/entitlements.ts` from provider entitlements only, with zero fabricated pricing or checkout links, leaving local `72h` / `1/day` / `3 total` trial intact.
- **Subscription-entitled creation (`apps/web/src/server/trial/service.ts`, migration `202611210011_entitled_usage`):** Manual drafts and spreadsheet imports in a workspace with a verified license (paid Berlanggan, or a `SYNTHETIC_TEST` license outside production) use the signed `MONTHLY_TRANSACTIONS` entitlement instead of the trial ledger. A non-negative integer is a cap per Asia/Jakarta calendar month, an explicit `null` means unlimited, and an absent key fails closed (`ENTITLEMENT_MISSING`). Usage is counted from append-only, idempotent `EntitledUsage` receipts, so voiding never refunds quota (`MONTHLY_LIMIT` when exhausted). Multi-row imports commit atomically under the cap or not at all. Workspaces without a valid license keep the unchanged trial rules. The `SYNTHETIC_TEST` signing key is derived from the server secret, so licenses stay valid across restarts and processes.

## Batch 10 reconciliation, reports & superadmin operations

- **Reconciliation report & formula-safe CSV (`/[locale]/app/reconciliation`, `/api/reports/reconciliation`, `/api/reports/reconciliation/export`):** Compares source transaction amounts, locked tax snapshot DPP/tax totals, export batch versions/SHA-256 prefixes, and user-recorded manual Coretax results (`CORETAX_SUBMITTED`, `CORETAX_ACCEPTED`, `CORETAX_REJECTED` with portal timestamp, account hint, and evidence checksum). Includes search/filters (`companyId`, `taxPeriod`, `taxFamily`, `source`, `discrepancyOnly`), accessible paginated tables, usage/plan summary, and CSV export neutralized against spreadsheet formula injection.
- **Privacy-preserving Superadmin console & audited support access (`/[locale]/admin`, `/[locale]/admin/jobs`, `/api/workspaces/support-access`, `/api/admin/support-access`):** Displays platform aggregate health (tax rules, XML templates, OCR provider registry/queue, Berlanggan webhook totals) and paginated org/job tables with zero raw customer invoice text or plaintext TINs. Tenant `OWNER`/`ADMIN` consent (`SupportAccessGrant` with expiration/revocation) is required before Superadmin diagnostic inspection, logged immutably to `SupportAccessAudit` and `WorkspaceAudit`.

## UI design system & standard views (Odoo-style)

- **Look & feel:** a neutral black/white base with semantic colour only (blue primary, green approve/success, amber warning, red destructive/error, violet exported) defined as light/dark tokens in `apps/web/src/app/globals.css`, the self-hosted **Figtree** variable font (`@fontsource-variable/figtree`, no runtime font request) and `lucide-react` icons. Touch targets grow automatically on coarse pointers.
- **Mandatory UI standards:** see [`core_docs/14_UI_STANDARDS.md`](core_docs/14_UI_STANDARDS.md). Every field uses a dictionary key (`i18n/fields.ts`) with a functional + technical info tip; every enum uses the code registry (`i18n/codes.ts`) instead of technical names; lists page at 50 rows with bounded scrolling and bold totals. `tests/unit/ui-standards.test.ts` enforces this.
- **Shell:** a black navbar with the apps-menu button, the active module and its menus, a workspace switcher, language, theme and a user menu. The sidebar lists every module with icons and can collapse to an icon rail; on phones it becomes a drawer. `/[locale]/app` is the home menu of module tiles. Modules are declared once in `components/layout/modules.ts`, and Platform Admin only appears for superadmins.
- **Standard views (`components/views/`):** every screen is built from the same pieces.
  - `ListPage`: list/tree view with a control panel, **New**, search facets ("Search _field_ for: …"), dynamic **Filters** (derived enum values with counts, date ranges, presets such as _Archived_), **Group by** with sums, sortable columns, pager, row selection, **Actions** (Archive / Unarchive / Delete / custom) and **Export CSV** (formula-safe). Clicking a row opens the record. On phones rows become cards. Search state lives in `?s=`, so it survives reloads, back/forward and the language switch. Lists run client-side or, for large data (transactions, reconciliation), server-side.
  - `FormPage`: form view with breadcrumbs, **Edit / Save / Discard** (with an unsaved-changes guard), a gear menu (Archive / Delete / …), a record pager (`3 / 27`), an Odoo status bar with workflow buttons, a sheet with an _Archived/Voided_ ribbon, notebook `Tabs` and a `Chatter` (comments + audit log).
  - `Wizard`: multi-step modal (spreadsheet import, XML export). `Dialog` / `ConfirmDialog` handle prompts.
- **Fields:** every dropdown is the same searchable `Combobox` (type to filter, keyboard navigation, clearable, async server search for large sets such as counterparties). `MultiCombobox` is the many2many tag widget. `FormField` gives a consistent label/help/error layout (stacked or Odoo-style inline).
- **Archive semantics:** companies and counterparties archive via `archivedAt` (migration `202611220012_counterparty_archive`). Tax rules and XML templates archive by moving to `RETIRED`, and OCR providers by being disabled. Transactions are fiscal records, so they are **voided** with a reason, and voided transactions are hidden by default like archived records. Hard delete is only offered for master data nothing references yet (`IN_USE` otherwise).
- **Theme/language:** the theme is applied before first paint and kept by a single store shared by every toggle (`lib/theme.ts`). The language switch does a full navigation that keeps the query string and hash, so neither the theme nor the active filters are lost.
