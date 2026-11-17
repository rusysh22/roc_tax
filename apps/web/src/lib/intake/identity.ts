// Structural (format-only) checks for Indonesian tax identifiers.
// These do NOT verify registration with DJP; no registry lookup is performed or implied.
// Lengths follow the publicly documented Coretax-era formats and remain subject to
// verification against the official XML templates (see 13_DECISIONS_AND_OPEN_ITEMS.md).
export const identityTypes = ["NPWP", "NIK", "FOREIGN_TIN", "NONE"] as const;
export type IdentityType = (typeof identityTypes)[number];

const separators = /[\s.-]/g;
export function normalizeIdentity(type: IdentityType, raw: string): string {
  if (type === "FOREIGN_TIN") return raw.replace(/\s/g, "").toUpperCase();
  return raw.replace(separators, "");
}

/** Returns the normalized identifier, or null when structurally invalid. */
export function validateIdentity(
  type: IdentityType,
  raw: string,
): string | null {
  const value = normalizeIdentity(type, raw);
  switch (type) {
    case "NPWP":
      // 16-digit NPWP; legacy 15-digit values are accepted for historical records.
      return /^(\d{15}|\d{16})$/.test(value) ? value : null;
    case "NIK":
      return /^\d{16}$/.test(value) ? value : null;
    case "FOREIGN_TIN":
      return /^[A-Z0-9/-]{1,40}$/.test(value) ? value : null;
    case "NONE":
      return null;
  }
}

/** NITKU: 22 digits (16-digit NPWP plus a 6-digit business-place suffix). */
export function validateNitku(raw: string): string | null {
  const value = raw.replace(separators, "");
  return /^\d{22}$/.test(value) ? value : null;
}

export function identityHint(value: string) {
  return value.slice(-4);
}

export function normalizeName(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeInvoiceNumber(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").toUpperCase();
}
