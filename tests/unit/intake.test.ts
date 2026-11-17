import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalFixed,
  lineAmount,
  sumAmounts,
} from "../../apps/web/src/lib/intake/decimal";
import {
  normalizeInvoiceNumber,
  validateIdentity,
  validateNitku,
} from "../../apps/web/src/lib/intake/identity";
import { draftInputSchema } from "../../apps/web/src/lib/intake/schemas";
import { allows, canTransition } from "../../apps/web/src/lib/intake/state";
import { createTaxCrypto } from "../../apps/web/src/server/intake/crypto";
import {
  inspectDocument,
  sanitizeFileName,
} from "../../apps/web/src/server/intake/documents";
import { localDocumentStorage } from "../../apps/web/src/server/intake/storage";
import { intakeMessages } from "../../apps/web/src/i18n/intake";
import { siteMessages } from "../../apps/web/src/i18n/site";

describe("intake domain guardrails", () => {
  it("computes exact fixed-point amounts and rejects sub-cent rounding", () => {
    expect(lineAmount("2.5", "100.00")).toBe("250.00");
    expect(lineAmount("0.125", "1000.00")).toBe("125.00");
    expect(lineAmount("0.1", "0.02")).toBe(null);
    expect(lineAmount("0.3333", "10.00")).toBe(null);
    expect(sumAmounts(["0.10", "0.20", "999999999999999.70"])).toBe(
      "1000000000000000.00",
    );
    expect(canonicalFixed("12.5", 2)).toBe("12.50");
  });

  it("validates structural tax identity formats without live lookups", () => {
    expect(validateIdentity("NPWP", "01.234.567.8-901.000")).toBe(
      "012345678901000",
    );
    expect(validateIdentity("NPWP", "0123456789012345")).toBe(
      "0123456789012345",
    );
    expect(validateIdentity("NPWP", "12345")).toBe(null);
    expect(validateIdentity("NIK", "3171010101010001")).toBe(
      "3171010101010001",
    );
    expect(validateIdentity("NIK", "317101010101000")).toBe(null);
    expect(validateIdentity("FOREIGN_TIN", " sg-199901234a ")).toBe(
      "SG-199901234A",
    );
    expect(validateNitku("0123456789012345-000001")).toBe(
      "0123456789012345000001",
    );
    expect(validateNitku("0123456789012345")).toBe(null);
    expect(normalizeInvoiceNumber(" inv 2026 / 01 ")).toBe("INV2026/01");
  });

  it("encrypts tax identifiers with tenant-bound AAD and deterministic blind indexes", () => {
    const crypto = createTaxCrypto(
      "synthetic-unit-test-tax-secret-key-0123456789",
    );
    const first = crypto.protect("org_a", "COMPANY_NPWP", "0123456789012345");
    const second = crypto.protect("org_a", "COMPANY_NPWP", "0123456789012345");
    const otherTenant = crypto.protect(
      "org_b",
      "COMPANY_NPWP",
      "0123456789012345",
    );
    expect(first.cipher).not.toBe(second.cipher);
    expect(first.index).toBe(second.index);
    expect(first.index).not.toBe(otherTenant.index);
    expect(first.hint).toBe("2345");
    expect(crypto.reveal("org_a", "COMPANY_NPWP", first.cipher)).toBe(
      "0123456789012345",
    );
    expect(() =>
      crypto.reveal("org_b", "COMPANY_NPWP", first.cipher),
    ).toThrow();
    expect(() =>
      crypto.reveal("org_a", "COMPANY_NITKU", first.cipher),
    ).toThrow();
  });

  it("validates PDF/PNG/JPG magic bytes, extensions, names and size", () => {
    const pdf = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37,
    ]);
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
    ]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(
      inspectDocument({
        bytes: pdf,
        declaredType: "application/pdf",
        fileName: "../dir/invoice<1>.pdf",
      }).name,
    ).toBe("invoice_1_.pdf");
    expect(
      inspectDocument({
        bytes: png,
        declaredType: "image/png",
        fileName: "scan.PNG",
      }).mimeType,
    ).toBe("image/png");
    expect(
      inspectDocument({
        bytes: jpg,
        declaredType: "image/jpeg",
        fileName: "photo.jpg",
      }).mimeType,
    ).toBe("image/jpeg");
    expect(() =>
      inspectDocument({
        bytes: new Uint8Array(),
        declaredType: "application/pdf",
        fileName: "empty.pdf",
      }),
    ).toThrow("DOCUMENT_EMPTY");
    expect(() =>
      inspectDocument({
        bytes: Buffer.from("<script>alert(1)</script>"),
        declaredType: "application/pdf",
        fileName: "spoofed.pdf",
      }),
    ).toThrow("DOCUMENT_CONTENT");
    expect(() =>
      inspectDocument({
        bytes: pdf,
        declaredType: "image/png",
        fileName: "mismatch.png",
      }),
    ).toThrow("DOCUMENT_CONTENT");
    expect(() =>
      inspectDocument({
        bytes: pdf,
        declaredType: "application/pdf",
        fileName: "mismatch.png",
      }),
    ).toThrow("DOCUMENT_EXTENSION");
    expect(() =>
      inspectDocument({
        bytes: pdf,
        declaredType: "image/svg+xml",
        fileName: "vector.svg",
      }),
    ).toThrow("DOCUMENT_TYPE");
    expect(sanitizeFileName("..")).toBe(null);
  });

  it("prevents path traversal and cross-tenant reads in private storage", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "serentax-storage-"));
    try {
      const store = localDocumentStorage(dir);
      const key = await store.put("org_alpha", new Uint8Array([1, 2, 3, 4]));
      expect(Array.from(await store.get("org_alpha", key))).toEqual([
        1, 2, 3, 4,
      ]);
      await expect(store.get("org_beta", key)).rejects.toThrow(
        "INVALID_STORAGE_KEY",
      );
      await expect(
        store.get("org_alpha", "org_alpha/../secret"),
      ).rejects.toThrow("INVALID_STORAGE_KEY");
      await store.remove("org_alpha", key);
      await expect(store.get("org_alpha", key)).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("blocks PPh21/PPh26 invoice intake and enforces state-machine rules", () => {
    expect(
      draftInputSchema.safeParse({
        companyId: "c1",
        counterpartyId: "cp1",
        taxFamily: "PPH21_BP21",
        documentType: "SUPPLIER_INVOICE",
        invoiceNumber: "INV-1",
        documentDate: "2026-11-16",
        taxPeriod: "2026-11",
        currency: "IDR",
        lines: [{ description: "Service", quantity: "1", unitPrice: "100.00" }],
      }).success,
    ).toBe(false);
    expect(allows("DRAFT", "edit")).toBe(true);
    expect(allows("APPROVED", "edit")).toBe(false);
    expect(allows("VOIDED", "edit")).toBe(false);
    expect(allows("VOIDED", "comment")).toBe(false);
    expect(canTransition("DRAFT", "VOIDED")).toBe(true);
    expect(canTransition("VOIDED", "DRAFT")).toBe(false);
    expect(canTransition("APPROVED", "DRAFT")).toBe(false);
  });

  it("keeps bilingual intake and site dictionaries aligned", () => {
    expect(Object.keys(intakeMessages.id).sort()).toEqual(
      Object.keys(intakeMessages.en).sort(),
    );
    expect(Object.keys(intakeMessages.id.issues).sort()).toEqual(
      Object.keys(intakeMessages.en.issues).sort(),
    );
    expect(Object.keys(intakeMessages.id.errors).sort()).toEqual(
      Object.keys(intakeMessages.en.errors).sort(),
    );
    expect(Object.keys(siteMessages.id).sort()).toEqual(
      Object.keys(siteMessages.en).sort(),
    );
  });
});
