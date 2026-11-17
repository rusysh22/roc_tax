# Batch 05 — Spreadsheet Import & Batch Preview

Date: 2026-11-17. Scope: Batch 05 only.

## Implemented

- **Tax-neutral CSV & XLSX templates (`GET /api/imports/template`):** Authenticated download of `.csv` and `.xlsx` templates per selectable intake family (`UNCLASSIFIED`, `PPH_UNIFIKASI_BPPU`, `PPN_FAKTUR_KELUARAN`, `PPH_UNIFIKASI_BPNR`) with canonical headers and clearly labeled synthetic example rows.
- **Safe zero-dependency CSV & XLSX parser (`apps/web/src/server/intake/spreadsheet.ts`):** Strict UTF-8 RFC-4180 CSV parser and OpenXML `.xlsx` reader (`xl/worksheets/sheet1.xml` + `xl/sharedStrings.xml`) using Node's built-in `node:zlib`, bounded to 2 MB file size, 8 MB decompressed XML, 64 ZIP entries, 200 rows, and 32 columns. Rejects mismatched magic bytes/extensions (`SPREADSHEET_FORMAT`), malformed structures (`SPREADSHEET_MALFORMED`), and XML `DOCTYPE`/`ENTITY` declarations (`SPREADSHEET_UNSAFE_XML`).
- **Formula-injection & formula-execution defenses:** Never evaluates spreadsheet formulas. Rejects XLSX `<f>` formula tags and any cell value starting with `=`, `+`, `-`, `@`, tab, CR, or LF (`FORMULA_INJECTION`). Prefixes exported template and error-report cells starting with those characters with `'`.
- **Row mapping, preview & error report (`POST /api/imports` with `X-Import-Action: preview`, `/[locale]/app/imports`):** Auto-detects English and Indonesian column headers, lets Preparers remap columns and re-run preview, validates every row (company, counterparty by encrypted tax-ID blind index or normalized name, role vs document type, blocked PPh21/PPh26 families, dates, periods, exact 2-decimal `quantity × unitPrice`, in-file duplicates, and workspace duplicate warnings), and provides a one-click sanitized `.csv` error report download.
- **Up-front quota enforcement & idempotent batch commit (`POST /api/imports` with `X-Import-Action: commit`):** Enforces exact trial allowance before persisting. When a file has `> 1` valid row under the 1/day trial rule, the preview and commit endpoints block with `TRIAL_SINGLE_ROW_LIMIT` and explain that multiple rows cannot all be created at once—never performing partial or hidden overrides. Valid single-row imports execute inside `trialService.create`, persisting `ImportBatch`, `Transaction` (`source: "SPREADSHEET"`), `TransactionLine`, `TransactionEvent` (`DRAFT_IMPORTED`), and `WorkspaceAudit` (`IMPORT_BATCH_COMMITTED`) in one atomic transaction.
- **Immutable import batch history (`GET /api/imports`):** Displays workspace-scoped import history (timestamp, file name, format, SHA-256 prefix, total/valid/invalid/created counts, and link to the created draft).

## Database migrations

Yes: `202611160004_spreadsheet_import`.

Adds `ImportFormat` (`CSV`, `XLSX`), `ImportBatch`, and `Transaction.importBatchId` with composite `(id, organizationId)` foreign keys, `(organizationId, idempotencyKey)` uniqueness, non-negative count constraints, and a `BEFORE UPDATE` trigger (`import_batch_immutable`) enforcing append-only batch history.

## Security

- Session, verified email, active workspace, and `draft.prepare` permission (for preview/commit) are revalidated server-side under `Organization` and `User` row locks; `Origin` header is checked on all `POST` requests.
- Cross-tenant company references and cross-tenant batch reads fail closed; composite foreign keys enforce tenant isolation at the PostgreSQL level.
- Counterparty tax-ID matching uses the tenant-scoped HMAC-SHA256 blind index without decrypting all rows or exposing plaintext tax IDs.

## Executed verification

| Command                                    | Result                                                                                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate`                       | Applied `202611160004_spreadsheet_import` cleanly on isolated PostgreSQL 17.11 (`serentax_test`).                                                                             |
| `npm run db:validate` / `npm run db:check` | Schema valid; database connectivity verified.                                                                                                                                 |
| `npm run format:check`                     | Passed.                                                                                                                                                                       |
| `npm run lint`                             | Passed, 0 warnings.                                                                                                                                                           |
| `npm run typecheck`                        | Passed (`next typegen`, `tsc --noEmit`, `tsc -p tsconfig.tools.json`).                                                                                                        |
| `npm test`                                 | 5 files, 24 unit tests passed (including CSV/XLSX round-trip, formula neutralization, `<f>` detection, and XXE rejection).                                                    |
| `npm run test:integration`                 | 4 files, 27 integration tests passed on real PostgreSQL (3 spreadsheet import + 5 intake + 12 trial + 7 access).                                                              |
| `npm run build`                            | Production standalone build succeeded with zero warnings.                                                                                                                     |
| `npm run test:e2e`                         | 8 desktop/mobile public and anonymous-access tests passed (including `/api/imports` and `/api/imports/template` fail-closed checks).                                          |
| `npm run test:e2e:auth`                    | 1 end-to-end authenticated browser lifecycle passed (including XLSX template download and mixed valid/formula CSV preview showing `DAILY_LIMIT` after manual draft creation). |

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160004_spreadsheet_import/migration.sql`
- `README.md`
- `apps/web/src/lib/intake/spreadsheet.ts`
- `apps/web/src/server/intake/spreadsheet.ts`
- `apps/web/src/server/intake/imports.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/imports/route.ts`
- `apps/web/src/app/api/imports/template/route.ts`
- `apps/web/src/app/[locale]/app/[section]/page.tsx`
- `apps/web/src/app/[locale]/app/imports/page.tsx`
- `apps/web/src/components/intake/imports.tsx`
- `apps/web/src/i18n/imports.ts`
- `apps/web/src/i18n/site.ts`
- `tests/unit/spreadsheet.test.ts`
- `tests/integration/imports.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/05_BATCH_REPORT.md`

## Open items & next batch

- Missing specifications 05–11, multi-line invoice grouping in spreadsheet imports, paid-plan multi-row batch quota semantics (pending Berlanggan SaaS licensing confirmation in Batch 09), official DJP XML templates, and tax SME rule catalog remain open.
- Next batch: **06 — Configurable AI OCR Provider**. Stop here and await explicit instruction.
