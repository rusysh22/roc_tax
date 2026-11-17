# Batch 06 — Configurable AI OCR Provider

Date: 2026-11-17. Scope: Batch 06 only.

## Implemented

- **Pluggable OCR adapter contract (`apps/web/src/server/ocr/adapter.ts`):** Supports `NONE` (default), `SYNTHETIC_TEST` (local deterministic no-egress adapter for automated testing), and `EXTERNAL_NOT_CONFIGURED` (explicit fail-closed `OCR_NOT_CONFIGURED` state until an official vendor contract and credentials are configured).
- **Platform Superadmin provider registry (`/[locale]/admin/ocr-providers`, `/api/admin/ocr-providers`):** Protected server-side in both `admin/layout.tsx` and API routes by `User.platformRole === "SUPERADMIN"` (default `NONE`, never auto-assigned). Configures provider slug, adapter key, SSRF-validated HTTPS endpoint URL, server-only `secretRef` env var name, model, region, max pages, timeout, monthly tenant page/spend caps, retention policy, processor notice, `vendorApproved`, and `enabled`, plus aggregate job health counts without customer PII.
- **Workspace OCR settings (`/[locale]/app/settings/ocr`, `/api/ocr/settings`):** Workspaces default to `NONE · Manual & spreadsheet entry only`. `OWNER`/`ADMIN` can select an approved, enabled platform provider and must record explicit `externalAiConsent`. Displays monthly page/spend usage and honest `NOT_CONFIGURED` / `NONE_MANUAL` boundaries.
- **Asynchronous job queue, retries & dead letter (`apps/web/src/server/ocr/service.ts`):** Uses PostgreSQL `FOR UPDATE SKIP LOCKED` with single-active-job-per-document uniqueness (`OcrJob_active_document_key`), timeout racing, exponential backoff (`FAILED_RETRYABLE`), `DEAD_LETTER` transition (restoring `Transaction.status` to `DRAFT`), manual dead-letter retry, and `fallback` to manual entry. OCR never consumes `TrialUsage` quota.
- **Prompt-injection neutralization & side-by-side correction UI (`/api/transactions/[id]/ocr`, `apps/web/src/components/ocr/transaction-ocr.tsx`):** Displays candidate values (raw vs normalized), confidence scores (`0..1` or `unknown`), spans, and provider/model/version provenance beside the document viewer; strips markup/control chars and neutralizes prompt-injection directives (`promptInjectionDetected`); requires explicit verification checkbox before applying low-confidence Tax ID, currency, or monetary fields; and records before/after diffs with provenance in append-only `TransactionEvent` rows.

## Database migrations

Yes: `202611160005_ocr_provider` and `202611160006_user_platform_role`.

Adds `PlatformRole` (`NONE`, `SUPERADMIN`) on `User`, `OcrAdapterKey`, `OcrJobStatus`, `OcrProviderConfig`, `OrganizationOcrSetting`, `OcrJob`, `OcrCandidate`, composite `(id, organizationId)` foreign keys, bounds `CHECK` constraints, and partial unique index `OcrJob_active_document_key`.

## Security

- Superadmin endpoints and layouts fail closed (`403 FORBIDDEN`) for all `platformRole !== "SUPERADMIN"` users; signup never assigns `SUPERADMIN`.
- No API key or secret is stored in PostgreSQL or returned to browsers; `secretRef` holds only an env var name resolved server-side.
- Endpoint URLs reject non-HTTPS, embedded credentials, query/hash, loopback, private, link-local, and metadata IP ranges against SSRF.
- No document is sent to external AI without `vendorApproved`, `enabled`, and recorded tenant `externalAiConsent`. Error messages are redacted to safe codes with zero PII or raw payload leakage.
- Cross-tenant OCR settings, job enqueues, retries, and candidate applications fail closed.

## Executed verification

| Command                                    | Result                                                                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate`                       | Applied `202611160005_ocr_provider` and `202611160006_user_platform_role` cleanly on isolated PostgreSQL 17.11 (`serentax_test`).                                                                                         |
| `npm run db:validate` / `npm run db:check` | Schema valid; database connectivity verified.                                                                                                                                                                             |
| `npm run format:check`                     | Passed.                                                                                                                                                                                                                   |
| `npm run lint`                             | Passed, 0 warnings.                                                                                                                                                                                                       |
| `npm run typecheck`                        | Passed (`next typegen`, `tsc --noEmit`, `tsc -p tsconfig.tools.json`).                                                                                                                                                    |
| `npm test`                                 | 6 files, 29 unit tests passed (including `NONE`/`EXTERNAL_NOT_CONFIGURED` fail-closed, SSRF checks, secretRef validation, prompt-injection sanitization, low-confidence gates, and bilingual dictionary parity).          |
| `npm run test:integration`                 | 5 files, 30 integration tests passed on real PostgreSQL (3 OCR + 3 imports + 5 intake + 12 trial + 7 access).                                                                                                             |
| `npm run build`                            | Production standalone build succeeded with zero warnings.                                                                                                                                                                 |
| `npm run test:e2e`                         | 8 desktop/mobile public and anonymous-access tests passed (including `/api/ocr/settings` and `/api/admin/ocr-providers`).                                                                                                 |
| `npm run test:e2e:auth`                    | 1 full authenticated browser lifecycle passed (including `403` verification on `/api/admin/ocr-providers` and `/en/admin/ocr-providers`, `/en/app/settings/ocr` showing `NONE_MANUAL`, and transaction detail OCR panel). |

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160005_ocr_provider/migration.sql`
- `prisma/migrations/202611160006_user_platform_role/migration.sql`
- `README.md`
- `apps/web/src/lib/release.ts`
- `apps/web/src/lib/intake/ocr.ts`
- `apps/web/src/server/ocr/adapter.ts`
- `apps/web/src/server/ocr/service.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/admin/ocr-providers/route.ts`
- `apps/web/src/app/api/ocr/settings/route.ts`
- `apps/web/src/app/api/transactions/[id]/ocr/route.ts`
- `apps/web/src/app/[locale]/admin/layout.tsx`
- `apps/web/src/app/[locale]/admin/ocr-providers/page.tsx`
- `apps/web/src/app/[locale]/app/settings/ocr/page.tsx`
- `apps/web/src/components/account/workspace.tsx`
- `apps/web/src/components/intake/transaction-detail.tsx`
- `apps/web/src/components/ocr/admin-providers.tsx`
- `apps/web/src/components/ocr/org-settings.tsx`
- `apps/web/src/components/ocr/transaction-ocr.tsx`
- `apps/web/src/i18n/ocr.ts`
- `apps/web/src/i18n/site.ts`
- `tests/unit/ocr.test.ts`
- `tests/integration/ocr.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/06_BATCH_REPORT.md`

## Open items & next batch

- Live external OCR vendor selection, signed data-processing agreement (DPA), and server credentials remain open (production external OCR remains `NOT_CONFIGURED`).
- Missing specifications 05–11, official DJP XML templates, tax SME rule catalog, and Berlanggan SaaS licensing compatibility remain open.
- Next batch: **07 — Tax Classification, Rule Engine & Review Workflow**. Stop here and await explicit instruction.
