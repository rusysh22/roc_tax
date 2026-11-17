# Batch 01 — Authentication, Organizations & RBAC

Date: 2026-11-16. Scope: Batch 01 only. No trial activation, paid entitlements, transactions, OCR, tax calculations or XML export added.

## Implemented

- Better Auth 1.7.25 with Prisma/PostgreSQL: email/password signup, verified-email sign-in, resend verification, password recovery/reset, sign-out, session listing and revocation. Password reset revokes existing sessions transactionally. Verification identifiers are hashed; cookie session caching is disabled.
- Bilingual routes `/{locale}/auth/{sign-up,sign-in,verify,forgot,reset}`, protected `/{locale}/app`, and `/{locale}/invite`; profile name editing, workspace creation/selection, team roles and invitations. Loading, empty, configuration-error and access-denied feedback use translation keys. Emails contain Indonesian and English copy from translation resources.
- Explicit roles Owner, Admin, Preparer, Reviewer, Approver. Owner/Admin manage teams; only Owner assigns/modifies Owner/Admin roles. Owner/Admin do not implicitly receive tax approval permissions. No superadmin model, seed or automatic platform privilege.
- Every workspace request authenticates the actual session. The service rereads session, verification and membership; team mutations use the selected workspace from the session. Organization locks serialize membership changes with protected operations. Last-owner removal/demotion is blocked.
- Hashed 256-bit random invitation tokens, verified-email binding, 48-hour expiry, one-time atomic acceptance, issuer authority revalidation, cancellation and revocation. SMTP failure revokes the pending invitation. Invitation links keep the raw token in the URL fragment, removed after reading.
- Workspace audit events for creation, invitation lifecycle, membership removal and role changes. No customer-content or tax data is collected.
- SMTP configuration, loopback Mailpit Compose service, CI migration/integration/browser steps, strict typechecking of test/tooling code, and updated setup documentation.

## Database migrations

Yes: `202611160001_auth_workspaces`.

Creates `User`, `Session`, `Account`, `Verification`, `RateLimit`, `Organization`, `Membership`, `Invitation`, `WorkspaceAudit` and role/status enums. Includes unique email/session/token/member keys, foreign keys and indexes; timestamps use `timestamptz(3)`. Migration applied successfully to an isolated real PostgreSQL 17.11 database. No existing or production database was changed.

Apply with `npm run db:migrate`. This is an additive initial migration. For rollback, stop account traffic and restore the pre-migration database backup if identity data exists; do not casually drop identity tables. No automated destructive down migration is provided.

## Verification

| Command/check                                           | Result                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm install`                                           | Better Auth 1.7.25, Nodemailer 10.5.0 and test dependencies installed with exact versions/lockfile.   |
| `npm run format`                                        | Completed.                                                                                            |
| `npm run lint`                                          | Exit 0, zero warnings.                                                                                |
| `npm run typecheck`                                     | Exit 0: generated client, Next route types, strict app TypeScript and strict test/tooling TypeScript. |
| `npm test`                                              | 2 files passed; 9 tests passed.                                                                       |
| `npm run db:validate`                                   | Prisma schema valid.                                                                                  |
| `npm run db:migrate`                                    | `All migrations have been successfully applied.`                                                      |
| `npm run db:check`                                      | `Database connectivity verified`.                                                                     |
| `npm run test:integration`                              | 1 file passed; 7 tests passed on real PostgreSQL, including per-session workspace switching.          |
| `npm run build`                                         | Successful production standalone build, including dynamic account/auth/workspace routes.              |
| `npm run test:e2e`                                      | 6 passed across desktop/mobile Chromium.                                                              |
| `npm run test:e2e:auth`                                 | Real SMTP and PostgreSQL account lifecycle passed, including session revocation.                      |
| `npm audit`                                             | `found 0 vulnerabilities`.                                                                            |
| `docker compose --env-file .env.example config --quiet` | Exit 0; Compose configuration valid.                                                                  |
| Secret/test-artifact ignore check                       | `.env`, app `.env.local`, local PostgreSQL data and test-runner files ignored.                        |

Final auth browser run: `1 passed (34.3s)`. Desktop and 390px-wide account screenshots were inspected; mobile overflow assertion passed. The isolated PostgreSQL server was stopped after testing; its synthetic data and local runner remain ignored for reproducibility.

Integration tests prove cross-tenant read/select/mutation denial, per-session workspace switching, verified-account requirement, session deletion denial, single acceptance among five concurrent invitation requests, email mismatch, replay/expiry/cancellation denial, failed-delivery revocation, role escalation denial, stale issuer invitation invalidation, last-owner protection, password hashing, verification before sign-in, reset replay denial and session deletion after password reset.

Browser tests exercise the actual Next HTTP boundary: anonymous protection, foreign-origin rejection, signup, real local SMTP email verification, sign-in, profile save, workspace creation, invitation acceptance in a separate browser context, hidden management UI for a Preparer, HttpOnly cookies, another device's session revocation, sign-out and password recovery/reset. All test identities are synthetic. Auth browser traces are off to avoid recording credentials/tokens. No external email was sent.

An initial cross-origin assertion against the raw library handler returned a credential denial instead of the expected origin denial. Explicit same-origin validation was added at our route boundary; the acceptance test now calls that deployed route and passes. Final results do not rely on a mock auth or database adapter.

## Environment and remaining limits

- New settings: `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, optional local SMTP credentials, and production `AUTH_PROXY_IP_HEADER`. Non-loopback configuration requires HTTPS, SMTP credentials and the trusted header. Deployment must replace incoming client-IP headers and block direct app ingress. Mailpit is local-only.
- No actual deployment secret or SMTP credentials supplied. Unconfigured account services fail closed with localized feedback. Public pages still build and render without database/auth settings.
- Docker Desktop was started hidden but the Linux engine returned HTTP 500. Container execution/Redis/Mailpit container runtime remain unverified. A disposable native PostgreSQL 17.11 runner under ignored local tooling was used for real SQL tests instead. The test helper's package is beta-labeled and is not a shipped dependency. CI uses a PostgreSQL 17 service. Remote CI has not run; the project remains inside a parent Git repository.
- Specifications 05–11 remain missing. Privileged-role MFA policy, full operational audit/retention, legal review and production infrastructure review remain launch gates. This batch is not a production sign-off.
- Invitation delivery is synchronous with a pending-delivery state. A process crash during delivery requires a manager to cancel and recreate the invitation; no success is fabricated. Expired/pending invitations show expiry, and acceptance always revalidates server-side.
- Abuse controls (20 owned organizations, 20 invitations/hour per issuer) are separate from future paid entitlements and trial quotas.
- Workspace audit events have no mutation endpoint; a fully hardened audit storage/retention policy remains later work. No tax/business role operation is exposed yet.

## Manual QA

1. Follow README setup, configure a random secret and local SMTP, migrate the database, then run `npm run dev`.
2. Open `/id/auth/sign-up`, create a development account, follow Mailpit's verification email, and sign in. Repeat navigation in English.
3. Edit profile name; create two workspaces and switch between them. Invite a second verified account as Preparer and accept using its email link.
4. Confirm the Preparer cannot manage the team. Revoke membership from the Owner account; the former member must lose access. Try the same invitation again and confirm denial.
5. Sign in on another browser/device, revoke that session, and confirm access is denied. Request/reset a password and confirm older sessions stop working.
6. Check keyboard navigation, mobile layout, empty/error messages and last-owner rejection. Never use real taxpayer/customer data for QA.

## Files changed

```text
.dockerignore
.env.example
.github/workflows/ci.yml
.gitignore
.prettierignore
README.md
package.json
package-lock.json
eslint.config.mjs
playwright.config.ts
playwright.auth.config.ts
tsconfig.tools.json
vitest.integration.config.ts
compose.yaml
prisma/schema.prisma
prisma/migrations/migration_lock.toml
prisma/migrations/202611160001_auth_workspaces/migration.sql
apps/web/package.json
apps/web/next.config.ts
apps/web/src/app/[locale]/page.tsx
apps/web/src/app/[locale]/app/page.tsx
apps/web/src/app/[locale]/auth/[screen]/page.tsx
apps/web/src/app/[locale]/invite/page.tsx
apps/web/src/app/api/auth/[...all]/route.ts
apps/web/src/app/api/workspaces/route.ts
apps/web/src/components/account/auth-form.tsx
apps/web/src/components/account/forms.tsx
apps/web/src/components/account/invitation.tsx
apps/web/src/components/account/workspace.tsx
apps/web/src/i18n/account.ts
apps/web/src/i18n/mail.ts
apps/web/src/i18n/messages.ts
apps/web/src/server/auth/config.ts
apps/web/src/server/auth/create-auth.ts
apps/web/src/server/auth/index.ts
apps/web/src/server/auth/mail.ts
apps/web/src/server/http.ts
apps/web/src/server/workspaces/index.ts
apps/web/src/server/workspaces/policy.ts
apps/web/src/server/workspaces/service.ts
tests/e2e/auth.spec.ts
tests/e2e/public.spec.ts
tests/integration/access.test.ts
tests/unit/access.test.ts
core_docs/03_MEMORY.md
core_docs/13_DECISIONS_AND_OPEN_ITEMS.md
core_docs/01_BATCH_REPORT.md
```

Generated Prisma/Next files, screenshots and disposable local database tooling are ignored artifacts, not deliverable source. Official library references and decisions are recorded in `13_DECISIONS_AND_OPEN_ITEMS.md`.

## Next batch

02 — Trial 72h + Atomic Usage Quota. Stop for product-owner review and explicit authorization; no Batch 02 code has been started.
