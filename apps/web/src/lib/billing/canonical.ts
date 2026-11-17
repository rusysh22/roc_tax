/**
 * Implements Berlanggan's official Canonical JSON specification:
 * equivalent to Python `json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`.
 * Keys are sorted lexicographically by Unicode code point, no extra whitespace is
 * inserted, and non-ASCII UTF-8 characters remain unescaped.
 */
function compareCodePoints(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.codePointAt(i) ?? 0;
    const cb = b.codePointAt(i) ?? 0;
    if (ca !== cb) return ca - cb;
  }
  return a.length - b.length;
}

export function canonicalizeJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("CANONICAL_JSON_NON_FINITE_NUMBER");
    }
    return Object.is(value, -0) ? "0" : String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => {
      if (
        item === undefined ||
        typeof item === "function" ||
        typeof item === "symbol"
      ) {
        throw new Error("CANONICAL_JSON_UNSUPPORTED_ARRAY_ITEM");
      }
      return canonicalizeJson(item);
    });
    return `[${items.join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((key) => obj[key] !== undefined)
      .sort(compareCodePoints);
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`,
    );
    return `{${entries.join(",")}}`;
  }
  throw new Error("CANONICAL_JSON_UNSUPPORTED_TYPE");
}
