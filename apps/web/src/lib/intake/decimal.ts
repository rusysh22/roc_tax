// Fixed-point decimal helpers on bigint. Money never touches binary floats.
// Shared by server validation and client previews; the server result is authoritative.
export const AMOUNT_SCALE = 2;
export const QUANTITY_SCALE = 4;
/** Decimal(20,2) => at most 18 integer digits. */
export const MAX_AMOUNT_INTEGER_DIGITS = 18;
/** Decimal(18,4) => at most 14 integer digits. */
export const MAX_QUANTITY_INTEGER_DIGITS = 14;

export function decimalPattern(integerDigits: number, scale: number) {
  return new RegExp(
    `^(0|[1-9]\\d{0,${integerDigits - 1}})(\\.\\d{1,${scale}})?$`,
  );
}
export const amountPattern = decimalPattern(
  MAX_AMOUNT_INTEGER_DIGITS,
  AMOUNT_SCALE,
);
export const quantityPattern = decimalPattern(
  MAX_QUANTITY_INTEGER_DIGITS,
  QUANTITY_SCALE,
);

export function parseFixed(value: string, scale: number): bigint {
  if (!/^\d+(\.\d+)?$/.test(value)) throw new RangeError("INVALID_DECIMAL");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > scale) throw new RangeError("INVALID_DECIMAL");
  return BigInt(whole + fraction.padEnd(scale, "0"));
}

export function formatFixed(value: bigint, scale: number): string {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value)
    .toString()
    .padStart(scale + 1, "0");
  const whole = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? "-" : ""}${whole}${scale ? "." + fraction : ""}`;
}

/**
 * Exact line amount = quantity × unit price. No rounding policy is assumed:
 * products that cannot be represented at 2 decimals are rejected (null).
 */
export function lineAmount(quantity: string, unitPrice: string): string | null {
  const product =
    parseFixed(quantity, QUANTITY_SCALE) * parseFixed(unitPrice, AMOUNT_SCALE);
  const divisor = BigInt(10) ** BigInt(QUANTITY_SCALE);
  if (product % divisor !== BigInt(0)) return null;
  const amount = product / divisor;
  if (amount >= BigInt(10) ** BigInt(MAX_AMOUNT_INTEGER_DIGITS + AMOUNT_SCALE))
    return null;
  return formatFixed(amount, AMOUNT_SCALE);
}

export function sumAmounts(values: readonly string[]): string | null {
  const total = values.reduce(
    (sum, value) => sum + parseFixed(value, AMOUNT_SCALE),
    BigInt(0),
  );
  if (total >= BigInt(10) ** BigInt(MAX_AMOUNT_INTEGER_DIGITS + AMOUNT_SCALE))
    return null;
  return formatFixed(total, AMOUNT_SCALE);
}

/** Canonical representation (no trailing-zero ambiguity) for fingerprints. */
export function canonicalFixed(value: string, scale: number) {
  return formatFixed(parseFixed(value, scale), scale);
}
