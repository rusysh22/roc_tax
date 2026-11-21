import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";
import { canonicalizeJson } from "../../lib/billing/canonical";

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function parseEd25519PublicKey(rawKey: string): KeyObject | null {
  const trimmed = rawKey.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.includes("BEGIN PUBLIC KEY")) {
      return createPublicKey(trimmed);
    }
    const rawBytes = /^[0-9a-fA-F]{64}$/.test(trimmed)
      ? Buffer.from(trimmed, "hex")
      : Buffer.from(trimmed, "base64");
    if (rawBytes.length !== 32) return null;
    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, rawBytes]),
      format: "der",
      type: "spki",
    });
  } catch {
    return null;
  }
}

function decodeSignatureBytes(signature: string): Buffer | null {
  const trimmed = signature.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{128}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  const normalized = trimmed.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const decoded = Buffer.from(normalized, "base64");
    return decoded.length === 64 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Verifies Berlanggan Ed25519 `entitlement_signature` over the official
 * Canonical JSON serialization of `entitlement`. Fails closed on any mismatch.
 */
export function verifyBerlangganEd25519(
  entitlementEnvelope: unknown,
  signature: string | null | undefined,
  publicKeyMaterial: string | null | undefined,
): boolean {
  if (!signature || !publicKeyMaterial || !entitlementEnvelope) return false;
  const keyObj = parseEd25519PublicKey(publicKeyMaterial);
  const sigBytes = decodeSignatureBytes(signature);
  if (!keyObj || !sigBytes) return false;

  try {
    const canonical = canonicalizeJson(entitlementEnvelope);
    return verify(null, Buffer.from(canonical, "utf8"), keyObj, sigBytes);
  } catch {
    return false;
  }
}

/**
 * Verifies Berlanggan `X-Berlanggan-Signature` HMAC-SHA256 digest over raw bytes.
 * Supports `<hex>` or `sha256=<hex>` using constant-time comparison.
 */
export function verifyBerlangganWebhookHmac(
  rawBody: Uint8Array | Buffer | string,
  signatureHeader: string | null | undefined,
  webhookSecret: string | null | undefined,
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const cleaned = signatureHeader.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) return false;

  const actual = Buffer.from(cleaned, "hex");
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(expected, actual);
}

export function sha256Hex(value: Uint8Array | Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Test-only helper for deterministic Ed25519 signing in local/unit tests. */
export function createTestEd25519KeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    privateKeyPem: privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString(),
  };
}

const ED25519_PKCS8_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

/**
 * Stable Ed25519 pair for the non-production `SYNTHETIC_TEST` billing double.
 * The seed is an HMAC of a server secret under a fixed domain label, so every
 * process, route bundle and restart signs with the same key (a random
 * per-process key made licenses fail verification after a restart). This key
 * never authorizes BERLANGGAN_LIVE access, which requires the vendor's key.
 */
export function syntheticEd25519KeyPair(serverSecret: string) {
  if (serverSecret.length < 32)
    throw new Error("SYNTHETIC_KEY_SECRET_TOO_SHORT");
  const seed = createHmac("sha256", serverSecret)
    .update("serentax:synthetic-billing:ed25519:v1")
    .digest();
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  return {
    publicKeyPem: createPublicKey(privateKey)
      .export({ format: "pem", type: "spki" })
      .toString(),
    privateKeyPem: privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString(),
  };
}

export function signCanonicalEntitlement(
  entitlementEnvelope: unknown,
  privateKeyPem: string,
): string {
  const canonical = canonicalizeJson(entitlementEnvelope);
  const key = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(canonical, "utf8"), key).toString("base64");
}

export function signWebhookHmac(
  rawBody: Uint8Array | Buffer | string,
  secret: string,
): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}
