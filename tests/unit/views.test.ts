import { describe, expect, it } from "vitest";
import {
  addTextFacet,
  applySearch,
  decodeSearch,
  emptySearch,
  encodeSearch,
  groupRecords,
  setDateRange,
  toggleEnumValue,
  togglePreset,
  type Preset,
  type ViewField,
} from "../../apps/web/src/components/views/search";
import { toCsv } from "../../apps/web/src/components/views/csv";
import { localeHref } from "../../apps/web/src/lib/locale-href";

type Row = {
  name: string;
  kind: string;
  date: string;
  amount: number;
  archived: boolean;
};
const rows: Row[] = [
  {
    name: "PT Alpha Jaya",
    kind: "VENDOR",
    date: "2026-11-01",
    amount: 300,
    archived: false,
  },
  {
    name: "CV Beta",
    kind: "CUSTOMER",
    date: "2026-11-15",
    amount: 100,
    archived: false,
  },
  {
    name: "PT Gamma Ölah",
    kind: "VENDOR",
    date: "2026-10-20",
    amount: 200,
    archived: true,
  },
];
const fields: ViewField<Row>[] = [
  {
    name: "name",
    label: "Name",
    type: "text",
    value: (r) => r.name,
    searchable: true,
  },
  {
    name: "kind",
    label: "Kind",
    type: "enum",
    value: (r) => r.kind,
    filterable: true,
    groupable: true,
  },
  {
    name: "date",
    label: "Date",
    type: "date",
    value: (r) => r.date,
    filterable: true,
  },
  {
    name: "amount",
    label: "Amount",
    type: "number",
    value: (r) => r.amount,
    sortable: true,
  },
];
const presets: Preset<Row>[] = [
  {
    id: "archived",
    label: "Archived",
    group: "archive",
    predicate: (r) => r.archived,
  },
];
const baseline = (r: Row, s: typeof emptySearch) =>
  s.facets.some((f) => f.kind === "preset" && f.group === "archive") ||
  !r.archived;

describe("standard list search model", () => {
  it("hides archived records by default and shows only them with the Archived filter", () => {
    expect(
      applySearch(rows, emptySearch, fields, presets, baseline),
    ).toHaveLength(2);
    const archived = togglePreset(emptySearch, presets[0]);
    expect(
      applySearch(rows, archived, fields, presets, baseline).map((r) => r.name),
    ).toEqual(["PT Gamma Ölah"]);
  });

  it("ORs values within a facet and ANDs across facets, accent-insensitively", () => {
    let s = addTextFacet(emptySearch, "name", "alpha");
    s = addTextFacet(s, "name", "beta");
    expect(applySearch(rows, s, fields, presets, baseline)).toHaveLength(2);
    s = toggleEnumValue(s, "kind", "VENDOR");
    expect(
      applySearch(rows, s, fields, presets, baseline).map((r) => r.name),
    ).toEqual(["PT Alpha Jaya"]);
    const accent = togglePreset(
      addTextFacet(emptySearch, "name", "olah"),
      presets[0],
    );
    expect(applySearch(rows, accent, fields, presets, baseline)).toHaveLength(
      1,
    );
  });

  it("filters date ranges, sorts numbers and groups records", () => {
    const ranged = setDateRange(emptySearch, "date", "2026-11-10", undefined);
    expect(applySearch(rows, ranged, fields).map((r) => r.name)).toEqual([
      "CV Beta",
    ]);
    const sorted = applySearch(
      rows,
      { ...emptySearch, sort: { field: "amount", dir: "desc" } },
      fields,
    );
    expect(sorted.map((r) => r.amount)).toEqual([300, 200, 100]);
    const groups = groupRecords(rows, fields[1], "—");
    expect(groups?.map((g) => [g.key, g.rows.length])).toEqual([
      ["VENDOR", 2],
      ["CUSTOMER", 1],
    ]);
  });

  it("supports single-value filters for server-side single filters", () => {
    let s = toggleEnumValue(emptySearch, "kind", "VENDOR", true);
    s = toggleEnumValue(s, "kind", "CUSTOMER", true);
    expect(s.facets).toEqual([
      { kind: "enum", field: "kind", values: ["CUSTOMER"] },
    ]);
  });

  it("round-trips search state through the URL and rejects garbage", () => {
    const state = {
      ...togglePreset(
        addTextFacet(emptySearch, "name", "Ölah & co"),
        presets[0],
      ),
      groupBy: "kind",
      page: 2,
    };
    expect(decodeSearch(encodeSearch(state))).toEqual(state);
    expect(encodeSearch(emptySearch)).toBe("");
    expect(decodeSearch("not-base64!!")).toBeNull();
    expect(
      decodeSearch(
        btoa(JSON.stringify({ facets: [{ kind: "evil" }], page: -3 })),
      ),
    ).toEqual({
      ...emptySearch,
      facets: [],
    });
  });
});

describe("list CSV export and locale switch", () => {
  it("neutralises spreadsheet formulas and quotes separators", () => {
    const csv = toCsv(
      ["a", "b"],
      [
        ["=SUM(A1)", 'x,"y"'],
        ["+1", "@cmd"],
        ["-2", "ok"],
      ],
    );
    expect(csv).toBe(`a,b\r\n'=SUM(A1),"x,""y"""\r\n'+1,'@cmd\r\n'-2,ok`);
  });

  it("swaps only the leading locale segment", () => {
    expect(localeHref("/id/app/transactions", "en")).toBe(
      "/en/app/transactions",
    );
    expect(localeHref("/en", "id")).toBe("/id");
    expect(localeHref("/id/app/identities", "en")).toBe("/en/app/identities");
  });
});
