import { z } from "zod";
import { amountPattern, quantityPattern } from "./decimal";

export const ocrAdapterKeys = [
  "NONE",
  "SYNTHETIC_TEST",
  "EXTERNAL_NOT_CONFIGURED",
] as const;
export type OcrAdapterKey = (typeof ocrAdapterKeys)[number];

export const ocrJobStatuses = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "DEAD_LETTER",
  "CANCELLED",
] as const;
export type OcrJobStatus = (typeof ocrJobStatuses)[number];

export const LOW_CONFIDENCE_THRESHOLD = 0.85;

export type OcrConfidence = number | "unknown";

export type OcrCandidateField = {
  raw: string | null;
  normalized: string | null;
  confidence: OcrConfidence;
  span?: { page: number; label?: string };
  requiresVerification: boolean;
  sanitized: boolean;
};

export type OcrCandidateLine = {
  description: OcrCandidateField;
  quantity: OcrCandidateField;
  unitPrice: OcrCandidateField;
};

export type OcrExtractedFields = {
  invoiceNumber: OcrCandidateField;
  documentDate: OcrCandidateField;
  taxPeriod: OcrCandidateField;
  counterpartyName: OcrCandidateField;
  counterpartyIdentity: OcrCandidateField;
  currency: OcrCandidateField;
  totalAmount: OcrCandidateField;
  lines: OcrCandidateLine[];
};

const injectionPatterns = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /disregard\s+(all\s+)?instructions?/i,
  /\b(system\s+prompt|developer\s+message|assistant\s*:|system\s*:)\b/i,
  /\b(override\s+tax|set\s+tax\s+rate|auto[\s-]*approve|bypass\s+review)\b/i,
  /<script\b|javascript:|<\/?[a-z][^>]*>/i,
];

/**
 * Treats OCR output as untrusted data: strips control chars and markup,
 * flags and neutralizes prompt-injection directives so they are never executed
 * or silently copied into accounting fields.
 */
export function sanitizeOcrText(
  raw: string | null | undefined,
  maxLen = 200,
): { value: string | null; injectionDetected: boolean; sanitized: boolean } {
  if (raw === null || raw === undefined)
    return { value: null, injectionDetected: false, sanitized: false };
  const normalized = raw.normalize("NFKC");
  const injectionDetected = injectionPatterns.some((pattern) =>
    pattern.test(normalized),
  );
  const withoutControls = Array.from(normalized)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x20 || code === 0x7f ? " " : ch;
    })
    .join("");
  const stripped = withoutControls
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped !== raw.trim()) {
    // Markup or control chars were stripped; mark sanitized.
  }
  const truncated = stripped.slice(0, maxLen).trim();
  if (injectionDetected) {
    return {
      value: null,
      injectionDetected: true,
      sanitized: true,
    };
  }
  return {
    value: truncated || null,
    injectionDetected: false,
    sanitized: truncated !== raw.trim(),
  };
}

export function isLowConfidence(confidence: OcrConfidence): boolean {
  return confidence === "unknown" || confidence < LOW_CONFIDENCE_THRESHOLD;
}

export function isValidSecretRefName(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(value);
}

/**
 * Validates external OCR endpoint URLs configured by superadmins against SSRF:
 * requires HTTPS, rejects credentials/query/fragments, and blocks loopback,
 * link-local, metadata, and private IPv4/IPv6 ranges.
 */
export function isSafeHttpsEndpointUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password || url.search || url.hash) return false;
  const host = url.hostname.toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    return false;
  if (host.startsWith("[") || host.includes(":")) return false;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const octets = ipv4.slice(1).map((n) => Number(n));
    if (octets.some((o) => o < 0 || o > 255)) return false;
    const [a, b] = octets;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
      return false;
  } else if (!host.includes(".")) {
    return false;
  }
  return true;
}

export const providerConfigCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("upsert"),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]{2,40}$/),
      displayName: z.string().trim().min(2).max(100),
      adapterKey: z.enum(ocrAdapterKeys),
      endpointUrl: z
        .string()
        .trim()
        .max(300)
        .optional()
        .transform((v) => (v ? v : undefined)),
      secretRef: z
        .string()
        .trim()
        .max(64)
        .optional()
        .transform((v) => (v ? v : undefined)),
      model: z.string().trim().min(1).max(80),
      region: z.string().trim().min(1).max(40),
      maxPages: z.coerce.number().int().min(1).max(100),
      timeoutMs: z.coerce.number().int().min(1000).max(60000),
      monthlyPageCap: z.coerce.number().int().min(0).max(1000000),
      monthlySpendCapIdr: z.string().trim().regex(amountPattern),
      estimatedCostPerPageIdr: z.string().trim().regex(amountPattern),
      retentionPolicy: z.enum([
        "ZERO_RETENTION_REQUIRED",
        "EPHEMERAL_PROCESSING_ONLY",
        "LOCAL_ONLY",
      ]),
      processorNotice: z.string().trim().max(500).default(""),
      vendorApproved: z.boolean(),
      enabled: z.boolean(),
    })
    .strict(),
]);

export const orgOcrSettingsSchema = z
  .object({
    providerSlug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{2,40}$/),
    externalAiConsent: z.boolean(),
  })
  .strict();

export const ocrCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("enqueue"),
      documentId: z.string().trim().min(1).max(100),
      idempotencyKey: z.uuid().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("retry"),
      jobId: z.string().trim().min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("fallback"),
      jobId: z.string().trim().min(1).max(100).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("apply"),
      candidateId: z.string().trim().min(1).max(100),
      verifiedLowConfidence: z.boolean().default(false),
      values: z
        .object({
          invoiceNumber: z.string().trim().min(1).max(64).optional(),
          documentDate: z.iso.date().optional(),
          taxPeriod: z
            .string()
            .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
            .optional(),
          description: z.string().trim().max(1000).optional(),
          lineDescription: z.string().trim().min(1).max(500).optional(),
          quantity: z.string().trim().regex(quantityPattern).optional(),
          unitPrice: z.string().trim().regex(amountPattern).optional(),
          verifiedCounterpartyIdentity: z.string().trim().max(64).optional(),
        })
        .strict(),
    })
    .strict(),
]);
