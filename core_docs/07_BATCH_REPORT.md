# Batch 07 — Tax Classification, Rule Engine & Review Workflow

Date: 2026-11-17. Scope: Batch 07 only.

## Implemented

- **Versioned, effective-dated Tax Rule Registry (`/[locale]/admin/tax-rules`, `/api/admin/tax-rules`, `apps/web/src/server/tax/service.ts`):** Guarded server-side by `User.platformRole === "SUPERADMIN"`. Supports creating `DRAFT` rules (`taxFamily`, `ruleCode`, `version`, `validFrom`/`validTo`, rational `rateNumerator`/`rateDenominator`, documented `TaxRoundingMode` `HALF_UP`/`HALF_EVEN`/`DOWN`/`UP`, `regulationRef`, counterparty ID/payroll/treaty flags, and `isNonProductionTest`) and advancing `DRAFT` -> `SME_APPROVED` (requiring `smeReviewedBy` and `smeReviewedAt`, blocked for `NON_PRODUCTION_TEST` fixtures) -> `RETIRED`. Zero unverified Indonesian statutory tax codes or tariffs are seeded.
- **Deterministic fixed-point tax engine (`apps/web/src/server/tax/engine.ts`, `apps/web/src/lib/intake/tax-rules.ts`):** Evaluates `subtotalMinor` using `bigint` rational arithmetic and the rule's declared rounding mode, enforces `UNCLASSIFIED`, effective-date, and counterparty identity blockers, explicitly blocks `PPH21` without structured payroll data and `PPH26` without treaty/SKD (`Form DGT`) data, and computes field-level calculation diffs (`diffFromPrevious`) against the latest prior evaluation.
- **Per-workspace segregation policy & transaction review workflow (`/api/tax/policy`, `/api/transactions/[id]/review`, `apps/web/src/components/tax/transaction-review.tsx`, `apps/web/src/components/account/workspace.tsx`):**
  - Default `STRICT_SEPARATION` enforces that the approver differs from the preparer and submitter (`SEGREGATION_VIOLATION`), while `SOLE_USER_EXCEPTION` (configured by `OWNER`/`ADMIN`) requires explicit warning acknowledgement (`soleUserAck`) and logs `soleUserExceptionUsed`.
  - Supports `evaluate`, `submit`, `request_changes`, `approve`, and controlled `reopen` (`APPROVED` -> `CHANGES_REQUESTED`, preserving `canTransition("APPROVED", "DRAFT") === false`), revision locking (`REVISION_CONFLICT`), stale evaluation checks (`STALE_EVALUATION`), and append-only `TransactionEvent` + `WorkspaceAudit` records.
  - `approve` strictly rejects `NON_PRODUCTION_TEST` or non-`SME_APPROVED` evaluations (`PRODUCTION_RULE_UNVERIFIED`) and freezes an immutable `TaxEvaluationSnapshot` containing full rule metadata, inputs, evidence, rounding mode, and totals that survives subsequent rule updates/retirements.

## Database migrations

Yes: `202611160007_tax_rules_review`.

Adds `TaxRuleStatus`, `TaxRoundingMode`, `SegregationPolicy`, `TaxRule`, `OrganizationTaxPolicy`, `TransactionTaxInput`, `TaxEvaluation`, `TaxEvaluationSnapshot`, `Transaction.lastSubmittedBy`, `Transaction.lastReviewedBy`, composite foreign keys, rational-rate & date `CHECK` constraints, and immutable `BEFORE UPDATE` triggers on `TaxEvaluation` and `TaxEvaluationSnapshot`.

## Security

- Superadmin endpoints and pages (`/api/admin/tax-rules`, `/[locale]/admin/tax-rules`) fail closed with `403 FORBIDDEN` when `platformRole !== "SUPERADMIN"`.
- Cross-tenant rule evaluation, tax policy updates, and review actions fail closed with `403 FORBIDDEN` / `404`.
- `OrganizationTaxPolicy` updates are restricted to `OWNER`/`ADMIN`; review/approval commands enforce workspace RBAC (`PREPARER` submit, `REVIEWER`/`APPROVER` request changes, `APPROVER` approve/reopen) without implicit `OWNER`/`ADMIN` privilege escalation.
- Production approval (`APPROVED`) strictly requires an `SME_APPROVED` production rule; `NON_PRODUCTION_TEST` fixture evaluations remain labeled `NON_PRODUCTION` and blocked from production approval.

## Executed verification

| Command                                    | Result                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run db:migrate`                       | Applied `202611160007_tax_rules_review` cleanly on isolated PostgreSQL 17.11 (`serentax_test`).                                                                                                                                |
| `npm run db:validate` / `npm run db:check` | Schema valid; database connectivity verified.                                                                                                                                                                                  |
| `npm run format:check`                     | Passed.                                                                                                                                                                                                                        |
| `npm run lint`                             | Passed, 0 warnings.                                                                                                                                                                                                            |
| `npm run typecheck`                        | Passed (`next typegen`, `tsc --noEmit`, `tsc -p tsconfig.tools.json`).                                                                                                                                                         |
| `npm test`                                 | 7 files, 33 unit tests passed (including `bigint` rounding modes, PPh 21/26 missing-data blockers, `NON_PRODUCTION_TEST` isolation, `APPROVED -> DRAFT` rejection vs controlled `APPROVED -> CHANGES_REQUESTED`, i18n parity). |
| `npm run test:integration`                 | 6 files, 32 integration tests passed on real PostgreSQL (including 2 Batch 07 tax rule/review/segregation/immutable-snapshot tests).                                                                                           |
| `npm run build`                            | Production standalone build succeeded with zero warnings.                                                                                                                                                                      |
| `npm run test:e2e`                         | 8 desktop/mobile public and anonymous-access tests passed (including `/api/tax/policy` and `/api/admin/tax-rules`).                                                                                                            |
| `npm run test:e2e:auth`                    | 1 full authenticated browser lifecycle passed (`403` on `/api/admin/tax-rules` and `/en/admin/tax-rules`, workspace segregation policy UI, and preparer evaluation + blocker UI on transaction detail).                        |

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160007_tax_rules_review/migration.sql`
- `README.md`
- `apps/web/src/lib/release.ts`
- `apps/web/src/lib/intake/state.ts`
- `apps/web/src/lib/intake/tax-rules.ts`
- `apps/web/src/server/tax/engine.ts`
- `apps/web/src/server/tax/service.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/admin/tax-rules/route.ts`
- `apps/web/src/app/api/tax/policy/route.ts`
- `apps/web/src/app/api/transactions/[id]/review/route.ts`
- `apps/web/src/app/[locale]/admin/tax-rules/page.tsx`
- `apps/web/src/components/tax/admin-tax-rules.tsx`
- `apps/web/src/components/tax/transaction-review.tsx`
- `apps/web/src/components/intake/transaction-detail.tsx`
- `apps/web/src/components/account/workspace.tsx`
- `apps/web/src/i18n/tax.ts`
- `apps/web/src/i18n/site.ts`
- `tests/unit/tax.test.ts`
- `tests/integration/tax.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/07_BATCH_REPORT.md`

## Open items & next batch

- Tax SME approval is required before authoring production `SME_APPROVED` rules with real Indonesian tax object codes, tariffs, effective dates, and rounding policies.
- Missing specifications 05–11, official DJP XML templates, Berlanggan SaaS licensing compatibility, external OCR vendor setup, and the host Docker/WSL2 `DenyDeviceClasses` policy remain open.
- Next batch: **08 — Coretax XML Template Registry & First Verified Export**. Stop here and await explicit instruction.
