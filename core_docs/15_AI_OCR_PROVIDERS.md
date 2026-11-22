# 15 — AI / OCR vendor adapters (product-owner configuration)

SerenTax can read invoices and tax invoices (Faktur Pajak) with an external AI/OCR
vendor. The **product owner** chooses the vendor; no code change is needed.

- Configure it in **Superadmin → OCR providers**.
- Workspaces then pick an approved provider in **Settings → OCR** and record
  consent for AI processing.
- AI output is only ever a **candidate**. It is sanitized against prompt
  injection and markup, and a person verifies it before anything is saved.
  Tax families, rates and object codes are never chosen by AI.

## Credentials ("secret reference")

API keys are **never stored in the database**:

1. In the provider form, enter only the _name_ of a server environment
   variable as the "secret reference" (for example `OCR_ANTHROPIC_API_KEY`).
2. Put the value in the server environment (`.env` / the deployment's secret
   manager).
3. The admin list shows whether the variable is set.

The commented template is in `.env.example`, section "AI / OCR vendor
secrets".

## Adapters

| Adapter                                    | Endpoint                                      | Secret (env var value)                                                                      | Model / region                                                                                       |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Claude (Anthropic API)                     | —                                             | Anthropic API key                                                                           | Model `claude-opus-5-5` (default; owner can change)                                                  |
| Claude via AWS Bedrock                     | —                                             | Bedrock API key **or** `ACCESS_KEY_ID:SECRET_ACCESS_KEY[:SESSION]`; empty → server IAM role | Model `anthropic.claude-opus-5-5`; region e.g. `ap-southeast-3` (Jakarta) where the model is offered |
| AWS Textract (Analyze Expense)             | —                                             | `ACCESS_KEY_ID:SECRET_ACCESS_KEY[:SESSION]`; empty → IAM role                               | Region                                                                                               |
| Google Document AI (Invoice Parser)        | Processor `https://…/processors/<id>:process` | Service-account JSON (raw or base64)                                                        | —                                                                                                    |
| OpenAI-compatible endpoint                 | Full `…/chat/completions` URL                 | Bearer API key                                                                              | Model name; images only (JPG/PNG/WebP/GIF)                                                           |
| Generic HTTP (SerenTax contract)           | Your HTTPS endpoint                           | Bearer token                                                                                | Optional model name                                                                                  |
| Manual / Local test / External (not ready) | —                                             | —                                                                                           | Built-in, no vendor                                                                                  |

Rules enforced on save:

- **Endpoint.** Required where the table lists one. It must be public HTTPS;
  loopback, private and metadata ranges are rejected (SSRF protection).
- **Secret reference.** Required for the Anthropic API, Document AI,
  OpenAI-compatible and generic HTTP adapters. It is optional for the AWS
  adapters, which can use an IAM role.
- **Enabling.** An external adapter can only be enabled when **Vendor
  approved** is ticked.

Data residency: choose a vendor and region that matches the commitment you
publish in **Settings → Data & privacy** (`DATA_STORAGE_LOCATION`). The
first-party Anthropic API processes outside Indonesia. AWS Bedrock and
Textract run in the region you configure.

## How Claude is called

The Claude adapters use the official `@anthropic-ai/sdk` and
`@anthropic-ai/bedrock-sdk` (`AnthropicBedrockMantle`).

- Each request makes one `messages.parse` call with structured output
  (`zodOutputFormat`), so the response is always valid JSON matching
  `llmExtractionSchema`.
- PDFs are sent as `document` blocks and images as `image` blocks.
- A system prompt tells the model to treat the document as untrusted data.
- A refusal (`stop_reason: "refusal"`) is not retried. The job fails, and the
  user continues with manual entry.
- Error handling is a typed chain:
  - authentication or permission errors mean the secret is missing or
    invalid, and are not retried;
  - rate-limit and 5xx errors are retried;
  - timeouts are retried.

## Generic HTTP contract

Request, sent as `POST <endpoint>` with `Authorization: Bearer <secret>`:

```json
{
  "fileName": "faktur.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "…",
  "model": "…",
  "maxPages": 10
}
```

Response (`200`):

```json
{
  "providerVersion": "vendor-1.2",
  "pageCount": 1,
  "fields": {
    "invoiceNumber": { "value": "010.000-26.00000001", "confidence": 0.97 },
    "documentDate": { "value": "2026-11-16", "confidence": 0.95 },
    "taxPeriod": { "value": "2026-11", "confidence": 0.9 },
    "counterpartyName": { "value": "PT Penjual", "confidence": 0.93 },
    "counterpartyIdentity": { "value": "0123456789012345", "confidence": 0.88 },
    "currency": { "value": "IDR", "confidence": 0.99 },
    "totalAmount": { "value": "1110000.00", "confidence": 0.96 },
    "lines": [
      {
        "description": { "value": "Jasa konsultasi", "confidence": 0.9 },
        "quantity": { "value": "1", "confidence": 0.9 },
        "unitPrice": { "value": "1000000.00", "confidence": 0.9 }
      }
    ]
  }
}
```

- Use `value: null` for fields that are absent.
- `confidence` is a number from 0 to 1. Values below 0.85 force human
  verification of sensitive fields.
- HTTP status handling:
  - `401` or `403` means the secret is missing;
  - `408`, `429` and `5xx` are retried;
  - any other status fails the job.

## Adding a new vendor

1. Add the key to `ocrAdapterKeys` and `ocrAdapterRequirements` in
   `lib/intake/ocr.ts`, and add a Prisma enum value with a migration.
2. Implement the adapter in `server/ocr/providers.ts`. It must return
   `rawFields` only; sanitization stays in `normalizeCandidateFields`.
3. Register the adapter in `resolveOcrAdapter`.
4. Add a registry entry (`ocrAdapter` in `i18n/codes.ts`), labels and a setup
   guide (`i18n/ocr.ts`), and a mapper unit test in
   `tests/unit/ocr-providers.test.ts`.
5. Add the secret template to `.env.example`.
