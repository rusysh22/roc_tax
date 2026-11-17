import { createHash } from "node:crypto";
import { inflateRawSync, deflateRawSync } from "node:zlib";
import {
  importColumns,
  sanitizeExportCell,
  templateHeaders,
} from "../../lib/intake/spreadsheet";
import type { intakeFamilies } from "../../lib/intake/schemas";

export const MAX_SPREADSHEET_BYTES = 2 * 1024 * 1024;
export const MAX_DECOMPRESSED_XML_BYTES = 8 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 64;
export const MAX_SPREADSHEET_ROWS = 200;
export const MAX_SPREADSHEET_COLUMNS = 32;

export type ParsedCell = {
  value: string;
  hasFormula: boolean;
};

export type ParsedSheet = {
  format: "CSV" | "XLSX";
  sha256: string;
  headers: string[];
  rows: { rowNumber: number; cells: Record<string, ParsedCell> }[];
};

export class SpreadsheetError extends Error {
  constructor(
    public code:
      | "SPREADSHEET_EMPTY"
      | "SPREADSHEET_TOO_LARGE"
      | "SPREADSHEET_FORMAT"
      | "SPREADSHEET_MALFORMED"
      | "SPREADSHEET_UNSAFE_XML"
      | "SPREADSHEET_TOO_MANY_ROWS"
      | "SPREADSHEET_TOO_MANY_COLUMNS"
      | "SPREADSHEET_NO_DATA",
  ) {
    super(code);
  }
}

const zipMagic = [0x50, 0x4b, 0x03, 0x04];

export function parseSpreadsheet(input: {
  bytes: Uint8Array;
  fileName: string;
}): ParsedSheet {
  if (input.bytes.length === 0) throw new SpreadsheetError("SPREADSHEET_EMPTY");
  if (input.bytes.length > MAX_SPREADSHEET_BYTES)
    throw new SpreadsheetError("SPREADSHEET_TOO_LARGE");

  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const lower = input.fileName.toLowerCase();
  const isZip =
    input.bytes.length >= 4 &&
    zipMagic.every((b, idx) => input.bytes[idx] === b);

  if (lower.endsWith(".xlsx")) {
    if (!isZip) throw new SpreadsheetError("SPREADSHEET_FORMAT");
    return parseXlsx(input.bytes, sha256);
  }
  if (lower.endsWith(".csv")) {
    if (isZip) throw new SpreadsheetError("SPREADSHEET_FORMAT");
    return parseCsv(input.bytes, sha256);
  }
  throw new SpreadsheetError("SPREADSHEET_FORMAT");
}

function parseCsv(bytes: Uint8Array, sha256: string): ParsedSheet {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new SpreadsheetError("SPREADSHEET_MALFORMED");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.includes("\u0000"))
    throw new SpreadsheetError("SPREADSHEET_MALFORMED");

  const rawRows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      if (field.length !== 0)
        throw new SpreadsheetError("SPREADSHEET_MALFORMED");
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      if (row.length > MAX_SPREADSHEET_COLUMNS)
        throw new SpreadsheetError("SPREADSHEET_TOO_MANY_COLUMNS");
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rawRows.push(row);
      row = [];
      if (rawRows.length > MAX_SPREADSHEET_ROWS + 1)
        throw new SpreadsheetError("SPREADSHEET_TOO_MANY_ROWS");
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new SpreadsheetError("SPREADSHEET_MALFORMED");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rawRows.push(row);
  }
  return buildSheetFromMatrix("CSV", sha256, rawRows);
}

function buildSheetFromMatrix(
  format: "CSV" | "XLSX",
  sha256: string,
  matrix: string[][],
  formulaCoords: Set<string> = new Set(),
): ParsedSheet {
  const nonEmpty = matrix.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length < 2) throw new SpreadsheetError("SPREADSHEET_NO_DATA");
  if (nonEmpty.length - 1 > MAX_SPREADSHEET_ROWS)
    throw new SpreadsheetError("SPREADSHEET_TOO_MANY_ROWS");

  const rawHeaders = nonEmpty[0].map((h) => h.trim());
  if (
    rawHeaders.length === 0 ||
    rawHeaders.length > MAX_SPREADSHEET_COLUMNS ||
    rawHeaders.some((h) => !h)
  )
    throw new SpreadsheetError("SPREADSHEET_MALFORMED");
  const seen = new Set<string>();
  for (const h of rawHeaders) {
    const key = h.toLowerCase();
    if (seen.has(key)) throw new SpreadsheetError("SPREADSHEET_MALFORMED");
    seen.add(key);
  }

  const rows: ParsedSheet["rows"] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r];
    if (!line || line.every((cell) => cell.trim().length === 0)) continue;
    if (line.length > MAX_SPREADSHEET_COLUMNS)
      throw new SpreadsheetError("SPREADSHEET_TOO_MANY_COLUMNS");
    const cells: Record<string, ParsedCell> = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const value = (line[c] ?? "").trim();
      const hasFormula = formulaCoords.has(`${r + 1}:${c}`);
      cells[rawHeaders[c]] = { value, hasFormula };
    }
    rows.push({ rowNumber: r + 1, cells });
  }
  if (rows.length === 0) throw new SpreadsheetError("SPREADSHEET_NO_DATA");
  return { format, sha256, headers: rawHeaders, rows };
}

function readZipEntries(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const minEocd = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocd; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SpreadsheetError("SPREADSHEET_MALFORMED");
  const totalEntries = view.getUint16(eocd + 10, true);
  if (totalEntries === 0 || totalEntries > MAX_ZIP_ENTRIES)
    throw new SpreadsheetError("SPREADSHEET_MALFORMED");
  const cdOffset = view.getUint32(eocd + 16, true);
  let ptr = cdOffset;
  let decompressedTotal = 0;
  const files = new Map<string, string>();

  for (let idx = 0; idx < totalEntries; idx++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50)
      throw new SpreadsheetError("SPREADSHEET_MALFORMED");
    const flags = view.getUint16(ptr + 8, true);
    if ((flags & 0x1) !== 0)
      throw new SpreadsheetError("SPREADSHEET_MALFORMED");
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const uncompressedSize = view.getUint32(ptr + 24, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    if (
      uncompressedSize > MAX_DECOMPRESSED_XML_BYTES ||
      decompressedTotal + uncompressedSize > MAX_DECOMPRESSED_XML_BYTES
    )
      throw new SpreadsheetError("SPREADSHEET_TOO_LARGE");

    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(ptr + 46, ptr + 46 + nameLen),
    );
    ptr += 46 + nameLen + extraLen + commentLen;
    if (name.includes("..") || name.startsWith("/"))
      throw new SpreadsheetError("SPREADSHEET_MALFORMED");

    if (
      name !== "xl/sharedStrings.xml" &&
      name !== "xl/worksheets/sheet1.xml" &&
      name !== "xl/workbook.xml"
    )
      continue;

    if (
      localHeaderOffset + 30 > bytes.length ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    )
      throw new SpreadsheetError("SPREADSHEET_MALFORMED");
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length)
      throw new SpreadsheetError("SPREADSHEET_MALFORMED");

    const slice = bytes.subarray(dataStart, dataEnd);
    let raw: Uint8Array;
    try {
      if (method === 0) raw = slice;
      else if (method === 8)
        raw = inflateRawSync(slice, {
          maxOutputLength: MAX_DECOMPRESSED_XML_BYTES,
        });
      else throw new SpreadsheetError("SPREADSHEET_MALFORMED");
    } catch (error) {
      if (error instanceof SpreadsheetError) throw error;
      throw new SpreadsheetError("SPREADSHEET_MALFORMED");
    }
    decompressedTotal += raw.byteLength;
    if (decompressedTotal > MAX_DECOMPRESSED_XML_BYTES)
      throw new SpreadsheetError("SPREADSHEET_TOO_LARGE");
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml))
      throw new SpreadsheetError("SPREADSHEET_UNSAFE_XML");
    files.set(name, xml);
  }
  return files;
}

function decodeXmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g,
    (_, entity: string) => {
      if (entity === "lt") return "<";
      if (entity === "gt") return ">";
      if (entity === "amp") return "&";
      if (entity === "quot") return '"';
      if (entity === "apos") return "'";
      const code = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff)
        throw new SpreadsheetError("SPREADSHEET_MALFORMED");
      return String.fromCodePoint(code);
    },
  );
}

function extractTextRuns(fragment: string): string {
  const parts: string[] = [];
  const regex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(fragment)) !== null) {
    parts.push(decodeXmlEntities(match[1]));
  }
  return parts.join("");
}

function columnIndexFromRef(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0];
  if (!letters) throw new SpreadsheetError("SPREADSHEET_MALFORMED");
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function parseXlsx(bytes: Uint8Array, sha256: string): ParsedSheet {
  const entries = readZipEntries(bytes);
  const sheetXml = entries.get("xl/worksheets/sheet1.xml");
  if (!sheetXml) throw new SpreadsheetError("SPREADSHEET_MALFORMED");

  const sharedStrings: string[] = [];
  const sharedXml = entries.get("xl/sharedStrings.xml");
  if (sharedXml) {
    const siRegex = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
    let si: RegExpExecArray | null;
    while ((si = siRegex.exec(sharedXml)) !== null) {
      sharedStrings.push(extractTextRuns(si[1]));
    }
  }

  const matrix: string[][] = [];
  const formulaCoords = new Set<string>();
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  let autoRow = 0;

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
    autoRow++;
    const rAttr = rowMatch[1].match(/\br="(\d+)"/)?.[1];
    const rowNumber = rAttr ? Number.parseInt(rAttr, 10) : autoRow;
    if (rowNumber < 1 || rowNumber > MAX_SPREADSHEET_ROWS + 1)
      throw new SpreadsheetError("SPREADSHEET_TOO_MANY_ROWS");
    while (matrix.length < rowNumber) matrix.push([]);
    const targetRow = matrix[rowNumber - 1];

    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let autoCol = 0;
    while ((cellMatch = cellRegex.exec(rowMatch[2])) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2] ?? "";
      const refAttr = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const colIdx = refAttr ? columnIndexFromRef(refAttr) : autoCol;
      autoCol = colIdx + 1;
      if (colIdx < 0 || colIdx >= MAX_SPREADSHEET_COLUMNS)
        throw new SpreadsheetError("SPREADSHEET_TOO_MANY_COLUMNS");

      if (/<f\b/.test(inner)) {
        formulaCoords.add(`${rowNumber}:${colIdx}`);
      }
      const typeAttr = attrs.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      const vMatch = inner.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (typeAttr === "s") {
        const idx = Number.parseInt(vMatch ?? "", 10);
        if (!Number.isFinite(idx) || idx < 0 || idx >= sharedStrings.length)
          throw new SpreadsheetError("SPREADSHEET_MALFORMED");
        value = sharedStrings[idx];
      } else if (typeAttr === "inlineStr") {
        value = extractTextRuns(inner);
      } else if (vMatch !== undefined) {
        value = decodeXmlEntities(vMatch);
      }
      while (targetRow.length <= colIdx) targetRow.push("");
      targetRow[colIdx] = value;
    }
  }
  return buildSheetFromMatrix("XLSX", sha256, matrix, formulaCoords);
}

function escapeCsvCell(raw: string): string {
  const safe = sanitizeExportCell(raw);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return (
    rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n"
  );
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colRef(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: { name: string; content: string }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const rawBytes = new TextEncoder().encode(file.content);
    const compressed = deflateRawSync(rawBytes);
    const crc = crc32(rawBytes);

    const local = new Uint8Array(30 + nameBytes.length + compressed.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 8, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compressed.length, true);
    lv.setUint32(22, rawBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(compressed, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, 8, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compressed.length, true);
    cv.setUint32(24, rawBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const total = offset + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const part of [...localParts, ...centralParts, eocd]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

export function serializeXlsx(
  rows: readonly (readonly string[])[],
): Uint8Array {
  const xmlRows = rows
    .map((row, rIdx) => {
      const cells = row
        .map((cell, cIdx) => {
          const ref = `${colRef(cIdx)}${rIdx + 1}`;
          const text = escapeXml(sanitizeExportCell(cell));
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
        })
        .join("");
      return `<row r="${rIdx + 1}">${cells}</row>`;
    })
    .join("");

  return createZip([
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        "</Types>",
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    },
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="SerenTaxImport" sheetId="1" r:id="rId1"/></sheets>' +
        "</workbook>",
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        "</Relationships>",
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${xmlRows}</sheetData>` +
        "</worksheet>",
    },
  ]);
}

export function buildImportTemplate(
  format: "csv" | "xlsx",
  family: (typeof intakeFamilies)[number],
): { bytes: Uint8Array; mimeType: string; fileName: string } {
  const docType =
    family === "PPN_FAKTUR_KELUARAN" ? "SALES_INVOICE" : "SUPPLIER_INVOICE";
  const headerRow = importColumns.map((col) => templateHeaders[col]);
  const sampleRow = [
    "SYNTHETIC-INV-001",
    "2026-11-16",
    "2026-11",
    docType,
    family,
    "PT Synthetic Counterparty",
    "9876543210987654",
    "Synthetic template example (replace before import)",
    "Synthetic service line",
    "1",
    "100000.00",
    "IDR",
  ];
  const slug = family.toLowerCase();
  if (format === "xlsx") {
    return {
      bytes: serializeXlsx([headerRow, sampleRow]),
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      fileName: `serentax-import-template-${slug}.xlsx`,
    };
  }
  return {
    bytes: new TextEncoder().encode(serializeCsv([headerRow, sampleRow])),
    mimeType: "text/csv; charset=utf-8",
    fileName: `serentax-import-template-${slug}.csv`,
  };
}
