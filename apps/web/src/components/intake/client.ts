import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import type { FieldIssue } from "@/lib/intake/schemas";
import type { DuplicateWarning } from "@/server/intake/service";

export class ApiFailure extends Error {
  constructor(
    public code: string,
    public issues: FieldIssue[] = [],
    public duplicates: DuplicateWarning[] = [],
    public existingName?: string,
  ) {
    super(code);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiFailure(
      body.code ?? "FAILED",
      body.issues ?? [],
      body.duplicates ?? [],
      body.existingName,
    );
  }
  return body as T;
}

export async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiFailure(
      body.code ?? "FAILED",
      body.issues ?? [],
      body.duplicates ?? [],
      body.existingName,
    );
  }
  return body as T;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
    },
    body: file,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiFailure(body.code ?? "FAILED", body.issues ?? []);
  }
  return body as T;
}

export function formatFailure(error: unknown, locale: Locale): string {
  const t = intakeMessages[locale];
  if (error instanceof ApiFailure) {
    if (error.issues.length) {
      return error.issues
        .map(
          (issue) =>
            `${issue.path}: ${t.issues[issue.code] ?? t.issues.INVALID}`,
        )
        .join(" · ");
    }
    const map = t.errors as Record<string, string>;
    const base = map[error.code] ?? t.errors.FAILED;
    return error.existingName ? `${base} (${error.existingName})` : base;
  }
  return t.errors.FAILED;
}

export function formatAmountString(amount: string, locale: Locale) {
  const [whole, fraction = "00"] = amount.split(".");
  const formatted = new Intl.NumberFormat(
    locale === "id" ? "id-ID" : "en-GB",
  ).format(BigInt(whole || "0"));
  const separator = locale === "id" ? "," : ".";
  return `IDR ${formatted}${separator}${fraction.padEnd(2, "0").slice(0, 2)}`;
}
