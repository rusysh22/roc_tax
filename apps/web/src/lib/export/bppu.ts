import {
  bppuElementOrder,
  bppuGovTreasurerOpts,
  bppuSchema3DocTypes,
  bppuTaxCertificates,
  type BppuGovTreasurerOpt,
  type BppuTaxCertificate,
} from "./bppu-spec";

export type BpuItem = {
  taxPeriodMonth: number;
  taxPeriodYear: number;
  counterpartTin: string;
  recipientTku: string;
  taxCertificate: BppuTaxCertificate;
  taxObjectCode: string;
  taxBase: string;
  rate: string;
  document: (typeof bppuSchema3DocTypes)[number];
  documentNumber: string;
  documentDate: string;
  idPlaceOfBusinessActivity: string;
  govTreasurerOpt: BppuGovTreasurerOpt;
  sp2dNumber: string | null;
  withholdingDate: string;
};

export type BpuBulkDocument = {
  tin: string;
  items: BpuItem[];
};

const XML_ENTITY_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Rejects XML 1.0 illegal control characters cleanly before serializing. */
export function hasIllegalXmlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd)
    ) {
      continue;
    }
    return true;
  }
  return false;
}

export function escapeXmlText(raw: string): string {
  if (hasIllegalXmlChar(raw)) {
    throw new Error("ILLEGAL_XML_CHARACTER");
  }
  return raw.replace(/[&<>"']/g, (ch) => XML_ENTITY_MAP[ch]);
}

function unescapeXmlText(raw: string): string {
  return raw.replace(
    /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g,
    (match, token: string) => {
      if (token === "amp") return "&";
      if (token === "lt") return "<";
      if (token === "gt") return ">";
      if (token === "quot") return '"';
      if (token === "apos") return "'";
      const code = token.startsWith("#x")
        ? Number.parseInt(token.slice(2), 16)
        : Number.parseInt(token.slice(1), 10);
      if (
        !Number.isInteger(code) ||
        code === 0 ||
        (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) ||
        code > 0x10ffff
      ) {
        throw new Error("INVALID_XML_ENTITY");
      }
      return String.fromCodePoint(code);
    },
  );
}

/** Validates real YYYY-MM-DD calendar date including leap-year day counts. */
export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

/**
 * Formats TaxBase per DJP BPPU converter conventions (period decimal, positive,
 * without unnecessary trailing zeros like `100000000` for `100000000.00`).
 */
export function formatBppuDecimal(raw: string): string {
  const trimmed = raw.trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(trimmed)) {
    throw new Error("INVALID_BPPU_DECIMAL");
  }
  const [wholePart, fracPart] = trimmed.split(".");
  const cleanWhole = wholePart.replace(/^0+(?=\d)/, "");
  if (!fracPart) return cleanWhole;
  const cleanFrac = fracPart.replace(/0+$/, "");
  return cleanFrac ? `${cleanWhole}.${cleanFrac}` : cleanWhole;
}

/**
 * Converts a rational rule rate (e.g. `2 / 100`, `5 / 1000`, `25 / 10000`) to
 * the exact percentage decimal string expected by DJP `<Rate>` (`2`, `0.5`,
 * `0.25`) without binary floating-point rounding.
 */
export function rationalToBppuPercent(
  numerator: number,
  denominator: number,
): string {
  if (
    !Number.isInteger(numerator) ||
    !Number.isInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0 ||
    numerator > denominator
  ) {
    throw new Error("INVALID_BPPU_RATE");
  }
  const num = BigInt(numerator);
  const den = BigInt(denominator);
  const scale = BigInt(10000);
  const scaledNumerator = num * BigInt(100) * scale;
  if (scaledNumerator % den !== BigInt(0)) {
    throw new Error("NON_EXACT_PERCENT_RATE");
  }
  const value = scaledNumerator / den;
  const whole = value / scale;
  const frac = (value % scale).toString().padStart(4, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

function validateBpuItem(item: BpuItem, index: number) {
  const prefix = `Bpu[${index}]`;
  if (
    !Number.isInteger(item.taxPeriodMonth) ||
    item.taxPeriodMonth < 1 ||
    item.taxPeriodMonth > 12
  ) {
    throw new Error(`${prefix}:INVALID_TAX_PERIOD_MONTH`);
  }
  if (
    !Number.isInteger(item.taxPeriodYear) ||
    item.taxPeriodYear < 2000 ||
    item.taxPeriodYear > 2100
  ) {
    throw new Error(`${prefix}:INVALID_TAX_PERIOD_YEAR`);
  }
  if (!/^[0-9]{15,16}$/.test(item.counterpartTin)) {
    throw new Error(`${prefix}:INVALID_COUNTERPART_TIN`);
  }
  if (!/^[0-9]{22}$/.test(item.recipientTku)) {
    throw new Error(`${prefix}:INVALID_RECIPIENT_TKU`);
  }
  if (!bppuTaxCertificates.includes(item.taxCertificate)) {
    throw new Error(`${prefix}:INVALID_TAX_CERTIFICATE`);
  }
  if (!item.taxObjectCode.trim() || item.taxObjectCode.length > 32) {
    throw new Error(`${prefix}:INVALID_TAX_OBJECT_CODE`);
  }
  const taxBase = formatBppuDecimal(item.taxBase);
  if (Number(taxBase) <= 0 || taxBase === "0") {
    throw new Error(`${prefix}:NON_POSITIVE_TAX_BASE`);
  }
  const rate = formatBppuDecimal(item.rate);
  if (
    !bppuSchema3DocTypes.includes(
      item.document as (typeof bppuSchema3DocTypes)[number],
    )
  ) {
    throw new Error(`${prefix}:INVALID_DOCUMENT_TYPE`);
  }
  if (!item.documentNumber.trim() || item.documentNumber.length > 100) {
    throw new Error(`${prefix}:INVALID_DOCUMENT_NUMBER`);
  }
  if (!isValidIsoDate(item.documentDate)) {
    throw new Error(`${prefix}:INVALID_DOCUMENT_DATE`);
  }
  if (!/^[0-9]{22}$/.test(item.idPlaceOfBusinessActivity)) {
    throw new Error(`${prefix}:INVALID_COMPANY_TKU`);
  }
  if (!bppuGovTreasurerOpts.includes(item.govTreasurerOpt)) {
    throw new Error(`${prefix}:INVALID_GOV_TREASURER_OPT`);
  }
  if (item.govTreasurerOpt === "Direct" && !item.sp2dNumber?.trim()) {
    throw new Error(`${prefix}:SP2D_REQUIRED_FOR_DIRECT`);
  }
  if (item.govTreasurerOpt === "N/A" && item.sp2dNumber?.trim()) {
    throw new Error(`${prefix}:SP2D_MUST_BE_NULL_FOR_NA`);
  }
  if (!isValidIsoDate(item.withholdingDate)) {
    throw new Error(`${prefix}:INVALID_WITHHOLDING_DATE`);
  }
  // DJP BPPU sheet row E17: WithholdingDate must not predate TaxPeriodMonth/Year.
  const periodStart = `${item.taxPeriodYear}-${String(item.taxPeriodMonth).padStart(2, "0")}-01`;
  if (item.withholdingDate < periodStart) {
    throw new Error(`${prefix}:WITHHOLDING_DATE_BEFORE_PERIOD`);
  }
  return { taxBase, rate };
}

/**
 * Emits canonical UTF-8 XML matching DJP Coretax `BpuBulk` Schema3 byte order
 * and tag sequence derived from `BPPU Excel to XML v.3.xlsx` and `bppu.xml`.
 */
export function serializeBpuBulkXml(doc: BpuBulkDocument): string {
  if (!/^[0-9]{15,16}$/.test(doc.tin)) {
    throw new Error("INVALID_COMPANY_TIN");
  }
  if (doc.items.length === 0) {
    throw new Error("EMPTY_BPPU_LIST");
  }

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<BpuBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `\t<TIN>${escapeXmlText(doc.tin)}</TIN>`,
    "\t<ListOfBpu>",
  ];

  for (let i = 0; i < doc.items.length; i++) {
    const item = doc.items[i];
    const { taxBase, rate } = validateBpuItem(item, i);
    const sp2dTag =
      item.sp2dNumber && item.sp2dNumber.trim().length > 0
        ? `\t\t\t<SP2DNumber>${escapeXmlText(item.sp2dNumber.trim())}</SP2DNumber>`
        : '\t\t\t<SP2DNumber xsi:nil="true"/>';

    lines.push(
      "\t\t<Bpu>",
      `\t\t\t<TaxPeriodMonth>${item.taxPeriodMonth}</TaxPeriodMonth>`,
      `\t\t\t<TaxPeriodYear>${item.taxPeriodYear}</TaxPeriodYear>`,
      `\t\t\t<CounterpartTin>${escapeXmlText(item.counterpartTin)}</CounterpartTin>`,
      `\t\t\t<IDPlaceOfBusinessActivityOfIncomeRecipient>${escapeXmlText(item.recipientTku)}</IDPlaceOfBusinessActivityOfIncomeRecipient>`,
      `\t\t\t<TaxCertificate>${escapeXmlText(item.taxCertificate)}</TaxCertificate>`,
      `\t\t\t<TaxObjectCode>${escapeXmlText(item.taxObjectCode.trim())}</TaxObjectCode>`,
      `\t\t\t<TaxBase>${taxBase}</TaxBase>`,
      `\t\t\t<Rate>${rate}</Rate>`,
      `\t\t\t<Document>${escapeXmlText(item.document)}</Document>`,
      `\t\t\t<DocumentNumber>${escapeXmlText(item.documentNumber.trim())}</DocumentNumber>`,
      `\t\t\t<DocumentDate>${item.documentDate}</DocumentDate>`,
      `\t\t\t<IDPlaceOfBusinessActivity>${escapeXmlText(item.idPlaceOfBusinessActivity)}</IDPlaceOfBusinessActivity>`,
      `\t\t\t<GovTreasurerOpt>${escapeXmlText(item.govTreasurerOpt)}</GovTreasurerOpt>`,
      sp2dTag,
      `\t\t\t<WithholdingDate>${item.withholdingDate}</WithholdingDate>`,
      "\t\t</Bpu>",
    );
  }

  lines.push("\t</ListOfBpu>", "</BpuBulk>", "");
  return lines.join("\n");
}

function readNextElementBlock(
  xml: string,
  pos: number,
): { tag: string; attrs: string; body: string | null; nextPos: number } {
  let cursor = pos;
  while (cursor < xml.length && /\s/.test(xml[cursor])) cursor++;
  if (cursor >= xml.length || xml[cursor] !== "<") {
    throw new Error("MALFORMED_XML_EXPECTED_TAG");
  }
  const openEnd = xml.indexOf(">", cursor);
  if (openEnd === -1) throw new Error("MALFORMED_XML_UNCLOSED_TAG");
  const rawOpen = xml.slice(cursor + 1, openEnd).trim();
  if (
    !rawOpen ||
    rawOpen.startsWith("/") ||
    rawOpen.startsWith("!") ||
    rawOpen.startsWith("?")
  ) {
    throw new Error("MALFORMED_XML_UNEXPECTED_DIRECTIVE");
  }
  const selfClosing = rawOpen.endsWith("/");
  const cleanOpen = selfClosing ? rawOpen.slice(0, -1).trim() : rawOpen;
  const spaceIdx = cleanOpen.search(/\s/);
  const tag = spaceIdx === -1 ? cleanOpen : cleanOpen.slice(0, spaceIdx);
  const attrs = spaceIdx === -1 ? "" : cleanOpen.slice(spaceIdx + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(tag)) {
    throw new Error("MALFORMED_XML_TAG_NAME");
  }
  if (selfClosing) {
    return { tag, attrs, body: null, nextPos: openEnd + 1 };
  }

  const closeToken = `</${tag}>`;
  const closeIdx = xml.indexOf(closeToken, openEnd + 1);
  if (closeIdx === -1) throw new Error(`MALFORMED_XML_UNCLOSED_${tag}`);
  const body = xml.slice(openEnd + 1, closeIdx);
  return { tag, attrs, body, nextPos: closeIdx + closeToken.length };
}

/**
 * Self-contained XXE-proof validator against DJP BPPU Schema3 XSD constraints.
 * Rejects DOCTYPE/ENTITY declarations, unescaped `&` or `<` inside text nodes,
 * missing/reordered elements, and type/enum violations.
 */
export function validateBpuBulkXml(xml: string): BpuBulkDocument {
  if (hasIllegalXmlChar(xml)) {
    throw new Error("ILLEGAL_XML_CHARACTER");
  }
  const normalized = xml.replace(/\r\n/g, "\n").trim();
  if (
    /<!(DOCTYPE|ENTITY|ELEMENT|ATTLIST|NOTATION)\b/i.test(normalized) ||
    normalized.includes("<![CDATA[")
  ) {
    throw new Error("DISALLOWED_XML_CONSTRUCT");
  }

  let body = normalized;
  if (body.startsWith("<?xml")) {
    const endDecl = body.indexOf("?>");
    if (endDecl === -1) throw new Error("MALFORMED_XML_PROLOG");
    const decl = body.slice(0, endDecl + 2);
    if (
      !/^<\?xml\s+version="1\.0"\s+encoding="UTF-8"(?:\s+standalone="(?:yes|no)")?\s*\?>$/i.test(
        decl,
      )
    ) {
      throw new Error("INVALID_XML_PROLOG");
    }
    body = body.slice(endDecl + 2).trimStart();
  }
  if (body.includes("<?")) {
    throw new Error("DISALLOWED_XML_PI");
  }

  const rootMatch = /^<BpuBulk(?:\s+([^>]*))?>([\s\S]*)<\/BpuBulk>$/.exec(body);
  if (!rootMatch) throw new Error("INVALID_ROOT_BPUBULK");
  const rootAttrs = (rootMatch[1] ?? "").trim();
  if (
    rootAttrs &&
    rootAttrs !== 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'
  ) {
    throw new Error("UNEXPECTED_ROOT_ATTRIBUTES");
  }

  const rootInner = rootMatch[2];
  const tinEl = readNextElementBlock(rootInner, 0);
  if (tinEl.tag !== "TIN" || tinEl.body === null) {
    throw new Error("MISSING_OR_INVALID_TIN");
  }
  if (tinEl.body.includes("<")) throw new Error("NESTED_TAG_IN_TIN");
  const tin = unescapeXmlText(tinEl.body.trim());
  if (!/^[0-9]{15,16}$/.test(tin)) throw new Error("INVALID_COMPANY_TIN");

  const listEl = readNextElementBlock(rootInner, tinEl.nextPos);
  if (listEl.tag !== "ListOfBpu" || listEl.body === null) {
    throw new Error("MISSING_LIST_OF_BPU");
  }
  if (rootInner.slice(listEl.nextPos).trim().length > 0) {
    throw new Error("TRAILING_CONTENT_IN_ROOT");
  }

  const items: BpuItem[] = [];
  let listCursor = 0;
  const listInner = listEl.body;
  while (listCursor < listInner.length) {
    while (listCursor < listInner.length && /\s/.test(listInner[listCursor])) {
      listCursor++;
    }
    if (listCursor >= listInner.length) break;
    const bpuEl = readNextElementBlock(listInner, listCursor);
    if (bpuEl.tag !== "Bpu" || bpuEl.body === null) {
      throw new Error("UNEXPECTED_CHILD_IN_LIST_OF_BPU");
    }
    listCursor = bpuEl.nextPos;

    const bpuInner = bpuEl.body;
    let fieldCursor = 0;
    const fields: Record<string, string | null> = {};
    for (const expectedTag of bppuElementOrder) {
      const child = readNextElementBlock(bpuInner, fieldCursor);
      if (child.tag !== expectedTag) {
        throw new Error(
          `WRONG_ELEMENT_ORDER_EXPECTED_${expectedTag}_GOT_${child.tag}`,
        );
      }
      fieldCursor = child.nextPos;
      if (child.body === null) {
        if (!/xsi:nil="true"/.test(child.attrs)) {
          throw new Error(`EMPTY_SELF_CLOSING_${expectedTag}`);
        }
        fields[expectedTag] = null;
      } else {
        if (child.body.includes("<")) {
          throw new Error(`NESTED_TAG_IN_${expectedTag}`);
        }
        if (
          /&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/.test(child.body)
        ) {
          throw new Error(`UNESCAPED_AMPERSAND_IN_${expectedTag}`);
        }
        fields[expectedTag] = unescapeXmlText(child.body);
      }
    }
    if (bpuInner.slice(fieldCursor).trim().length > 0) {
      throw new Error("EXTRA_ELEMENTS_IN_BPU");
    }

    const parsed: BpuItem = {
      taxPeriodMonth: Number(fields.TaxPeriodMonth),
      taxPeriodYear: Number(fields.TaxPeriodYear),
      counterpartTin: fields.CounterpartTin ?? "",
      recipientTku: fields.IDPlaceOfBusinessActivityOfIncomeRecipient ?? "",
      taxCertificate: (fields.TaxCertificate ?? "") as BppuTaxCertificate,
      taxObjectCode: fields.TaxObjectCode ?? "",
      taxBase: fields.TaxBase ?? "",
      rate: fields.Rate ?? "",
      document: (fields.Document ?? "") as (typeof bppuSchema3DocTypes)[number],
      documentNumber: fields.DocumentNumber ?? "",
      documentDate: fields.DocumentDate ?? "",
      idPlaceOfBusinessActivity: fields.IDPlaceOfBusinessActivity ?? "",
      govTreasurerOpt: (fields.GovTreasurerOpt ?? "") as BppuGovTreasurerOpt,
      sp2dNumber: fields.SP2DNumber,
      withholdingDate: fields.WithholdingDate ?? "",
    };
    validateBpuItem(parsed, items.length);
    items.push(parsed);
  }

  if (items.length === 0) {
    throw new Error("EMPTY_BPPU_LIST");
  }
  return { tin, items };
}
