# Batch 00 — Bootstrap / Guardrails

Date: 2026-11-16. Implementation complete; database/container runtime acceptance remains blocked locally. No subsequent batch started.

## Implemented

Single-app npm workspace with Next.js App Router, strict TypeScript, Tailwind tokens, shadcn-style button and component configuration, typed Indonesian/English dictionaries, default `/id` redirect, `/en` switch, localized metadata, loading/error/not-found components, and a minimal monochrome preview page. The page explicitly labels all future transaction features unavailable.

Server-only lazy Prisma client, validated database URL, a real database connectivity script, secret-free noncached liveness route, PostgreSQL/Redis Compose, non-root standalone Dockerfile, local production startup script, unit/browser tests and GitHub Actions configuration. Setup and boundary documentation in README. Memory and decision log updated.

## Versions

Node 24.15.0; npm 11.12.1; Next 16.4.6; React/React DOM 19.3.1; TypeScript 6.0.3; Tailwind 4.3.5; Prisma/client/pg adapter 7.10.1; Zod 4.6.7; Vitest 5.1.0; Playwright 1.65.1; ESLint 10.15.0; Prettier 3.10.1. Exact direct dependencies and transitives recorded in package manifests and lockfile. Official compatibility links and dependency exceptions are in the decision log.

## Verification

| Command/check                                           | Observed result                                                                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install`                                           | Completed; initial lint dependency advisories resolved with documented scoped override.                                                                   |
| `npm ci --ignore-scripts`                               | Lockfile reinstall passed: 343 packages added, 351 audited, zero vulnerabilities. Lifecycle scripts were intentionally not rerun in this reinstall check. |
| `npm run format`                                        | Completed.                                                                                                                                                |
| `npm run format:check`                                  | `All matched files use Prettier code style!`                                                                                                              |
| `npm run lint`                                          | Exit 0, zero warnings.                                                                                                                                    |
| `npm run typecheck`                                     | Prisma client generated; route types generated; TypeScript exit 0.                                                                                        |
| `npm test`                                              | `Test Files 1 passed (1)`, `Tests 4 passed (4)`.                                                                                                          |
| `npm run build`                                         | Exit 0; compiled successfully; prerendered `/id` and `/en`; dynamic `/api/health`.                                                                        |
| `npx playwright install chromium`                       | Completed Chromium, headless shell and FFmpeg download.                                                                                                   |
| `npm run test:e2e`                                      | Final standalone startup run: `6 passed (11.1s)` across desktop and mobile Chromium.                                                                      |
| Screenshot review                                       | Desktop/mobile English screenshots inspected: readable spacing, grayscale styling, no clipped content or horizontal overflow.                             |
| `npm run db:validate`                                   | `The schema at prisma/schema.prisma is valid`.                                                                                                            |
| `npm run db:check` without config                       | Exit 1: `DATABASE_NOT_CONFIGURED`.                                                                                                                        |
| `npm run db:check` with local example URL               | Exit 1: `DATABASE_UNAVAILABLE`. No connection string leaked.                                                                                              |
| `docker info --format '{{.ServerVersion}}'`             | Failed: Docker Desktop Linux engine pipe unavailable.                                                                                                     |
| `docker compose --env-file .env.example config --quiet` | Exit 0; Compose configuration valid. This does not verify running containers.                                                                             |
| `npm audit` / `npm audit --omit=dev`                    | `found 0 vulnerabilities` after dependency remediation.                                                                                                   |
| `git check-ignore .env apps/web/.env.local`             | Both paths ignored.                                                                                                                                       |

Initial validation caught and fixed a Zod refinement exception for empty URLs. Initial `next start` tests passed but warned about standalone output; the startup script now launches the generated standalone server and the full browser suite passed again. One redundant manual start collided with the browser server on port 3000; the browser-managed standalone startup was successful. An early check ran before dependency installation finished and was rerun after install. No database integration, container execution, remote CI execution, tenant isolation, auth, billing or quota test success is claimed.

## Database migrations and environment

No migrations or domain models. Prisma schema config only. `.env.example` defines local PostgreSQL and Redis settings; no actual secrets were created. Root `.env` is for CLI/Compose; application environment must be injected or placed in ignored `apps/web/.env.local`. `BIND_HOST` optionally changes local standalone binding from loopback. Compose volumes persist data; no existing database was modified.

## Security

No customer-data routes or mutations exist. Tenant/auth checks await Batch 01; quota awaits Batch 02; billing awaits its compatibility gate. Private app paths return 404. Health exposes only liveness. Credentials stay server-side; environment files and generated artifacts are ignored. Browser headers disable framing and MIME sniffing and restrict device permissions. No external OCR, Coretax calls, invented pricing or XML output. Full production hardening and accessibility audit remain later gates.

## Manual QA / remaining acceptance

1. Run `npm run dev`, open `/`, confirm Indonesian and switch to English. Check keyboard focus and skip link.
2. Start Docker Desktop's Linux engine, copy `.env.example` to `.env`, then run `docker compose up -d`, `npm run db:check`, and inspect container health.
3. Build/run Docker image using README commands and confirm `/api/health` and both locales.
4. Run CI after placing the project at its intended Git repository root.

Missing specifications 05–11, external tax/billing/legal verification, and database/container runtime checks remain open. A real auth library will be selected and integrated in Batch 01; this scaffold has no pretend authentication.

## Files changed

Existing supplied file updated: `core_docs/03_MEMORY.md`. Other original supplied documents were read and preserved.

New files:

```text
.dockerignore
.env.example
.github/workflows/ci.yml
.gitignore
.nvmrc
.prettierignore
Dockerfile
README.md
package.json
package-lock.json
eslint.config.mjs
playwright.config.ts
vitest.config.ts
prisma.config.ts
compose.yaml
prisma/schema.prisma
scripts/check-database.ts
scripts/start.mjs
apps/web/package.json
apps/web/tsconfig.json
apps/web/next-env.d.ts
apps/web/next.config.ts
apps/web/postcss.config.mjs
apps/web/components.json
apps/web/src/app/globals.css
apps/web/src/app/global-error.tsx
apps/web/src/app/[locale]/layout.tsx
apps/web/src/app/[locale]/page.tsx
apps/web/src/app/[locale]/loading.tsx
apps/web/src/app/[locale]/error.tsx
apps/web/src/app/[locale]/not-found.tsx
apps/web/src/app/api/health/route.ts
apps/web/src/components/ui/button.tsx
apps/web/src/i18n/messages.ts
apps/web/src/i18n/format.ts
apps/web/src/lib/utils.ts
apps/web/src/server/database.ts
apps/web/src/server/environment.ts
tests/unit/guardrails.test.ts
tests/e2e/public.spec.ts
core_docs/00_BATCH_REPORT.md
core_docs/13_DECISIONS_AND_OPEN_ITEMS.md
```

## Next batch

01 — Authentication, Organizations & RBAC. Stop for product-owner review and explicit next-batch request.
