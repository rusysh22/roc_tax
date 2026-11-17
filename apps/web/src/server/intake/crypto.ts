import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
import { identityHint } from "../../lib/intake/identity";

/**
 * Authenticated encryption and tenant-scoped blind indexing for tax identifiers
 * (NPWP, NIK, NITKU, foreign TIN). Raw identifiers are never stored in plain
 * columns; the database only holds AES-256-GCM ciphertext, an HMAC-SHA256 index
 * for duplicate detection within a workspace, and the trailing 4-character hint.
 */
const keySchema = z.string().min(32);

export type TaxCrypto = {
  protect(
    organizationId: string,
    kind: string,
    normalized: string,
  ): { cipher: string; index: string; hint: string };
  reveal(organizationId: string, kind: string, cipher: string): string;
  index(organizationId: string, kind: string, normalized: string): string;
};

export function createTaxCrypto(secret: string): TaxCrypto {
  const material = keySchema.parse(secret);
  const encKey = Buffer.from(
    hkdfSync("sha256", material, "serentax-tax-id-v1", "aes-256-gcm", 32),
  );
  const macKey = Buffer.from(
    hkdfSync("sha256", material, "serentax-tax-id-v1", "blind-index", 32),
  );
  const aad = (organizationId: string, kind: string) =>
    Buffer.from(`v1:${organizationId}:${kind}`, "utf-8");

  function index(organizationId: string, kind: string, normalized: string) {
    return createHmac("sha256", macKey)
      .update(`${organizationId}:${kind}:${normalized}`)
      .digest("hex");
  }
  function protect(organizationId: string, kind: string, normalized: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encKey, iv);
    cipher.setAAD(aad(organizationId, kind));
    const encrypted = Buffer.concat([
      cipher.update(normalized, "utf-8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      cipher: `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`,
      index: index(organizationId, kind, normalized),
      hint: identityHint(normalized),
    };
  }
  function reveal(organizationId: string, kind: string, packed: string) {
    const parts = packed.split(".");
    if (parts.length !== 4 || parts[0] !== "v1")
      throw new Error("INVALID_CIPHERTEXT");
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const data = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16)
      throw new Error("INVALID_CIPHERTEXT");
    const decipher = createDecipheriv("aes-256-gcm", encKey, iv);
    decipher.setAAD(aad(organizationId, kind));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf-8",
    );
  }
  return { protect, reveal, index };
}

export function getTaxCrypto(env: NodeJS.ProcessEnv = process.env): TaxCrypto {
  const secret = env.TAX_DATA_KEY || env.BETTER_AUTH_SECRET || "";
  if (secret.length < 32) throw new Error("CRYPTO_NOT_CONFIGURED");
  return createTaxCrypto(secret);
}
