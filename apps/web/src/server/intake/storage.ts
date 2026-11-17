import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type DocumentStorage = {
  put(organizationId: string, bytes: Uint8Array): Promise<string>;
  get(organizationId: string, key: string): Promise<Uint8Array>;
  remove(organizationId: string, key: string): Promise<void>;
};

const segmentPattern = /^[a-zA-Z0-9_-]{1,80}$/;

function resolveKey(root: string, organizationId: string, key: string) {
  const parts = key.split("/");
  if (
    parts.length !== 2 ||
    parts[0] !== organizationId ||
    !segmentPattern.test(parts[0]) ||
    !segmentPattern.test(parts[1])
  )
    throw new Error("INVALID_STORAGE_KEY");
  const resolved = path.resolve(root, parts[0], parts[1]);
  const base = path.resolve(root) + path.sep;
  if (!resolved.startsWith(base)) throw new Error("INVALID_STORAGE_KEY");
  return resolved;
}

/**
 * Private local filesystem adapter. Files are stored under opaque random keys
 * outside the public web root and are never served directly by Next static routes.
 */
export function localDocumentStorage(
  root = process.env.DOCUMENT_STORAGE_DIR ||
    path.resolve(process.cwd(), ".local-storage"),
): DocumentStorage {
  return {
    async put(organizationId, bytes) {
      if (!segmentPattern.test(organizationId))
        throw new Error("INVALID_STORAGE_KEY");
      const key = `${organizationId}/${randomUUID()}`;
      const target = resolveKey(root, organizationId, key);
      const directory = path.dirname(target);
      await mkdir(directory, { recursive: true });
      const temp = `${target}.${randomUUID()}.tmp`;
      await writeFile(temp, bytes, { mode: 0o600 });
      await rename(temp, target);
      return key;
    },
    async get(organizationId, key) {
      const target = resolveKey(root, organizationId, key);
      return new Uint8Array(await readFile(/*turbopackIgnore: true*/ target));
    },
    async remove(organizationId, key) {
      const target = resolveKey(root, organizationId, key);
      await rm(target, { force: true });
    },
  };
}
