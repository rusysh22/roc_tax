# Batch 04 — Company, Counterparty & Transaction Intake

Date: 2026-11-16. Scope: Batch 04 only. Docker investigation deferred at the user's request.

## Implemented

- **Company tax profiles (`/[locale]/app/companies`, `/api/companies`):** Tenant-scoped legal entities and branches with optional structural NPWP (15/16 digits) and NITKU (22 digits), AES-256-GCM encryption at rest with tenant+field AAD, HMAC-SHA256 blind indexes for duplicate NITKU prevention within a workspace, 4-digit masked hints in the UI, and archive/restore controls restricted to `OWNER`/`ADMIN`.
- **Counterparties (`/[locale]/app/counterparties`, `/api/counterparties`):** Tenant-scoped vendors/customers (`VENDOR`, `CUSTOMER`, `BOTH`) with structural `NPWP`, `NIK`, `FOREIGN_TIN`, or `NONE` validation, encrypted tax IDs, duplicate tax-ID prevention, normalized-name duplicate warnings, and search/pagination. Mutations require `OWNER`, `ADMIN`, or `PREPARER`.
- **Manual tax-neutral transaction wizard (`/[locale]/app/transactions/new`, `/api/transactions`):** Guided intake for `SUPPLIER_INVOICE` and `SALES_INVOICE` in `IDR`, exact bigint fixed-point line calculations (`Decimal(18,4)` × `Decimal(20,2)` → `Decimal(20,2)` with `LINE_PRECISION` rejection when sub-cent rounding would be required), pre-save duplicate checking, explicit duplicate acknowledgement, and optional source invoice upload. `PPH21_*` and `PPH26_BP26` families are visibly locked because invoice-only inference is invalid. No tax rates, object codes, or XML tags are calculated or fabricated.
- **Atomic trial quota wiring:** Every manual draft creation executes through Batch 02's `trialService.create`. Validation failures and unacknowledged duplicate warnings abort inside the database transaction callback before any `TrialUsage` receipt is committed. Idempotent retries return the original transaction ID without double-spending quota; edits, comments, attachments, and voiding never consume or refund quota.
- **Transaction list & detail (`/[locale]/app/transactions`, `/[locale]/app/transactions/[id]`):** Filterable/searchable/paginated list with duplicate badges; detail view with optimistic version-locked draft revisions, irreversible `VOIDED` transition with reason, comments, append-only before/after `TransactionEvent` history, and tenant-scoped private source document upload, inline preview, and download.
- **Private source document storage & validation (`/api/transactions/[id]/documents`):** Streaming byte limit (10 MB), strict agreement between declared MIME (`application/pdf`, `image/png`, `image/jpeg`), file extension, and magic bytes, filename sanitization, SHA-256 deduplication per transaction, storage outside the web root, authenticated delivery with `X-Content-Type-Options: nosniff` and sandbox CSP, and honest `NOT_SCANNED` malware status.

## Database migrations

Yes: `202611160003_intake`.

Creates enums (`CounterpartyKind`, `TaxIdentityType`, `TaxFamily`, `TransactionDocumentType`, `TransactionSource`, `TransactionStatus`) and tables (`Company`, `Counterparty`, `Transaction`, `TransactionLine`, `SourceDocument`, `TransactionComment`, `TransactionEvent`) with composite `(id, organizationId)` foreign keys, non-negative amount/quantity checks, tax-period format check, and `BEFORE UPDATE` triggers preventing modifications to `TransactionEvent` and `TransactionComment`.

## Security

- Session and active workspace are resolved server-side via Better Auth and database locks (`Organization` then `User`); no client-supplied `organizationId`, `userId`, or `payloadFingerprint` is accepted.
- Same-origin `Origin` check on every `POST` route; streaming byte limits on JSON and binary bodies.
- Cross-tenant references between `Transaction` and `Company`/`Counterparty`/`SourceDocument`/`TransactionLine` are blocked both in service queries and by composite database foreign keys.
- Tax IDs are encrypted at rest and never returned in plaintext by API endpoints.

## Executed verification

| Command                                    | Result                                                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate`                       | Applied `202611160003_intake` cleanly on isolated PostgreSQL 17.11 (`serentax_test`).                                                                                                                                                                   |
| `npm run db:validate` / `npm run db:check` | Schema valid; database connectivity verified.                                                                                                                                                                                                           |
| `npm run format:check`                     | Passed.                                                                                                                                                                                                                                                 |
| `npm run lint`                             | Passed, 0 warnings.                                                                                                                                                                                                                                     |
| `npm run typecheck`                        | Passed (`next typegen`, `tsc --noEmit`, `tsc -p tsconfig.tools.json`).                                                                                                                                                                                  |
| `npm test`                                 | 4 files, 20 unit tests passed.                                                                                                                                                                                                                          |
| `npm run test:integration`                 | 3 files, 24 integration tests passed on real PostgreSQL (5 intake + 12 trial + 7 access).                                                                                                                                                               |
| `npm run build`                            | Production standalone build succeeded with zero warnings.                                                                                                                                                                                               |
| `npm run test:e2e`                         | 8 desktop/mobile public and anonymous-access tests passed.                                                                                                                                                                                              |
| `npm run test:e2e:auth`                    | 1 end-to-end authenticated browser lifecycle passed (signup, SMTP verification, trial activation, workspace/team, company creation, counterparty creation, manual transaction draft creation, PDF upload, comment, session revocation, password reset). |

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160003_intake/migration.sql`
- `.env.example`
- `.gitignore`
- `README.md`
- `apps/web/src/lib/release.ts`
- `apps/web/src/lib/intake/decimal.ts`
- `apps/web/src/lib/intake/identity.ts`
- `apps/web/src/lib/intake/state.ts`
- `apps/web/src/lib/intake/schemas.ts`
- `apps/web/src/server/http.ts`
- `apps/web/src/server/intake/crypto.ts`
- `apps/web/src/server/intake/documents.ts`
- `apps/web/src/server/intake/storage.ts`
- `apps/web/src/server/intake/service.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/companies/route.ts`
- `apps/web/src/app/api/counterparties/route.ts`
- `apps/web/src/app/api/transactions/route.ts`
- `apps/web/src/app/api/transactions/[id]/route.ts`
- `apps/web/src/app/api/transactions/[id]/documents/route.ts`
- `apps/web/src/app/api/transactions/[id]/documents/[documentId]/route.ts`
- `apps/web/src/app/[locale]/app/[section]/page.tsx`
- `apps/web/src/app/[locale]/app/companies/page.tsx`
- `apps/web/src/app/[locale]/app/counterparties/page.tsx`
- `apps/web/src/app/[locale]/app/transactions/page.tsx`
- `apps/web/src/app/[locale]/app/transactions/new/page.tsx`
- `apps/web/src/app/[locale]/app/transactions/[id]/page.tsx`
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/components/account/overview.tsx`
- `apps/web/src/components/intake/client.ts`
- `apps/web/src/components/intake/companies.tsx`
- `apps/web/src/components/intake/counterparties.tsx`
- `apps/web/src/components/intake/transactions-list.tsx`
- `apps/web/src/components/intake/transaction-new.tsx`
- `apps/web/src/components/intake/transaction-detail.tsx`
- `apps/web/src/i18n/intake.ts`
- `apps/web/src/i18n/site.ts`
- `apps/web/src/i18n/trial.ts`
- `apps/web/src/i18n/account.ts`
- `tests/unit/intake.test.ts`
- `tests/integration/intake.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/04_BATCH_REPORT.md`

## Open items & next batch

- Missing specifications 05–11, dedicated production KMS/key-rotation for `TAX_DATA_KEY`, malware scanner integration for uploaded documents, foreign-currency exchange-rate policy (Kurs KMK), debit/credit memo rules, official DJP XML templates, tax SME rule catalog, and Berlanggan SaaS licensing confirmation remain open.
- Next batch: **05 — Spreadsheet Import & Batch Preview**. Stop here and await explicit instruction.
