import { z } from "zod";
import { amountPattern, quantityPattern } from "../intake/decimal";

/**
 * PPN — Faktur Pajak Keluaran: data model and completeness validation.
 *
 * STATUS: framework only. The official DJP Coretax XML template/XSD for this
 * family has not been supplied, so `serializePpnFakturXml` always refuses with
 * TEMPLATE_UNVERIFIED. Field names below describe the business data a Faktur
 * Pajak needs; they are NOT the official XML element names. When the official
 * template arrives: register it (Superadmin → XML templates), derive the
 * element order from its XSD, implement the serializer against the official
 * sample with fixture tests, add the family to `familiesWithSerializer`, and
 * have a Tax SME approve the PPN rules. Transaction codes and rates are tax
 * facts and must come from SME-approved rules, never from this file.
 */

const npwp16 = /^\d{16}$/;
const nitku22 = /^\d{22}$/;

export const ppnFakturLineSchema = z
  .object({
    /** Goods (barang) or services (jasa). */
    kind: z.enum(["GOODS", "SERVICES"]),
    /** Goods/services classification code from the official reference list. */
    itemCode: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(500),
    unitCode: z.string().trim().min(1).max(20),
    unitPrice: z.string().regex(amountPattern),
    quantity: z.string().regex(quantityPattern),
    discount: z.string().regex(amountPattern).default("0.00"),
    taxBase: z.string().regex(amountPattern),
    otherTaxBase: z.string().regex(amountPattern).optional(),
    vatAmount: z.string().regex(amountPattern),
    luxuryTaxRate: z.string().regex(amountPattern).default("0.00"),
    luxuryTaxAmount: z.string().regex(amountPattern).default("0.00"),
  })
  .strict();

export const ppnFakturSchema = z
  .object({
    seller: z
      .object({
        npwp: z.string().regex(npwp16),
        nitku: z.string().regex(nitku22),
        name: z.string().trim().min(1).max(200),
      })
      .strict(),
    buyer: z
      .object({
        identityType: z.enum(["NPWP", "NIK", "PASSPORT", "OTHER"]),
        identity: z.string().trim().min(1).max(64),
        nitku: z.string().regex(nitku22).optional(),
        name: z.string().trim().min(1).max(200),
        address: z.string().trim().min(1).max(500),
        email: z.email().optional(),
        countryCode: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .optional(),
      })
      .strict(),
    invoiceDate: z.iso.date(),
    /** Transaction code (kode transaksi) — value must come from an SME-approved rule. */
    transactionCode: z.string().trim().min(1).max(4),
    referenceNumber: z.string().trim().max(100).optional(),
    lines: z.array(ppnFakturLineSchema).min(1).max(1000),
  })
  .strict();
export type PpnFaktur = z.infer<typeof ppnFakturSchema>;

export type PpnIssue = { path: string; code: string };

/** Data completeness check for a Faktur Pajak (does not compute tax). */
export function validatePpnFaktur(input: unknown): {
  ok: boolean;
  issues: PpnIssue[];
} {
  const parsed = ppnFakturSchema.safeParse(input);
  if (parsed.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
    })),
  };
}

export class PpnTemplateUnverifiedError extends Error {
  readonly code = "TEMPLATE_UNVERIFIED" as const;
  constructor() {
    super("TEMPLATE_UNVERIFIED");
  }
}

/**
 * Refuses until a source-verified serializer exists. Kept as an explicit
 * function so call sites and tests prove the family stays fail-closed.
 */
export function serializePpnFakturXml(faktur: PpnFaktur): never {
  void faktur;
  throw new PpnTemplateUnverifiedError();
}
