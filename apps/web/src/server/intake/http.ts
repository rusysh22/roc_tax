import { ZodError } from "zod";
import { getAuth } from "../auth";
import { authConfiguration } from "../auth/config";
import { BodyTooLarge, InvalidBody } from "../http";
import { TrialError } from "../trial/service";
import { AccessError } from "../workspaces/policy";
import { BillingProviderError } from "../billing/berlanggan";
import { BillingError } from "../billing/service";
import { ExportError } from "../export/service";
import { OcrError } from "../ocr/service";
import { ReportsError } from "../reports/service";
import { TaxError } from "../tax/service";
import { DocumentError } from "./documents";
import { ImportBatchError } from "./imports";
import { IntakeError } from "./service";
import { SpreadsheetError } from "./spreadsheet";
import { WorkspaceLockedError } from "../lifecycle/state";
import { LifecycleError } from "../lifecycle/service";
import { InvoiceError } from "../invoicing/service";

export const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function requireSessionId(request: Request, mutate: boolean) {
  if (mutate && request.headers.get("origin") !== authConfiguration().origin)
    throw new AccessError("FORBIDDEN");
  const session = await getAuth().api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) throw new AccessError("UNAUTHENTICATED");
  return session.session.id;
}

export function intakeErrorResponse(error: unknown) {
  if (error instanceof WorkspaceLockedError)
    return jsonResponse(
      { code: error.code },
      error.code === "BILLING_OVERDUE" ? 402 : 403,
    );
  if (error instanceof InvoiceError)
    return jsonResponse(
      { code: error.code },
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "INVALID_PAYMENT_LINK"
          ? 400
          : 409,
    );
  if (error instanceof LifecycleError)
    return jsonResponse(
      { code: error.code },
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "OWNER_ONLY"
          ? 403
          : 409,
    );
  if (error instanceof BodyTooLarge)
    return jsonResponse({ code: "DOCUMENT_TOO_LARGE" }, 413);
  if (error instanceof InvalidBody || error instanceof ZodError)
    return jsonResponse({ code: "INVALID_INPUT" }, 400);
  if (error instanceof DocumentError)
    return jsonResponse(
      { code: error.code },
      error.code === "DOCUMENT_TOO_LARGE" ? 413 : 400,
    );
  if (error instanceof SpreadsheetError)
    return jsonResponse(
      { code: error.code },
      error.code === "SPREADSHEET_TOO_LARGE" ? 413 : 400,
    );
  if (error instanceof ImportBatchError) {
    const status =
      error.code === "MAPPING_INCOMPLETE" ||
      error.code === "NO_VALID_ROWS" ||
      error.code === "UNKNOWN_COMPANY" ||
      error.code === "ARCHIVED_COMPANY"
        ? 400
        : error.code === "TRIAL_SINGLE_ROW_LIMIT"
          ? 403
          : 409;
    return jsonResponse({ code: error.code, preview: error.preview }, status);
  }
  if (error instanceof IntakeError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "VALIDATION_FAILED"
          ? 400
          : 409;
    return jsonResponse({ code: error.code, ...error.details }, status);
  }
  if (error instanceof OcrError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "SPEND_CAP_EXCEEDED"
          ? 429
          : error.code === "INVALID_ENDPOINT_URL" ||
              error.code === "INVALID_SECRET_REF" ||
              error.code === "LINE_PRECISION" ||
              error.code === "LOW_CONFIDENCE_VERIFICATION_REQUIRED" ||
              error.code === "CONSENT_REQUIRED"
            ? 400
            : error.code === "JOB_ALREADY_ACTIVE" ||
                error.code === "INVALID_STATE"
              ? 409
              : 403;
    return jsonResponse({ code: error.code }, status);
  }
  if (error instanceof TaxError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "SME_REVIEW_REQUIRED" ||
            error.code === "INVALID_EFFECTIVE_RANGE" ||
            error.code === "INVALID_TAX_RATE" ||
            error.code === "EVALUATION_REQUIRED" ||
            error.code === "EVALUATION_HAS_BLOCKERS" ||
            error.code === "SOLE_USER_ACK_REQUIRED"
          ? 400
          : error.code === "SELF_APPROVAL_BLOCKED" ||
              error.code === "PRODUCTION_RULE_UNVERIFIED"
            ? 403
            : 409;
    return jsonResponse({ code: error.code }, status);
  }
  if (error instanceof ExportError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "INTEGRITY_MISMATCH"
          ? 500
          : error.code === "COMPANY_TAX_ID_REQUIRED" ||
              error.code === "COUNTERPARTY_TIN_REQUIRED" ||
              error.code === "RECIPIENT_TKU_REQUIRED" ||
              error.code === "UNSUPPORTED_CURRENCY" ||
              error.code === "WITHHOLDING_DATE_INVALID" ||
              error.code === "XML_VALIDATION_FAILED"
            ? 400
            : 409;
    return jsonResponse({ code: error.code }, status);
  }
  if (error instanceof BillingError) {
    const status =
      error.code === "NOT_FOUND"
        ? 404
        : error.code === "INVALID_WEBHOOK_SIGNATURE" ||
            error.code === "ENTITLEMENT_SIGNATURE_INVALID"
          ? 401
          : error.code === "RATE_LIMITED"
            ? 429
            : error.code === "INVALID_CONFIGURATION"
              ? 400
              : 409;
    return jsonResponse({ code: error.code }, status);
  }
  if (error instanceof BillingProviderError) {
    return jsonResponse({ code: error.code }, 502);
  }
  if (error instanceof ReportsError) {
    const status = error.code === "NOT_FOUND" ? 404 : 403;
    return jsonResponse({ code: error.code }, status);
  }
  if (error instanceof TrialError)
    return jsonResponse(
      { code: error.code },
      error.code === "IDEMPOTENCY_CONFLICT" ? 409 : 403,
    );
  if (error instanceof AccessError)
    return jsonResponse(
      { code: error.code },
      error.code === "UNAUTHENTICATED"
        ? 401
        : error.code === "RATE_LIMITED"
          ? 429
          : 403,
    );
  return jsonResponse({ code: "SERVICE_UNAVAILABLE" }, 503);
}
