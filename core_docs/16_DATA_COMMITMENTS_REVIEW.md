# 16 — Data commitments review (claim ↔ evidence)

**Status:** This is an engineering accuracy review, prepared 2026-11-22. It is
**not legal advice and not a legal sign-off.** It checks that every data
commitment SerenTax shows to customers is true for the code as it stands. It
also lists the decisions that an Indonesian advocate or a data protection
officer must make before production.

The commitments are shown in three places:

- Settings → Data & privacy, from `i18n/account.ts` `settings.privacy.*`;
- the public privacy page, from `i18n/site.ts` `privacySections`;
- the OCR vendor approval text, from `i18n/ocr.ts` and `i18n/fields.ts`.

## 1. Claims and evidence

| #   | Claim shown to customers                                                                                            | Evidence in code                                                                                                                                                                                  | Verdict                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Data is processed only to run the service for the workspace and is not sold.                                        | All tenant queries are scoped by `organizationId` from a verified membership (`server/workspaces/service.ts`). The code has no data sharing or export to third parties apart from sub-processors. | **Accurate.** Earlier wording omitted support access; it now says support sees diagnostics only with a recorded, time-limited Owner/Admin grant (`server/reports` support access grants).                                                                                |
| 2   | SerenTax does not use customer data to train AI models.                                                             | No training pipeline exists. OCR adapters send a document only for one extraction call (`server/ocr/providers.ts`).                                                                               | **Accurate for SerenTax.** Vendor behaviour depends on vendor terms. The vendor approval checkbox and its help text now require checking the vendor's no-training terms. This is a process control and needs a documented vendor checklist.                              |
| 3   | Documents go only to platform-approved AI/OCR vendors, after Owner/Admin consent.                                   | `upsertProvider` refuses to enable an external adapter without `vendorApproved`. The workspace setting requires `externalAiConsent` for any non-manual provider (`server/ocr/service.ts`).        | **Accurate.** The processing location is shown from the provider's `region` in the sub-processor list.                                                                                                                                                                   |
| 4   | Tax IDs are stored encrypted.                                                                                       | `server/intake/crypto.ts` (`protect`/`reveal`). Company, counterparty and lead NPWP are stored as ciphertext with a 4-character hint.                                                             | **Accurate.** The key comes from `TAX_DATA_KEY` (falling back to the auth secret in development). Production must set a dedicated key and a key-rotation procedure.                                                                                                      |
| 5   | Document access, data exports, XML downloads and deletions are recorded in the audit log.                           | `DOCUMENT_VIEWED`, `DATA_EXPORTED`, `XML_EXPORT_DOWNLOADED`, `DOCUMENT_DELETED` and `DATA_PURGED` audit events are written in the respective services.                                            | **Accurate.** The earlier wording "every document view …" was narrowed to the events that are actually recorded.                                                                                                                                                         |
| 6   | Customers can delete documents at any time.                                                                         | `deleteDocument` works at any transaction status. It removes the file and the OCR candidates and keeps a tombstone (`server/intake/service.ts`).                                                  | **Accurate.** OCR job metadata (page counts, cost) is kept for spend caps. It contains no document content.                                                                                                                                                              |
| 7   | While the subscription is active, we do not delete documents unless the customer does or the law requires it.       | The only automatic deletion is the retention purge after termination (`server/lifecycle/service.ts`).                                                                                             | **Accurate.**                                                                                                                                                                                                                                                            |
| 8   | After the subscription ends, the workspace is read-only and documents are deleted after the retention period shown. | `assertWorkspaceWritable` blocks creation, upload, OCR and XML export. `runScheduled` purges documents and XML files once `purgeAfter` passes. Records and the audit log are kept.                | **Accurate when configured.** If `DATA_RETENTION_DAYS_AFTER_TERMINATION` is unset, the UI says deletion is "not yet scheduled" and nothing is purged. The job must actually be scheduled daily (`npm run data:lifecycle` or `POST /api/internal/lifecycle`).             |
| 9   | Owners/Admins can download a complete copy of the workspace data.                                                   | `privacyService.exportData` (JSON, audited).                                                                                                                                                      | **Accurate.** Document files are linked per transaction, not bundled in the export. The text says so.                                                                                                                                                                    |
| 10  | Keeping tax records remains the customer's responsibility.                                                          | — (a legal allocation of responsibility)                                                                                                                                                          | **Added.** Under the tax procedures law (UU KUP), taxpayers generally keep books and supporting documents for 10 years. SerenTax's purge after termination therefore must not be the customer's only copy. **The retention period stated by counsel must be confirmed.** |

The figure of 10 years under UU KUP is a general reference included so that
customers know to keep their own copies. Counsel must confirm the wording.

## 2. Wording changes made in this review

- Commitment 1 now names the support-access exception.
- Commitment 2 is split into the SerenTax promise and the vendor-approval
  condition.
- Commitment 3 points to where the vendor's processing location is shown.
- Commitment 4 lists only the audit events that exist.
- The retention note and the cancellation confirmation now remind customers of
  their own tax-record obligation.
- The Data & privacy tab states that the summary does not replace the Terms of
  Use and Privacy Policy.
- The public privacy page now describes the processing that actually happens:
  - uploads and OCR exist;
  - the sub-processor list is shown in the app;
  - deletion and retention;
  - customer rights.

  It is still labelled "Draft · pending legal review" and makes no
  compliance claim.

## 3. Decisions required before production (UU No. 27 Tahun 2022 — Pelindungan Data Pribadi)

These are not implemented as legal positions in the product. The product
owner, with counsel, must decide each of the following:

1. **Roles.**
   - The customer is likely the _controller_ (pengendali) of the personal data
     in its workspace, and SerenTax is likely the _processor_ (prosesor).
     For account data, SerenTax is the controller.
   - Confirm these roles and reflect them in a data processing agreement
     (DPA) or the Terms.
2. **Processing basis** for account data and for workspace data, as
   determined by the controller.
3. **Data subject rights process**: who receives requests, the response time,
   and how identity is verified. The product supports export, correction and
   document deletion for Owners/Admins. Requests from end persons (for example
   a counterparty's PIC) need a manual process.
4. **Incident notification.**
   - UU PDP requires written notification of a personal data breach within
     3 × 24 hours to data subjects and the authority.
   - The product has no incident-notification workflow. An operational
     runbook and contact list are needed. The 10Tax-style contractual
     72-hour notice in the opposite direction, from customer to provider, is a
     separate contractual choice.
5. **Cross-border transfer.** If a vendor processes outside Indonesia (for
   example the first-party Anthropic API), the transfer conditions of UU PDP
   apply. Prefer an in-region option (for example AWS Bedrock or Textract in
   an Indonesian region, where available) or document the safeguards.
6. **Data protection officer (DPO) and privacy contact** to show on the
   privacy page.
7. **Retention values**: notice days, retention days and export delivery days,
   set through the `DATA_*` env vars. They must match the Terms.
8. **Commercial terms for invoices**:
   - the VAT treatment of the service (the VAT rate is configured per offer
     and is not hard-coded);
   - payment terms;
   - suspension after non-payment (`BILLING_SUSPEND_AFTER_DAYS_OVERDUE`);
   - termination for non-payment.
9. **Terms of Use**: the public terms page is still a placeholder. A
   10Tax-style structure (definitions, AI disclaimer, liability cap,
   indemnities, governing law, Indonesian-language precedence and the
   KUHPerdata 1266 waiver) is a reasonable _checklist_. **Do not copy any
   competitor's text.**

## 4. Keeping this true

Any new feature that stores, shares, deletes or sends customer data must
update this table and the commitment texts in the same change. Reviewers
should reject a change where a commitment no longer matches the code.
