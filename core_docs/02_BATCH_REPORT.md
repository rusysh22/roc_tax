# Batch 02 — Trial 72h + Atomic Usage Quota

Date: 2026-11-16. Batch 02 only. Docker investigation deferred at the user's explicit request.

## Implemented

- Once-only activation for a verified account. Database clock sets activation and expiry exactly 72 hours apart. Repeated activation, including after expiration, returns the original record.
- Atomic server-side allowance: at most one new successfully persisted draft per Asia/Jakarta calendar date, and three over the lifetime trial, across all organizations. Locks, database uniqueness and bounded lifetime slots provide overlapping safeguards.
- Account-global idempotency keys bound to workspace and normalized-payload fingerprint. Successful retries return the original receipt ID without another insert. Payload/workspace mismatches fail. Draft editing/deletion and organization deletion do not refund usage.
- Draft persistence, usage receipt and audit event commit in one transaction. Persistence failure or expiration during persistence rolls back all writes. Roles, verified account, session and selected workspace are rechecked before creation or receipt replay.
- Authenticated `/api/trial` status and explicit activation endpoints; bounded strict input and same-origin POST checks. There is no public trial-draft creation endpoint.
- Bilingual dashboard trial panel: server-based countdown, daily/total allowance, precise WIB expiry, next Jakarta daily window, expired/exhausted/error states and honest unavailable-billing/intake notices. Activation is explicit because transaction intake is not released yet.
- Test-only neutral draft table/persistence fixture. This table is absent from production migrations and UI; no fake tax output or production data was introduced.
- UTC connection configuration for every application, script and test PostgreSQL pool. A real timezone round-trip regression was found and fixed during the batch.

## Database migrations

Yes: `202611160002_trial_quota`.

Adds `TrialAccount` and `TrialUsage`. Unique account/day, account/idempotency key, account/slot and transaction receipt indexes; slots restricted to 1–3; exact 72-hour duration and Jakarta-date consistency checks. Database triggers reject updates to activation/usage rows. Foreign keys restrict deleting trial/account records with usage. There is deliberately no draft/organization foreign key that could cascade away usage.

Migration applied successfully to isolated real PostgreSQL 17.11. No customer database modified. `test_trial_draft` is created only by the integration suite in an explicitly isolated `_test` database.

No new environment variables or npm dependencies. Apply with `npm run db:migrate`. Do not roll back by dropping usage records while trials exist: that could reset allowances. If rollback is required, stop trial operations and restore a reviewed backup or disable the new routes while retaining the ledger; destructive down migrations are intentionally not provided.

## Security and decisions

- Actor is resolved from Better Auth, never request body. Activation/status reread account verification and session. Creation/replay also require selected-workspace membership and `draft.prepare`; current Owner/Admin roles do not bypass this permission.
- Organization then account lock order matches workspace operations. Account lock is shared across organizations. Authorization is revalidated after locks; no client countdown or quota value is trusted.
- Persistence callbacks are trusted internal code only. They must validate/normalize the full draft, compute its fingerprint server-side and use the supplied database transaction. No external network operations inside the transaction. Future intake/import/job implementations must reuse this service; accepting a client-provided fingerprint would violate its contract.
- Successful receipt replay remains available after expiry/deletion only after authorization; it never recreates a missing record. No trial/ledger reset/delete API is exposed.
- Remaining total allowance can still show unused slots after expiry, but daily usable allowance is zero and state is expired. Reads and account management remain available; new trial-funded transaction creation is denied. Paid/export policies are still outside this batch.
- Native PostgreSQL defaulted to Asia/Bangkok. The installed Prisma pg adapter shifted timestamps under that session timezone; a fixture caught the discrepancy. Shared connection configuration now forces UTC. SQL regression verifies timestamp versus epoch and known Jakarta date conversion. No attempt was made to reinterpret existing real data.

## Executed verification

| Command                                   | Final result                                                                                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate`                      | `All migrations have been successfully applied.`                                                                                                                 |
| `npx prisma format`                       | Schema formatted successfully.                                                                                                                                   |
| `npm run db:validate`                     | Prisma schema valid.                                                                                                                                             |
| `npm run db:check`                        | `Database connectivity verified`.                                                                                                                                |
| `npm run format` / `npm run format:check` | Formatting applied and checked.                                                                                                                                  |
| `npm run lint`                            | Exit 0, no warnings.                                                                                                                                             |
| `npm run typecheck`                       | Exit 0, strict app and test/tooling checks.                                                                                                                      |
| `npm test`                                | 3 files, 13 tests passed.                                                                                                                                        |
| `npm run test:integration`                | 2 files, 19 tests passed (12 trial + 7 existing account/workspace).                                                                                              |
| `npm run build`                           | Successful standalone build; `/api/trial` is dynamic.                                                                                                            |
| `npm run test:e2e`                        | 6 desktop/mobile public tests passed.                                                                                                                            |
| `npm run test:e2e:auth`                   | 1 full browser lifecycle passed, including trial activation, repeat activation, persistence across reload, foreign-origin rejection and injected-user rejection. |
| `npm audit`                               | `found 0 vulnerabilities`.                                                                                                                                       |

Key database cases: 10 simultaneous activations create one trial; 10 distinct creates across two workspaces commit exactly one draft/receipt; 10 same-key retries produce one creation; total usage cannot exceed slot 3; wrong-role/revoked actors fail; draft/organization deletion does not refund; altered idempotency input fails; unactivated/expired trials fail; failure after draft insert rolls back; expiry during a deliberately delayed insert rolls back. Fixed UTC timestamp regression is tested on a database with a non-UTC default.

Unit cases cover Jakarta midnight (17:00 UTC), year boundary, exact expiry millisecond, lifetime allowance across four possible local dates, daily refill without total refill, and no next window beyond trial expiry. No injected production clock or client-side quota enforcement was used.

The first integration run exposed the timezone issue. After correction, the slow-persistence fixture was corrected to use a non-result SQL sleep command because Prisma cannot deserialize PostgreSQL `void`; the test asserts that persistence actually ran before expiration rolled it back. Final tests passed after both corrections.

Browser mobile screenshot (390px viewport) inspected: countdown/quota/expiry and account controls fit without horizontal overflow. Synthetic identities only; SMTP mail captured locally. No external email or Docker checks performed. Remote CI and containers remain unverified; existing CI automatically discovers the new migration and unit/integration files.

The isolated native PostgreSQL test server was stopped after verification. Its ignored synthetic data remains available for future test runs.

## Manual QA and open items

1. Apply migrations, configure account services and sign in with a verified development account. The trial panel initially shows not activated.
2. Read the warning that intake is not released, activate, and verify approximately 72 hours, daily 1/1, total 3/3 and WIB expiry with seconds. Reload and switch workspaces: activation/expiry must not restart.
3. Test Indonesian and English, keyboard access, mobile width, connection failure/reload, and tab focus refresh. The server is authoritative even if browser time differs.
4. Use `TEST_DATABASE_URL` ending in `_test` and `npm run test:integration` for quota creation scenarios. Do not expose the synthetic fixture as production intake.

Docker is explicitly deferred. Missing specs 05–11, production SMTP/hosting, privileged MFA, legal retention/deletion policy, tax SME/templates and billing compatibility remain open. Actual draft intake and wiring the internal quota callback belong to Batch 04; billing remains fail-closed. Review the single-role Owner/Preparer policy before introducing sole-user intake; this batch retains Batch 01 permissions rather than inventing extra privileges.

## Files changed

```text
README.md
prisma/schema.prisma
prisma/migrations/202611160002_trial_quota/migration.sql
apps/web/src/server/postgres.ts
apps/web/src/server/database.ts
apps/web/src/server/trial/state.ts
apps/web/src/server/trial/service.ts
apps/web/src/app/api/trial/route.ts
apps/web/src/components/account/trial-strip.tsx
apps/web/src/components/account/workspace.tsx
apps/web/src/i18n/trial.ts
apps/web/src/i18n/account.ts
apps/web/src/i18n/messages.ts
scripts/check-database.ts
tests/unit/trial.test.ts
tests/integration/trial.test.ts
tests/integration/access.test.ts
tests/e2e/auth.spec.ts
tests/e2e/public.spec.ts
core_docs/03_MEMORY.md
core_docs/13_DECISIONS_AND_OPEN_ITEMS.md
core_docs/02_BATCH_REPORT.md
```

Generated client/build/screenshots and local diagnostic files are ignored, not deliverable source. Supplied original master/PRD/batch prompts remain unchanged.

## Next batch

03 — Design System, Marketing & Core App Shell. Stop here and await the next explicit batch request.
