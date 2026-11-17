# Batch 03 ? Design System, Marketing & Core App Shell

Date: 2026-11-16. Scope: current batch only. Risk: low-to-medium UI/routing changes over existing authenticated services. No Docker work.

## Implemented

- Monochrome semantic tokens, light/dark preference, responsive public header/footer and app sidebar/mobile navigation, keyboard focus and skip links, native FAQ disclosure, skeleton and empty/error states.
- Indonesian/English landing, features, planned workflow, adapter-driven pricing placeholder, FAQ, security and clearly marked pending-legal-review Terms/Privacy. No advertised available tax export; all eight families have explicit unavailable/unverified status.
- Protected overview with real workspace state and existing trial strip; organization selector reuses server-authorized selection. Account/team/profile/session UI moved to app/settings. Transactions/imports/exports/help provide truthful release boundaries and navigation.

## Files changed

- apps/web/src/app/[locale]/page.tsx
- apps/web/src/app/[locale]/layout.tsx
- apps/web/src/app/[locale]/loading.tsx
- apps/web/src/app/[locale]/[publicPage]/page.tsx
- apps/web/src/app/[locale]/app/layout.tsx
- apps/web/src/app/[locale]/app/page.tsx
- apps/web/src/app/[locale]/app/settings/page.tsx
- apps/web/src/app/[locale]/app/[section]/page.tsx
- apps/web/src/app/globals.css
- apps/web/src/components/layout/preferences.tsx
- apps/web/src/components/layout/public-shell.tsx
- apps/web/src/components/layout/app-shell.tsx
- apps/web/src/components/marketing/content.tsx
- apps/web/src/components/account/overview.tsx
- apps/web/src/components/account/workspace.tsx
- apps/web/src/components/ui/status.tsx
- apps/web/src/i18n/site.ts
- apps/web/src/lib/release.ts
- apps/web/src/server/billing/catalog.ts
- tests/e2e/public.spec.ts
- tests/e2e/auth.spec.ts
- README.md
- core_docs/03_MEMORY.md
- core_docs/13_DECISIONS_AND_OPEN_ITEMS.md
- core_docs/03_BATCH_REPORT.md

## Database, environment and security

No migrations, environment additions or dependency changes. Protected routes validate verified server sessions; all workspace reads/mutations retain database membership/RBAC checks and same-origin mutations. Trial enforcement is unchanged. No API keys in browser storage; only theme preference is stored. No real SMTP recipients, customer records or tax identifiers used in tests. Billing adapter is NOT_CONFIGURED with no plans/checkout. No new paid access or quota bypass.

## Verification

- npm run format:check ? passed.
- npm run lint ? passed, zero warnings.
- npm run typecheck ? passed.
- npm test ? 13 tests passed, 3 files.
- npm run test:integration ? 19 tests passed, 2 files, isolated native PostgreSQL 17.11.
- npm run build ? passed production build.
- npm run test:e2e ? 8 passed across desktop and mobile; both locales, navigation, features, billing state, legal markers, keyboard FAQ, persistent dark theme, unknown locale, protected APIs and security headers.
- npm run test:e2e:auth -- --output=test-results/auth-batch03 ? 1 passed (29.9 seconds overall). Real local SMTP verification/recovery, team permissions, trial activation, workspace creation and switching, sessions, protected app navigation, locale-preserving app links, mobile menu and sign-out. Initial run failed to locate the selector because its label included option text; an explicit localized aria-label fixed it and the full flow passed.

Visual QA inspected desktop landing, mobile dark security page and desktop/mobile overview screenshots under ignored test-results/. Text wraps, monochrome contrast and responsive layout were checked. Browser checks are Chromium desktop/mobile emulation, not a full assistive-technology or cross-browser audit.

## Manual QA

1. Visit /id, use footer/navigation to inspect every public page, switch to English and verify the same route remains open.
2. Toggle theme and reload; expand FAQ using Tab/Enter. Check mobile menu and keyboard focus.
3. Sign in with a verified test account, create/select a workspace in settings, then use the sidebar selector to switch organizations.
4. Inspect dashboard trial status and empty transaction boundaries; unreleased pages must not offer creation or export success.
5. Confirm terms/privacy carry pending legal review and pricing has no fabricated amounts or checkout.

## Open items and next batch

07_DESIGN_SYSTEM.md (and other referenced specifications 05?11) was not supplied. Design follows existing tokens and explicit PRD/master constraints provisionally. Legal identity/contact/terms, Berlanggan SaaS compatibility/catalog, official tax templates/rules and production MFA remain open. Docker/Redis and remote CI remain unverified and were not investigated at the user's request.

Next: Batch 04 ? Company, Counterparty & Transaction Intake. Requires a new user instruction; no automatic continuation.
