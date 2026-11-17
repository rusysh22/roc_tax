# AGENT RULES — DO / DON'T / Definition of Quality

## DO

1. Design for accountants: explicit statuses, visible calculations, row-level validation, actionable errors, export history, reconciliation, easy copy and download.
2. Keep all tenant data queries scoped by `organizationId` derived from verified membership; prevent IDOR and cross-workspace access.
3. Use authentication library with secure sessions, hashed passwords when applicable, email verification, MFA for elevated roles when feasible.
4. Validate all input with Zod at boundaries; validate MIME, magic bytes, size, extension, malware scanning when enabled; store uploads privately.
5. Calculate quota in database transaction with row-level lock or equivalent atomic conditional logic; use idempotency keys for writes and job retries.
6. Default fail-closed on invalid license / insufficient entitlements; apply a bounded and verified grace policy for provider network outage.
7. Keep OCR provider keys encrypted and server-only; track provider/model/config version per job and spend budgets.
8. Keep deterministic tax rules separate from OCR interpretation and UI presentation; require human-reviewed values to generate XML.
9. Maintain official-source/version citations for tax rule catalog and XML templates; don't claim compliance without fixture and user validation.
10. Use immutable audit trail for approvals, changes to tax fields, exports, billing transitions, quota consumption, and privileged actions.
11. Add tests for timezone edges, trial limits, concurrency, forgery, replay, cross-tenant access, XML escaping, XXE risks, PDF bombs, webhook signatures.
12. Implement bilingual text from day one; include empty state and useful field tooltips for staff.
13. Use decimal-safe currency arithmetic (`Decimal`/integer minor units as appropriate); do not use binary floating-point for tax money.
14. Add data minimization, privacy notice, legal agreements, export/delete workflows, data-retention policies.
15. Maintain exact error states, progress, and event logs; report tests honestly.

## DON'T

1. DO NOT hardcode plan price, promotional offers, quotas for paid plans, checkout URL, product slug, or billing credentials.
2. DO NOT invent Berlanggan endpoints or silently treat license `seat_limit` as number of SaaS users; verify provider's seat/device model.
3. DO NOT add an automatic Coretax submission/API connector without an official, legitimate, documented route and explicit go-ahead.
4. DO NOT call generated XML 'valid for Coretax' unless tested against the correct official template and verified acceptance process.
5. DO NOT let AI unilaterally determine tax object codes, final tax due, treaty rate, or legal classification; require Tax SME approvals.
6. DO NOT assume all PPh 21, PPh 23, PPh 26, Final, and PPN cases can be derived from a single invoice.
7. DO NOT use production NPWP, NIK, salary, PDF invoices, secrets, or tax credentials in tests/demo screenshots.
8. DO NOT store API keys in browser/localStorage, server logs, crash reports, or Git.
9. DO NOT make quota restrictions client-side only, trust webhook email alone, or accept unsigned provider events.
10. DO NOT send uploaded documents to a third-party AI provider unless tenant consent/configuration, disclosure, data-processing basis, and region controls are satisfied.
11. DO NOT permit arbitrary file download paths, unbounded OCR jobs, HTML injection from OCR text, or cross-tenant search leakage.
12. DO NOT prematurely add microservices, Kubernetes, speculative features, flashy gradients, decorative charts or unapproved color palettes.
13. DO NOT silently overwrite records or change tax rules retroactively. Always version and preserve audit.
14. DO NOT claim a feature is complete when it is mocked or blocked by unresolved source verification.

## System states and quality gates

- Prefer explicit `NOT_CONFIGURED`, `PENDING_REVIEW`, `NEEDS_SOURCE_VERIFICATION`, `UNSUPPORTED`, `FAILED_VALIDATION` over fabricated success.
- Every feature must handle empty/loading/error/success/access denied.
- Sensitive operations require revalidation of user, membership, privilege, tenant, entitlement, quota and document state server-side.
- Any open P0 security/data isolation issue blocks production.
