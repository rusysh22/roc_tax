/**
 * Enforces core_docs/14_UI_STANDARDS.md. If this test fails, fix the screen,
 * dictionary or registry — do not weaken the test. Documented exceptions use
 * the trailing comment `// ui-standards-allow: <reason>`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeRegistry, type CodeDomain } from "../../apps/web/src/i18n/codes";
import { fieldDictionary } from "../../apps/web/src/i18n/fields";
import { transactionStatuses } from "../../apps/web/src/lib/intake/state";
import { transactionSources } from "../../apps/web/src/lib/intake/schemas";
import {
  allTaxFamilies,
  segregationPolicies,
  taxRuleStatuses,
} from "../../apps/web/src/lib/intake/tax-rules";
import {
  ocrAdapterKeys,
  ocrJobStatuses,
} from "../../apps/web/src/lib/intake/ocr";
import {
  billingAdapterModes,
  licenseStatuses,
  paidEntitlementKeys,
} from "../../apps/web/src/lib/billing/schemas";
import { xmlTemplateStatuses } from "../../apps/web/src/lib/export/bppu-spec";
import {
  permissionList,
  rolePermissions,
  roles,
} from "../../apps/web/src/server/workspaces/policy";

const root = join(__dirname, "../../apps/web/src");
const RAW_CODE =
  /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b|\/v1\/|\b(?:NONE|OWNER|ADMIN|PREPARER|REVIEWER|APPROVER|DRAFT|SUBMITTED|APPROVED|EXPORTED|VOIDED|VERIFIED|UNVERIFIED|RETIRED|ACTIVE|REVOKED|EXPIRED|PENDING)\b/;
const TONES = new Set(["gray", "blue", "green", "amber", "red", "violet"]);

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, ext);
    return ext.test(name) ? [path] : [];
  });
}

/** User-visible string values (not object keys, imports or case labels). */
function stringValues(source: string) {
  const out: { line: number; text: string }[] = [];
  const re = /"((?:[^"\\\n]|\\.)*)"(\s*:)?/g;
  source.split(/\r?\n/).forEach((line, index) => {
    if (/^\s*(import|case |\/\/|\*)/.test(line)) return;
    if (line.includes("ui-standards-allow:")) return;
    for (const match of line.matchAll(re)) {
      if (!match[2]) out.push({ line: index + 1, text: match[1] });
    }
  });
  return out;
}

describe("UI standards — no technical names in user-facing text", () => {
  it("i18n dictionaries contain no raw enum/error codes or API paths", () => {
    const offenders: string[] = [];
    for (const file of files(join(root, "i18n"), /\.ts$/)) {
      for (const { line, text } of stringValues(readFileSync(file, "utf8"))) {
        if (RAW_CODE.test(text))
          offenders.push(
            `${file.split(/[\\/]/).pop()}:${line} ${text.slice(0, 80)}`,
          );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("components never print a raw code as JSX text", () => {
    const offenders: string[] = [];
    for (const file of files(join(root, "components"), /\.tsx$/)) {
      readFileSync(file, "utf8")
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (line.includes("ui-standards-allow:")) return;
          if (/>\s*[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\s*</.test(line))
            offenders.push(`${file.split(/[\\/]/).pop()}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

describe("UI standards — code registry", () => {
  const coverage: [CodeDomain, readonly string[]][] = [
    ["transactionStatus", transactionStatuses],
    ["source", transactionSources],
    ["taxFamily", allTaxFamilies],
    ["taxRuleStatus", taxRuleStatuses],
    ["segregationPolicy", segregationPolicies],
    ["xmlTemplateStatus", xmlTemplateStatuses],
    ["ocrAdapter", ocrAdapterKeys],
    ["ocrJobStatus", ocrJobStatuses],
    ["billingMode", billingAdapterModes],
    ["licenseStatus", licenseStatuses],
    ["role", roles],
    ["permission", permissionList],
    ["entitlement", paidEntitlementKeys],
  ];

  it.each(coverage)("%s covers every enum value", (domain, values) => {
    const table = codeRegistry[domain] as Record<string, unknown>;
    expect(values.filter((value) => !(value in table))).toEqual([]);
  });

  it("every entry has a semantic tone and bilingual label + help without raw codes", () => {
    const problems: string[] = [];
    for (const [domain, table] of Object.entries(codeRegistry)) {
      for (const [code, entry] of Object.entries(
        table as Record<string, { tone: string; id: string[]; en: string[] }>,
      )) {
        if (!TONES.has(entry.tone)) problems.push(`${domain}.${code}: tone`);
        for (const locale of ["id", "en"] as const) {
          const [label, help] = entry[locale];
          if (!label?.trim() || !help?.trim())
            problems.push(`${domain}.${code}: ${locale} label/help`);
          if (RAW_CODE.test(label) || RAW_CODE.test(help))
            problems.push(`${domain}.${code}: ${locale} contains a raw code`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("the role matrix only uses registered permissions", () => {
    for (const role of roles)
      for (const permission of rolePermissions[role])
        expect(codeRegistry.permission).toHaveProperty([permission]);
  });
});

describe("UI standards — fields", () => {
  it("every dictionary field has a bilingual label and functional help", () => {
    const problems: string[] = [];
    for (const [key, entry] of Object.entries(
      fieldDictionary as Record<string, { id: string[]; en: string[] }>,
    )) {
      if (!/^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/.test(key))
        problems.push(`${key}: key format`);
      for (const locale of ["id", "en"] as const) {
        const [label, help] = entry[locale];
        if (!label?.trim() || !help?.trim()) problems.push(`${key}: ${locale}`);
        if (RAW_CODE.test(label) || RAW_CODE.test(help))
          problems.push(`${key}: ${locale} contains a raw code`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("components use the standard field, dropdown and colour primitives", () => {
    const problems: string[] = [];
    for (const file of files(join(root, "components"), /\.tsx$/)) {
      if (/[\\/]ui[\\/]/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      const name = file.split(/[\\/]/).pop();
      if (/<select\b/.test(source))
        problems.push(`${name}: raw <select> (use Combobox)`);
      for (const match of source.matchAll(/<FormField\b[^>]*>/g))
        if (!/\bfield=/.test(match[0]))
          problems.push(`${name}: FormField without field`);
      if (/tone="(solid|muted|neutral|outline|strong)"/.test(source))
        problems.push(`${name}: legacy monochrome tone`);
    }
    expect(problems).toEqual([]);
  });
});

describe("UI standards — lists", () => {
  it("the standard page size is 50 rows and lists use it", () => {
    const listView = readFileSync(
      join(root, "components/views/list-view.tsx"),
      "utf8",
    );
    expect(listView).toMatch(/export const LIST_PAGE_SIZE = 50;/);
    const listPage = readFileSync(
      join(root, "components/views/list-page.tsx"),
      "utf8",
    );
    expect(listPage).toMatch(/pageSize = LIST_PAGE_SIZE/);
    const offenders = files(join(root, "components"), /\.tsx$/).filter((file) =>
      /const PAGE_SIZE = \d+/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
