# Product Requirements Document — SerenTax

- **Document:** PRD v1.0 • **Date:** 2026-11-15 • **Status:** Proposed, subject to tax/legal/provider validation
- **Owner:** SerenTax product owner • **Users:** Indonesian tax and accounting professionals
- **Platform:** Bilingual B2B SaaS • **Default locale:** id-ID • **Timezone:** Asia/Jakarta

## 1. Executive summary

SerenTax is a document-to-tax-data preparation workspace that helps Indonesian tax/accounting teams import invoices and structured accounting records, review suggested classifications and calculations, validate records under a versioned rule catalog, and generate official-template-compatible XML files for **manual import into Coretax DJP**. It focuses on reducing clerical re-entry and errors, not replacing tax experts or DJP.

## 2. Problems to solve

1. Repeated manual entry of invoice and vendor/customer identities into tax systems.
2. Fragmented and changing Coretax XML formats/document-family requirements.
3. Incorrect NPWP/NITKU, object codes, dates, duplicate invoices, DPP/tax amount, and inconsistent transaction references.
4. Poor traceability between source document, approved review, exported XML, and actual Coretax upload status.
5. Need for simple, affordable SaaS with free trial and externally managed subscriptions.

## 3. Objectives and success metrics

- 100% of critical transactions enforce tenant isolation, RBAC, valid entitlement/trial and audit records.
- 100% XML exports have official template version, rule snapshot and approval provenance.
- 0 exports from unsupported/unverified template families; 0 silent tax assumptions.
- User can create a transaction from manual entry without OCR.
- Starter tax user can see validation blockers and fix individual fields without engineering knowledge.
- Trial permits no more than 1 new transaction per Jakarta local date, 3 overall per account and 72 hours.
- Automated tests prove quota concurrency, webhook replay protection, cross-tenant denial and verified XML fixtures.
- Measure: successful approved/exported transaction ratio, field correction count, time-to-complete, error rate, support events, OCR cost, conversion rate (without disclosing customer tax data to marketing analytics).

## 4. User personas / access

| Role | Scope | Permissions |
|---|---|---|
| Visitor | Public | Landing, pricing, terms, sign up |
| Trial Account | Own membership | Limited transactions and exports, dashboard, upgrade |
| Staff / Preparer | Organization | Manage drafts, upload, extract, edit, submit for review |
| Tax Reviewer | Organization | Review taxes, request correction, validate |
| Tax Approver | Organization | Approve or reject, authorize XML generation and download |
| Organization Owner/Admin | Organization | Users, company profiles, workspace config, integration, license linkage, audit overview |
| SerenTax Support (least privilege) | Platform | Metadata/support tickets; no raw documents by default; audited break-glass access with approval |
| SerenTax Superadmin | Platform | Vendor OCR settings, plan integration health, reference rule publishing, support operations (restricted PII) |

Roles configurable only within restricted hierarchical policy. User can belong to multiple organizations; every action requires an explicit active workspace. Never infer workspace from an untrusted request ID.

## 5. Primary user journeys

**J-01 Register & trial:** Visitor -> email verification -> create account and first workspace -> trial activation -> dashboard shows expiry and daily/global quota -> create only eligible number of transactions -> upgrade CTA when exhausted/expired.

**J-02 Manual data:** Preparer -> select legal entity/workspace + tax document family -> fill structured invoice parties/dates/items/DPP -> run checks -> correct errors -> send for review -> approver approves -> generate XML if official template verified -> download -> optionally mark Coretax upload result with reference and evidence.

**J-03 OCR:** Preparer -> upload safe PDF/JPG/PNG -> select configured provider or manual fallback -> background extraction -> compare original vs extracted fields and confidence -> correct tax-specific fields -> J-02 flow.

**J-04 Excel batch:** Preparer -> get SerenTax import template per document family -> upload -> row-level preview/errors -> validate with source reference -> create authorized transactions with atomic quota reservation -> review and batch export by same tax family/period/company.

**J-05 Subscription:** Admin sees published plans from Berlanggan, clicks verified external product checkout link -> buys externally -> receives license -> links license via verified identity + server-side validation -> entitlements applied to organization -> periodic validation, webhook processing, usage dashboard -> upgrade/renew/expired states. Without supported SaaS activation semantics, payment integration remains gated and publicly described as pending.

**J-06 Tax changes:** Superadmin imports/updates rule references in DRAFT -> Tax SME reviews -> approves effective date/version -> publishes -> future new evaluations use new version, prior approved/exported records keep original snapshot.

**J-07 Reconciliation:** Staff logs manual result from Coretax (uploaded/accepted/rejected and ID/evidence if available) -> report exported vs recorded as accepted; no fictional automatic Coretax sync.

## 6. Detailed functional requirements

### FR-001 Public website & acquisition (P0)

- Landing page: problem/solution, supported features by release status, 'How it works', privacy/security, clear non-affiliation disclaimer, FAQs, pricing, trial CTA, contact.
- Product pages and terms in id/en. Dynamic plan rendering from verified Berlanggan catalog with graceful offline state. Do not invent prices.
- Accessible mobile/desktop, SEO localized metadata, security headers, no user tax documents in marketing telemetry.
- Acceptance: user sees 3-day/1-per-day trial and clear disclaimers; plan links only point to verified authorized destination.

### FR-002 Identity & organization (P0)

- Verified email signup, sign-in/out, password reset (if email/password method), optional trusted OAuth only after verification, session management, 2FA for high-privilege actions in production policy.
- Create organizations with display name, legal entity name, optional NPWP/NITKU metadata (encrypted where required), timezone lock for quota Asia/Jakarta, membership invite/accept/revoke.
- Organization-level settings: tax identity, contact info, company business rules, document numbering only as appropriate, OCR option, default language, retention requests.
- Acceptance: new user cannot access another organization via URL/ID; revoked member immediately blocked server-side.

### FR-003 Trial, limits and entitlement (P0)

- Trial activates only once after verified account registration. 72h UTC period. Daily quota scoped to Asia/Jakarta date (00:00–23:59:59 WIB). One transaction/day/user, 3 max for lifetime trial, across organizations. End at exact 72h; display WIB date/time.
- **Transaction definition:** one persisted, structurally valid draft representing one taxable event/source transaction; file upload alone, OCR retry, editing, XML regenerate do not each count as additional new transaction.
- Atomic eligibility+quota consumption+new transaction commit; idempotency key ensures retry returns same result; delete and undo do not refund quota.
- Separate paid entitlements: plan may determine transactions/month, users, bulk import, OCR pages/month, retention, company count. Never assume values; read from verified Berlanggan entitlement keys via typed validated mapping after vendor confirmation.
- Show remaining quota/progress and useful errors including next trial daily window or expiration and upgrade CTA.
- After trial expiration, let user see own records and buy a plan, but block new mutations/exports requiring paid entitlement according to a documented read-only data policy; no destructive auto-deletion.
- Acceptance: 10 concurrent requests cannot exceed 1 eligible creation; user in multiple companies cannot evade quota; daily boundary checks WIB/UTC tested; overall <=3.

### FR-004 Company / counterparty masters (P0)

- Company / Branch / NITKU references, taxpayer identity, vendor/customer counterparty (name, NPWP/NIK when legally appropriate, jurisdiction, address, tax-status-related attributes as available).
- Validate format and required fields by official XML family; check duplicates, normalized identity display, reference source.
- Classify confidential PII and apply encryption/masking/access logs; no live NPWP registry lookup claim unless official API integration verified.

### FR-005 Tax transaction intake (P0)

- New transaction wizard: organization -> tax family -> manual/upload/import -> review source -> details -> suggested tax data -> validation -> submit.
- Persist original doc metadata (hash, filename, MIME, uploadedBy), structured header and line items, transaction source (manual/OCR/Excel/ERP), date, currency, counterparty, invoice number, DPP, tax mapping, tax period, description, provenance and rule version.
- Invoice types: supplier invoice, sales invoice, debit/credit memo support only when official mapping/requirements confirmed; avoid arbitrary unsupported options.
- Search, filter, sort, pagination, CSV export where authorized, duplicate finder, total count, corrected/uncorrected fields indicator.
- Status machine: `DRAFT`, `EXTRACTING`, `NEEDS_REVIEW`, `VALIDATED`, `SUBMITTED`, `CHANGES_REQUESTED`, `APPROVED`, `EXPORTED`, `CORETAX_ACCEPTED`, `CORETAX_REJECTED`, `VOIDED`; transitions require explicit actions/privilege; status name changes require migration/tests.
- 1 transaction may contain multiple invoice lines and multiple mapping records when genuinely appropriate, but cannot be silently split into multiple tax documents; source-to-output relationship explicit.

### FR-006 AI OCR as configuration (P1)

- Provider registry: `none`, adapter for configured external OCR model, optionally cloud OCR; superadmin configures endpoint/provider, secret reference, model, geographic processing, max pages, timeout, cost cap, retention.
- Tenant owner may choose from allowed providers or disable external AI, depending on plan/policy. No tenant-uploaded arbitrary endpoint by default (SSRF risk).
- Drag/drop PDF/JPG/PNG, per-file validation, content hash, private object storage, asynchronous jobs, retries with backoff, status, failures and fallback to manual entry.
- OCR extracts candidates only: invoice no/date, vendor/customer, tax IDs, monetary values, line items. Preserve raw vs normalized values, confidence (or `unknown`), location/span if provider supports, provider/model/version, human correction history.
- Tax ID and currency fields with low confidence require explicit verification. Don't store provider prompts/responses containing PII in unredacted logs.
- Provider selection and billing meters must be server-only. No exposed API key.

### FR-007 Tax rules and calculations (P0 for chosen launch family, P1 otherwise)

- Tax families: `PPN_FAKTUR_KELUARAN`, `PPH_UNIFIKASI_BPPU`, `PPH_UNIFIKASI_BPNR`, `PPH21_BP21`, `PPH21_BPMP`, `PPH21_BPA1`, `PPH21_BPA2`, `PPH26_BP26`, and further DJP-documented families **only after classification review**.
- Rule input: jurisdiction, effective period, tax family, object code, transaction type, legal counterparty attributes, tax base, optional evidence, treaty factors/qualifications and SME override.
- Versioned source references with publication/effective date; default 'unclassified / requires review' when insufficient evidence. Numeric amounts use decimal-safe operations and documented rounding per rule version.
- Recalculate with visible diff; approver sign-off for tax code/rate and tax amount. Lock/snapshot final calculations at approval.
- PPh21 salary/annual tax cannot be inferred from invoice: separate payroll import/history scope and legal validation needed. Prevent 'one invoice handles all PPh21' marketing.
- PPh26/treaty cannot be auto decided without supporting facts and legally required documents.
- Acceptance: incorrect/unknown code results in blocker, not silent default rate; historical approved exports retain rule snapshot after rule updates.

### FR-008 Coretax XML exporter (P0 for 1 verified family, P1 for all others)

- Official template registry per document family with original source URL, DJP label/date, file checksum, approval metadata, mapping specification, available validation methods and fixture set.
- Pipeline: approved transaction(s) -> family-specific map -> schema/field validation -> amount reconciliation -> canonical deterministic serialization -> XML artifact hash -> download and immutable export event.
- Escape unsafe characters, validate Unicode and required fields, safe XML parse, deterministic element order, exact field naming from *downloaded* official template, never presumed from memory.
- UI lists family status: AVAILABLE/NEEDS_VERIFICATION/UNSUPPORTED; block download for unverified family.
- Import acceptance by Coretax is a separate manual user-recorded result; Coretax validation may still reject XML.
- Batch XML only same authorized company + family + period + official template version, unless official specification says otherwise.
- Retain export version and reviewer identity. Regenerations create new history, never overwrite existing XML proof.

### FR-009 Review, approval, comments (P0)

- Preparer submits for review, reviewer comments/request changes, approver approves/rejects. Prevent self-approval by configurable policy, with default separation where team size allows; explicit sole-user exception with audit and visible warning.
- Side-by-side document and extracted fields; validation drawer with errors/warnings/info and linked field focus.
- Every material correction captures before/after, actor, date/time, reason. Approved records require explicit reopen/re-approve rather than silent modification.

### FR-010 Dashboard & reports (P1)

- Cards: total transactions, in review, approved, XML generated, Coretax manually accepted/rejected, trial/quota/plan status.
- Search/filter by company, tax period, tax family, counterparty, reviewer, source, discrepancy.
- Reconciliation report: source amount vs approved tax amount vs exported batch status vs user-recorded Coretax outcome. CSV/XLSX exports authorized.
- Do not imply Coretax accepted without recorded evidence.

### FR-011 Billing / subscription (P0 for commercial launch)

- Berlanggan external seller product and plans; dynamic pricing; external checkout via verified store/product URL; license redemption/linking to an organization by verified owner; signed entitlement validation; periodic refresh; signed webhooks; handling of revoked/expired/grace states and upgrade UX.
- Berlanggan docs are device-centric, thus confirm hosted SaaS licensing semantics with vendor. Until then, complete integration in adapter/test mode, do not pretend live production paid access works.
- Superadmin configures provider URL, known product identifier, public signing key, webhook secret, plan entitlement mapping and support contact.
- No storage of card/bank details in SerenTax. Provider handles payments; read terms as marketplace and entitlement, not payment processor API.

### FR-012 Admin / compliance operations (P0/P1)

- Platform console: active organizations, billing integration health, OCR adapter registry, approved tax rule/template versions, jobs/errors, abuse safeguards, support access requests and audit.
- Organization console: legal/company profile, users/roles, privacy choices, provider access, API keys if later available, usage, invoices/document retention.
- Privacy pages, security contact, Terms, fair-use, data export/deletion, consent log and configurable retention. No fabricated compliance badges.
- Enforced CSRF/session protection, per-account rate limits, request-size limits, privacy-controlled telemetry, backup restore procedures, incident runbook.

## 7. Screen inventory / routes

Public: `/{locale}`, `/{locale}/features`, `/{locale}/pricing`, `/{locale}/how-it-works`, `/{locale}/security`, `/{locale}/privacy`, `/{locale}/terms`, `/{locale}/faq`, auth sign-in/up/reset/verify.

Product: `/{locale}/app`, `/app/transactions`, `/app/transactions/new`, `/app/transactions/[id]`, `/app/imports`, `/app/exports`, `/app/reconciliation`, `/app/counterparties`, `/app/companies`, `/app/settings/team`, `/app/settings/company`, `/app/settings/billing`, `/app/settings/ocr`, `/app/settings/audit`, `/app/help` (all locale-prefixed in implementation).

Superadmin: `/{locale}/admin`, `/admin/organizations`, `/admin/billing`, `/admin/ocr-providers`, `/admin/tax-rules`, `/admin/xml-templates`, `/admin/jobs`, `/admin/security` (locale-prefixed, server-side superadmin guard).

## 8. MVP release boundaries

**MVP P0:** sign-up/verified trial; workspaces; manual draft + Excel importer; BPPU (only after verified official schema); basic tax rule validation; reviewer/approval; XML export; history; source reference; entitlement adapter; bilingual core pages; legal notices; isolated uploads; security tests.

**MVP not claimed complete if:** no verified tax template, no billing SaaS licensing confirmation, no multi-tenant testing, no tax SME validation.

**P1:** OCR configuration, PPN output, advanced import, BPNR and other eligible families, reconciliation/reporting, webhook observability. Order can be adjusted with tax SME.

**P2:** PPh21 payroll-oriented flows; PPh26 comprehensive treaty module; ERP/D365 CSV/OData connector; enterprise SSO/API; supported automated tax rule update workflow.

## 9. Product-language principles

- 'Generate XML for Coretax import' instead of 'file tax automatically'.
- 'Suggested tax classification — review required' instead of 'AI guarantees correct tax'.
- 'Coretax upload status (recorded manually)' instead of 'automatically reported'.
- 'AI OCR optional, configure provider' instead of '100% AI accuracy'.
- 'Plan prices managed by Berlanggan' instead of publishing invented price tiers.

## 10. Required pre-release sign-off

Product owner + security engineer + tax SME + legal counsel + billing provider compatibility verification + documented UAT with synthetic/anonymized data and actual Coretax workflow under authorized users.
