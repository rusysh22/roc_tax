import { createHash } from "node:crypto";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_TRANSACTION = 20;

const types = {
  "application/pdf": {
    extensions: ["pdf"],
    magic: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  },
  "image/png": {
    extensions: ["png"],
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  "image/jpeg": {
    extensions: ["jpg", "jpeg"],
    magic: [0xff, 0xd8, 0xff],
  },
} as const;
export type DocumentMime = keyof typeof types;
export const documentMimeTypes = Object.keys(types) as DocumentMime[];

export class DocumentError extends Error {
  constructor(
    public code:
      | "DOCUMENT_EMPTY"
      | "DOCUMENT_TOO_LARGE"
      | "DOCUMENT_TYPE"
      | "DOCUMENT_EXTENSION"
      | "DOCUMENT_CONTENT"
      | "DOCUMENT_NAME",
  ) {
    super(code);
  }
}

/** Keeps a display name only: strips paths, control and markup characters. */
export function sanitizeFileName(raw: string) {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = Array.from(base.normalize("NFKC"))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code <= 0x1f || code === 0x7f || '<>:"|?*;'.includes(ch)
        ? "_"
        : ch;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") return null;
  if (cleaned.length <= 120) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, 120 - extension.length) + extension;
}

/**
 * Validates declared MIME, file extension and magic bytes, all of which must agree.
 * Files are stored opaque and never parsed or rendered server-side in this batch.
 * Malware scanning is not configured; documents carry scanStatus NOT_SCANNED.
 */
export function inspectDocument(input: {
  bytes: Uint8Array;
  declaredType: string;
  fileName: string;
}) {
  if (input.bytes.length === 0) throw new DocumentError("DOCUMENT_EMPTY");
  if (input.bytes.length > MAX_DOCUMENT_BYTES)
    throw new DocumentError("DOCUMENT_TOO_LARGE");
  const declared = input.declaredType.split(";")[0].trim().toLowerCase();
  if (!(declared in types)) throw new DocumentError("DOCUMENT_TYPE");
  const spec = types[declared as DocumentMime];
  const name = sanitizeFileName(input.fileName);
  if (!name) throw new DocumentError("DOCUMENT_NAME");
  const extension = name.includes(".")
    ? name.split(".").pop()!.toLowerCase()
    : "";
  if (!(spec.extensions as readonly string[]).includes(extension))
    throw new DocumentError("DOCUMENT_EXTENSION");
  if (
    input.bytes.length < spec.magic.length ||
    spec.magic.some((byte, index) => input.bytes[index] !== byte)
  )
    throw new DocumentError("DOCUMENT_CONTENT");
  return {
    mimeType: declared as DocumentMime,
    name,
    sizeBytes: input.bytes.length,
    sha256: createHash("sha256").update(input.bytes).digest("hex"),
  };
}
