# Batch 10 — Reconciliation, Reports & Superadmin

Date: 2026-11-17. Scope: Batch 10 only.

## Implemented

- **Manual Coretax Outcome Evidence (`CORETAX_SUBMITTED` / `CORETAX_ACCEPTED` / `CORETAX_REJECTED`):** Extended `CoretaxOutcomeStatus` and `XmlExportOutcome` (`accountHint`, `portalTimestamp`, `evidenceSha256`, `coretaxReference`, `notes`) so teams can record every manual Coretax portal milestone append-only without implying live DJP synchronization.
- **Reconciliation Report, Overview Cards, Usage/Plan Summary & CSV Export (`/[locale]/app/reconciliation`, `/api/reports/reconciliation`, `/api/reports/reconciliation/export`, [overview.tsx](file:///c:/Users/MShubkhi/Downloads/dani_coding/roc_tax/apps/web/src/components/account/overview.tsx)):** Aggregates transaction counts (`totalTransactions`, `inReview`, `approved`, `exported`, manually submitted/accepted/rejected, discrepancies), compares source amounts against locked `TaxEvaluationSnapshot` and `XmlExportBatch` state, supports paginated accessible filtering (`companyId`, `taxPeriod`, `taxFamily`, `source`, `search`, `discrepancyOnly`), shows trial & centralized Berlanggan status, and exports formula-safe CSV via `serializeCsv`.
- **Privacy-Preserving Superadmin Operations & Jobs Console (`/[locale]/admin`, `/[locale]/admin/jobs`, `/api/admin/overview`):** Surfaces platform aggregate health for tax rules, XML templates, OCR provider configs & job queues (`QUEUED`/`RUNNING`/`SUCCEEDED`/`FAILED_RETRYABLE`/`DEAD_LETTER`/`CANCELLED`), Berlanggan webhook totals, and paginated workspace metrics without exposing raw tenant content, plaintext TINs, or source files.
- **Consent-Based Audited Support Access (`/api/workspaces/support-access`, `/api/admin/support-access`, [support-access-panel.tsx](file:///c:/Users/MShubkhi/Downloads/dani_coding/roc_tax/apps/web/src/components/reports/support-access-panel.tsx)):** Tenant `OWNER`/`ADMIN` members can grant or revoke time-boxed (15–120 min) support access grants and review access audits. Superadmin diagnostic inspection (`inspectTenantSupport`) fails closed (`SUPPORT_ACCESS_GRANT_REQUIRED` / `SUPPORT_ACCESS_EXPIRED`) without an active grant, records immutable `SupportAccessAudit` + tenant `WorkspaceAudit` entries, and exposes only redacted status diagnostics.

## Database migrations

Yes: `202611160010_reconciliation_superadmin_support`.

Adds `CORETAX_SUBMITTED` to `CoretaxOutcomeStatus`, adds `accountHint`, `portalTimestamp`, `evidenceSha256` to `XmlExportOutcome`, creates `SupportAccessStatus`, `SupportAccessGrant`, and `SupportAccessAudit`, and applies `BEFORE UPDATE` immutability trigger `support_access_audit_immutable`.

## Security

- Tenant reconciliation queries and CSV exports derive `organizationId` strictly from verified active workspace membership (`withActive`).
- Superadmin console endpoints fail closed (`403 FORBIDDEN`) for all non-`SUPERADMIN` users and never expose customer invoice descriptions, encrypted/plaintext tax IDs, or document binaries by default.
- Superadmin tenant diagnostic inspection strictly requires a valid active `SupportAccessGrant` issued by the tenant's `OWNER`/`ADMIN`, enforces expiration server-side via PostgreSQL `clock_timestamp()`, and logs every inspection to immutable audit tables.

## Executed verification

Verified against isolated PostgreSQL 17.11 (`serentax_test`), Next.js production build, and Playwright desktop/mobile E2E runners.

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160010_reconciliation_superadmin_support/migration.sql`
- `README.md`
- `apps/web/src/lib/export/bppu-spec.ts`
- `apps/web/src/lib/intake/schemas.ts`
- `apps/web/src/lib/reports/schemas.ts`
- `apps/web/src/server/export/service.ts`
- `apps/web/src/server/reports/service.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/reports/reconciliation/route.ts`
- `apps/web/src/app/api/reports/reconciliation/export/route.ts`
- `apps/web/src/app/api/workspaces/support-access/route.ts`
- `apps/web/src/app/api/admin/overview/route.ts`
- `apps/web/src/app/api/admin/support-access/route.ts`
- `apps/web/src/app/[locale]/app/reconciliation/page.tsx`
- `apps/web/src/app/[locale]/admin/page.tsx`
- `apps/web/src/app/[locale]/admin/jobs/page.tsx`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/components/account/overview.tsx`
- `apps/web/src/components/account/workspace.tsx`
- `apps/web/src/components/export/exports-view.tsx`
- `apps/web/src/components/reports/reconciliation-view.tsx`
- `apps/web/src/components/reports/admin-overview.tsx`
- `apps/web/src/components/reports/support-access-panel.tsx`
- `apps/web/src/i18n/exports.ts`
- `apps/web/src/i18n/reports.ts`
- `apps/web/src/i18n/site.ts`
- `tests/unit/reports.test.ts`
- `tests/integration/reports.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/10_BATCH_REPORT.md`

## Open items & next batch

- Production hardening, legal/compliance audit (`10_SECURITY_LEGAL.md` & `11_TEST_AND_ACCEPTANCE.md` scope once supplied/audited), deployment/rollback runbook, operations checklist, and launch blocker sign-off belong to Batch 11.
- External Tax SME rule approvals, remaining DJP XML templates, Berlanggan SaaS licensing confirmation, external OCR vendor setup, and host Docker/WSL2 IT policy remain open.
- Next batch: **11 — Security/Legal Hardening & Production Readiness**. Stop here and await explicit instruction.
