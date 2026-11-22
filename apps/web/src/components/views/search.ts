// Generic, declarative search model shared by every list view (Odoo-style
// facets). A view declares its fields once; text search, dynamic filters,
// group-by, sorting, paging, CSV export and URL persistence all derive from it.

export type FieldType = "text" | "enum" | "date" | "number" | "boolean";

export type ViewField<R> = {
  name: string;
  label: string;
  type: FieldType;
  /** Raw value used for filtering, sorting, grouping and export. */
  value: (record: R) => string | number | boolean | null | undefined;
  /** Human label for export / grouping (defaults to the raw value). */
  display?: (record: R) => string;
  /** Enum choices; when omitted they are derived from the data. */
  options?: { value: string; label: string }[];
  /** Offered as "Search <field> for: …" in the search box. */
  searchable?: boolean;
  /** Listed in the Filters panel (enum values / date range). */
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  /** Only one value may be filtered at a time (server-side single filters). */
  single?: boolean;
};

export type Preset<R> = {
  id: string;
  label: string;
  /** Presets in the same group are OR-ed; different groups are AND-ed. */
  group?: string;
  predicate?: (record: R) => boolean;
};

export type Facet =
  | { kind: "text"; field: string; values: string[] }
  | { kind: "enum"; field: string; values: string[] }
  | { kind: "date"; field: string; from?: string; to?: string }
  | { kind: "preset"; ids: string[]; group: string };

export type SortState = { field: string; dir: "asc" | "desc" } | null;

export type SearchState = {
  facets: Facet[];
  groupBy: string | null;
  sort: SortState;
  page: number;
};

export const emptySearch: SearchState = {
  facets: [],
  groupBy: null,
  sort: null,
  page: 1,
};

function norm(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// ---------------------------------------------------------------- facets ---

export function addTextFacet(
  state: SearchState,
  field: string,
  value: string,
): SearchState {
  const trimmed = value.trim();
  if (!trimmed) return state;
  const existing = state.facets.find(
    (f) => f.kind === "text" && f.field === field,
  ) as Extract<Facet, { kind: "text" }> | undefined;
  const facets = existing
    ? state.facets.map((f) =>
        f === existing && !existing.values.includes(trimmed)
          ? { ...existing, values: [...existing.values, trimmed] }
          : f,
      )
    : [...state.facets, { kind: "text" as const, field, values: [trimmed] }];
  return { ...state, facets, page: 1 };
}

export function toggleEnumValue(
  state: SearchState,
  field: string,
  value: string,
  single = false,
): SearchState {
  const existing = state.facets.find(
    (f) => f.kind === "enum" && f.field === field,
  ) as Extract<Facet, { kind: "enum" }> | undefined;
  let facets: Facet[];
  if (!existing)
    facets = [...state.facets, { kind: "enum", field, values: [value] }];
  else {
    const values = existing.values.includes(value)
      ? existing.values.filter((v) => v !== value)
      : single
        ? [value]
        : [...existing.values, value];
    facets = values.length
      ? state.facets.map((f) => (f === existing ? { ...existing, values } : f))
      : state.facets.filter((f) => f !== existing);
  }
  return { ...state, facets, page: 1 };
}

export function setDateRange(
  state: SearchState,
  field: string,
  from?: string,
  to?: string,
): SearchState {
  const rest = state.facets.filter(
    (f) => !(f.kind === "date" && f.field === field),
  );
  const facets: Facet[] =
    from || to ? [...rest, { kind: "date", field, from, to }] : rest;
  return { ...state, facets, page: 1 };
}

export function togglePreset<R>(
  state: SearchState,
  preset: Preset<R>,
): SearchState {
  const group = preset.group ?? preset.id;
  const existing = state.facets.find(
    (f) => f.kind === "preset" && f.group === group,
  ) as Extract<Facet, { kind: "preset" }> | undefined;
  let facets: Facet[];
  if (!existing)
    facets = [...state.facets, { kind: "preset", group, ids: [preset.id] }];
  else {
    const ids = existing.ids.includes(preset.id)
      ? existing.ids.filter((id) => id !== preset.id)
      : [...existing.ids, preset.id];
    facets = ids.length
      ? state.facets.map((f) => (f === existing ? { ...existing, ids } : f))
      : state.facets.filter((f) => f !== existing);
  }
  return { ...state, facets, page: 1 };
}

export function presetActive(state: SearchState, id: string) {
  return state.facets.some((f) => f.kind === "preset" && f.ids.includes(id));
}

export function enumSelected(state: SearchState, field: string): string[] {
  const facet = state.facets.find(
    (f) => f.kind === "enum" && f.field === field,
  ) as Extract<Facet, { kind: "enum" }> | undefined;
  return facet?.values ?? [];
}

export function dateRange(state: SearchState, field: string) {
  const facet = state.facets.find(
    (f) => f.kind === "date" && f.field === field,
  ) as Extract<Facet, { kind: "date" }> | undefined;
  return { from: facet?.from, to: facet?.to };
}

// --------------------------------------------------------- client apply ---

export function enumOptions<R>(field: ViewField<R>, records: R[]) {
  if (field.options) return field.options;
  const seen = new Map<string, string>();
  for (const record of records) {
    const raw = field.value(record);
    if (raw === null || raw === undefined || raw === "") continue;
    const key = String(raw);
    if (!seen.has(key)) seen.set(key, field.display?.(record) ?? key);
  }
  return [...seen]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function applySearch<R>(
  records: R[],
  state: SearchState,
  fields: ViewField<R>[],
  presets: Preset<R>[] = [],
  baseline?: (record: R, state: SearchState) => boolean,
): R[] {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const presetById = new Map(presets.map((p) => [p.id, p]));
  const filtered = records.filter((record) => {
    if (baseline && !baseline(record, state)) return false;
    return state.facets.every((facet) => {
      if (facet.kind === "preset")
        return facet.ids.some(
          (id) => presetById.get(id)?.predicate?.(record) ?? true,
        );
      const field = byName.get(facet.field);
      if (!field) return true;
      const raw = field.value(record);
      if (facet.kind === "text") {
        const hay = norm(field.display?.(record) ?? raw);
        return facet.values.some((v) => hay.includes(norm(v)));
      }
      if (facet.kind === "enum") return facet.values.includes(String(raw));
      const date = String(raw ?? "").slice(0, 10);
      if (!date) return false;
      if (facet.from && date < facet.from) return false;
      if (facet.to && date > facet.to) return false;
      return true;
    });
  });
  if (!state.sort) return filtered;
  const field = byName.get(state.sort.field);
  if (!field) return filtered;
  const dir = state.sort.dir === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const va = field.value(a);
    const vb = field.value(b);
    if (va === vb) return 0;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "number" && typeof vb === "number")
      return (va - vb) * dir;
    return (
      String(va).localeCompare(String(vb), undefined, {
        numeric: true,
      }) * dir
    );
  });
}

export function groupRecords<R>(
  records: R[],
  field: ViewField<R> | undefined,
  emptyLabel: string,
) {
  if (!field) return null;
  const groups = new Map<string, { key: string; label: string; rows: R[] }>();
  for (const record of records) {
    const raw = field.value(record);
    const key =
      raw === null || raw === undefined || raw === "" ? "" : String(raw);
    const label = key
      ? (field.options?.find((o) => o.value === key)?.label ??
        field.display?.(record) ??
        key)
      : emptyLabel;
    const group = groups.get(key) ?? { key, label, rows: [] };
    group.rows.push(record);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// ---------------------------------------------------- URL persistence ---

export function encodeSearch(state: SearchState): string {
  if (!state.facets.length && !state.groupBy && !state.sort && state.page === 1)
    return "";
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeSearch(value: string | null): SearchState | null {
  if (!value) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const json = new TextDecoder().decode(
      Uint8Array.from(binary, (char) => char.charCodeAt(0)),
    );
    const parsed = JSON.parse(json) as Partial<SearchState>;
    if (!Array.isArray(parsed.facets)) return null;
    return {
      facets: parsed.facets.filter(
        (f): f is Facet =>
          typeof f === "object" &&
          f !== null &&
          ["text", "enum", "date", "preset"].includes((f as Facet).kind),
      ),
      groupBy: typeof parsed.groupBy === "string" ? parsed.groupBy : null,
      sort:
        parsed.sort &&
        typeof parsed.sort.field === "string" &&
        (parsed.sort.dir === "asc" || parsed.sort.dir === "desc")
          ? parsed.sort
          : null,
      page:
        typeof parsed.page === "number" && parsed.page > 0
          ? Math.floor(parsed.page)
          : 1,
    };
  } catch {
    return null;
  }
}
