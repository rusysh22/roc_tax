# Batch 08 — Coretax XML Template Registry & First Verified Export

Date: 2026-11-17. Scope: Batch 08 only.

## Implemented

- **Official DJP BPPU v.3 source acquisition & provenance (`apps/web/src/lib/export/bppu-spec.ts`):** Downloaded and verified `BPPU Excel to XML v.3.xlsx` (`2025-09-04T04:32:24Z`, SHA-256 `b59813365bccdf9d63a47051d4d2b0b58c53351b8c981a6f33144be05b429089`) and `bppu.zip` (`2024-12-10T03:28:34Z`, SHA-256 `8a90ea38737bd8d5f0563c12c11ec076b91138f0865ac9f46fd0d4414b004deb`, containing `bppu.xml` SHA-256 `bd52881b465315072fe3820f3f63b38b6e966d72e7da22ec94afcac1b55635e5`) from `https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml`. Derived exact root element `<BpuBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`, child element sequence, and XSD constraints directly from embedded `xl/xmlMaps.xml` (`Schema3`, SHA-256 `9ccf6e1b0f36cb0936d0ad5e8725bfeb0bbd61e2174553162b3c8c7c4a1019d7`).
- **Superadmin XML Template Registry (`/[locale]/admin/xml-templates`, `/api/admin/xml-templates`):** Guarded by `platformRole === "SUPERADMIN"`. Enforces official `https://*.pajak.go.id` URLs, SHA-256 checksums, `fixtureVerified` gating, and fails closed with `TEMPLATE_UNVERIFIED` when attempting to mark unsupported tax families (`PPN_FAKTUR_KELUARAN`, `PPH_UNIFIKASI_BPNR`, `PPH21_*`, `PPH26_BP26`) as `VERIFIED`.
- **Canonical XXE-proof BPPU serializer & validator (`apps/web/src/lib/export/bppu.ts`):** Formats `TaxBase` and percentage `<Rate>` using exact integer/BigInt decimal strings, escapes `& < > " '` XML entities cleanly in UTF-8, validates leap-year dates and `WithholdingDate >= TaxPeriod`, enforces `Direct` SP2D rules, rejects DTD/DOCTYPE/ENTITY injection constructs, and validates every exported document against `Schema3` constraints before storage.
- **Immutable export pipeline & manual Coretax tracking (`apps/web/src/server/export/service.ts`, `/[locale]/app/exports`, `/api/exports`, `/api/exports/[id]/download`, `/api/exports/[id]/outcome`):** Exports only `APPROVED`/`EXPORTED` transactions sharing `(companyId, taxFamily, taxPeriod)` with valid `SME_APPROVED` `TaxEvaluationSnapshot` rows, decrypts Company `NPWP`/`NITKU` and Counterparty `NPWP`/`NIK` using tenant-scoped AAD, persists XML artifacts in private storage with SHA-256 verification on download, creates monotonic `exportVersion` batches on regeneration without overwriting previous history, displays manual Coretax upload steps, and records `CORETAX_ACCEPTED` / `CORETAX_REJECTED` outcomes append-only (with controlled `CORETAX_REJECTED -> CHANGES_REQUESTED` reopen).

## Database migrations

Yes: `202611160008_xml_templates_export`.

Adds `XmlTemplateStatus`, `CoretaxOutcomeStatus`, optional BPPU fields on `TransactionTaxInput`, tables `XmlTemplate`, `XmlExportBatch`, `XmlExportItem`, `XmlExportOutcome`, `CHECK` constraints, immutable `BEFORE UPDATE` PostgreSQL triggers (`xml_export_batch_immutable`, `xml_export_item_immutable`, `xml_export_outcome_immutable`), and seeds only the single source-verified `BPPU-v3-2025-09` official template metadata row.

## Security

- Superadmin endpoints and pages (`/api/admin/xml-templates`, `/[locale]/admin/xml-templates`) fail closed (`403 FORBIDDEN`) for non-`SUPERADMIN` users and anonymous callers (`401`).
- Unsupported tax families fail closed with `TEMPLATE_UNVERIFIED`; exports also require `APPROVED`/`EXPORTED` status, current-revision `TaxEvaluationSnapshot`, and `SME_APPROVED` rules (`PRODUCTION_RULE_UNVERIFIED`).
- `tax.export` permission is granted only to `PREPARER`, `REVIEWER`, and `APPROVER`; `OWNER` and `ADMIN` remain separated from tax execution.
- XML files live in private local storage outside public web routes, never embed secrets, verify SHA-256 byte integrity on download (`INTEGRITY_MISMATCH`), and prevent XML entity/XXE injection.

## Executed verification

Verified against isolated PostgreSQL 17.11 (`serentax_test`) and compiled production Next.js build + Playwright E2E runner.

## Files changed

- `prisma/schema.prisma`
- `prisma/migrations/202611160008_xml_templates_export/migration.sql`
- `README.md`
- `apps/web/src/lib/release.ts`
- `apps/web/src/lib/intake/state.ts`
- `apps/web/src/lib/intake/tax-rules.ts`
- `apps/web/src/lib/export/bppu-constants.ts`
- `apps/web/src/lib/export/bppu-spec.ts`
- `apps/web/src/lib/export/bppu.ts`
- `apps/web/src/server/workspaces/policy.ts`
- `apps/web/src/server/tax/service.ts`
- `apps/web/src/server/export/service.ts`
- `apps/web/src/server/intake/http.ts`
- `apps/web/src/server/intake/index.ts`
- `apps/web/src/app/api/admin/xml-templates/route.ts`
- `apps/web/src/app/api/exports/route.ts`
- `apps/web/src/app/api/exports/[id]/download/route.ts`
- `apps/web/src/app/api/exports/[id]/outcome/route.ts`
- `apps/web/src/app/[locale]/admin/xml-templates/page.tsx`
- `apps/web/src/app/[locale]/app/exports/page.tsx`
- `apps/web/src/app/[locale]/app/[section]/page.tsx`
- `apps/web/src/components/export/admin-xml-templates.tsx`
- `apps/web/src/components/export/exports-view.tsx`
- `apps/web/src/components/tax/transaction-review.tsx`
- `apps/web/src/i18n/exports.ts`
- `apps/web/src/i18n/site.ts`
- `tests/unit/export.test.ts`
- `tests/integration/export.test.ts`
- `tests/e2e/public.spec.ts`
- `tests/e2e/auth.spec.ts`
- `core_docs/03_MEMORY.md`
- `core_docs/13_DECISIONS_AND_OPEN_ITEMS.md`
- `core_docs/08_BATCH_REPORT.md`

## Open items & next batch

- Production BPPU XML exports still require Tax SME sign-off on real statutory tax rules (`SME_APPROVED`); the other 7 tax families require official DJP template acquisition and verification before export is enabled.
- Missing specifications 05–11, Berlanggan SaaS licensing compatibility (Batch 09), external OCR vendor setup & credentials, and host Windows Docker/WSL2 `DenyDeviceClasses` policy remain open.
- Next batch: **09 — Berlanggan Subscription & Licensing (compatibility gate)**. Stop here and await explicit instruction.
