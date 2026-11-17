import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  guessColumnMapping,
  isFormulaText,
  sanitizeExportCell,
  templateHeaders,
} from "../../apps/web/src/lib/intake/spreadsheet";
import {
  buildImportTemplate,
  parseSpreadsheet,
  serializeCsv,
  serializeXlsx,
} from "../../apps/web/src/server/intake/spreadsheet";
import { importMessages } from "../../apps/web/src/i18n/imports";

function singleEntryZip(entryName: string, content: string): Uint8Array {
  const nameBytes = new TextEncoder().encode(entryName);
  const rawBytes = new TextEncoder().encode(content);
  const compressed = deflateRawSync(rawBytes);

  const local = new Uint8Array(30 + nameBytes.length + compressed.length);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint16(8, 8, true);
  lv.setUint32(18, compressed.length, true);
  lv.setUint32(22, rawBytes.length, true);
  lv.setUint16(26, nameBytes.length, true);
  local.set(nameBytes, 30);
  local.set(compressed, 30 + nameBytes.length);

  const central = new Uint8Array(46 + nameBytes.length);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint16(10, 8, true);
  cv.setUint32(20, compressed.length, true);
  cv.setUint32(24, rawBytes.length, true);
  cv.setUint16(28, nameBytes.length, true);
  cv.setUint32(42, 0, true);
  central.set(nameBytes, 46);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);

  const out = new Uint8Array(local.length + central.length + eocd.length);
  out.set(local, 0);
  out.set(central, local.length);
  out.set(eocd, local.length + central.length);
  return out;
}

describe("spreadsheet parser & formula safety", () => {
  it("neutralizes exported formulas and detects formula strings on import", () => {
    expect(sanitizeExportCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
    expect(sanitizeExportCell("  +cmd|'/c calc'!A0")).toBe(
      "'  +cmd|'/c calc'!A0",
    );
    expect(sanitizeExportCell("-100")).toBe("'-100");
    expect(sanitizeExportCell("@IMPORTXML()")).toBe("'@IMPORTXML()");
    expect(sanitizeExportCell("\t=1+1")).toBe("'\t=1+1");
    expect(sanitizeExportCell("Normal text")).toBe("Normal text");

    expect(isFormulaText("=1+1")).toBe(true);
    expect(isFormulaText(" -cmd")).toBe(true);
    expect(isFormulaText("@sum")).toBe(true);
    expect(isFormulaText("INV-2026-01")).toBe(false);

    const csv = serializeCsv([["header"], ["=EVIL()"], ['value,with"quote']]);
    expect(csv).toContain("'=EVIL()");
    expect(csv).toContain('"value,with""quote"');
  });

  it("round-trips CSV and XLSX templates and guesses header mappings in id/en", () => {
    const csvTpl = buildImportTemplate("csv", "PPH_UNIFIKASI_BPPU");
    const parsedCsv = parseSpreadsheet({
      bytes: csvTpl.bytes,
      fileName: csvTpl.fileName,
    });
    expect(parsedCsv.format).toBe("CSV");
    expect(parsedCsv.rows).toHaveLength(1);
    expect(parsedCsv.rows[0].cells[templateHeaders.taxFamily].value).toBe(
      "PPH_UNIFIKASI_BPPU",
    );

    const xlsxTpl = buildImportTemplate("xlsx", "PPN_FAKTUR_KELUARAN");
    const parsedXlsx = parseSpreadsheet({
      bytes: xlsxTpl.bytes,
      fileName: xlsxTpl.fileName,
    });
    expect(parsedXlsx.format).toBe("XLSX");
    expect(parsedXlsx.rows).toHaveLength(1);
    expect(parsedXlsx.rows[0].cells[templateHeaders.documentType].value).toBe(
      "SALES_INVOICE",
    );

    const guessed = guessColumnMapping([
      "Nomor Invoice",
      "Tanggal Dokumen",
      "Masa Pajak",
      "Jenis Dokumen",
      "Keluarga Dokumen",
      "Lawan Transaksi",
      "Uraian Baris",
      "Kuantitas",
      "Harga Satuan",
      "Mata Uang",
    ]);
    expect(guessed.invoiceNumber).toBe("Nomor Invoice");
    expect(guessed.unitPrice).toBe("Harga Satuan");
  });

  it("flags XLSX <f> formula elements without executing them and rejects XXE/malformed files", () => {
    const formulaSheet =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      "<sheetData>" +
      '<row r="1"><c r="A1" t="inlineStr"><is><t>invoice_number</t></is></c></row>' +
      '<row r="2"><c r="A2"><f>SUM(1,2)</f><v>3</v></c></row>' +
      "</sheetData></worksheet>";
    const zip = singleEntryZip("xl/worksheets/sheet1.xml", formulaSheet);
    const parsed = parseSpreadsheet({ bytes: zip, fileName: "formula.xlsx" });
    expect(parsed.rows[0].cells.invoice_number.hasFormula).toBe(true);
    expect(parsed.rows[0].cells.invoice_number.value).toBe("3");

    const xxeSheet =
      '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><worksheet/>';
    const xxeZip = singleEntryZip("xl/worksheets/sheet1.xml", xxeSheet);
    expect(() =>
      parseSpreadsheet({ bytes: xxeZip, fileName: "xxe.xlsx" }),
    ).toThrow("SPREADSHEET_UNSAFE_XML");

    expect(() =>
      parseSpreadsheet({
        bytes: new TextEncoder().encode("not a zip"),
        fileName: "broken.xlsx",
      }),
    ).toThrow("SPREADSHEET_FORMAT");

    expect(() =>
      parseSpreadsheet({
        bytes: serializeXlsx([["a"], ["b"]]),
        fileName: "mismatch.csv",
      }),
    ).toThrow("SPREADSHEET_FORMAT");

    expect(() =>
      parseSpreadsheet({
        bytes: new TextEncoder().encode('a,b\n"unclosed,1'),
        fileName: "bad.csv",
      }),
    ).toThrow("SPREADSHEET_MALFORMED");
  });

  it("keeps bilingual import dictionaries aligned", () => {
    expect(Object.keys(importMessages.id).sort()).toEqual(
      Object.keys(importMessages.en).sort(),
    );
    expect(Object.keys(importMessages.id.columns).sort()).toEqual(
      Object.keys(importMessages.en.columns).sort(),
    );
    expect(Object.keys(importMessages.id.issueCodes).sort()).toEqual(
      Object.keys(importMessages.en.issueCodes).sort(),
    );
    expect(Object.keys(importMessages.id.errors).sort()).toEqual(
      Object.keys(importMessages.en.errors).sort(),
    );
  });
});
