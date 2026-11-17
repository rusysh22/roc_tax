import { describe, expect, it } from "vitest";
import { isLocale, messages } from "../../apps/web/src/i18n/messages";
import { formatDate } from "../../apps/web/src/i18n/format";
import { databaseUrlSchema } from "../../apps/web/src/server/environment";
import { GET } from "../../apps/web/src/app/api/health/route";
describe("bootstrap guardrails", () => {
  it("restricts locale values and keeps dictionary keys aligned", () => {
    expect(isLocale("id")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("../../secrets")).toBe(false);
    expect(Object.keys(messages.id).sort()).toEqual(
      Object.keys(messages.en).sort(),
    );
  });
  it("formats a UTC date across the Jakarta midnight boundary", () => {
    expect(formatDate(new Date("2026-11-15T18:00:00Z"), "en")).toContain(
      "16 Nov 2026",
    );
    expect(formatDate(new Date("2026-11-15T18:00:00Z"), "en")).toContain(
      "01:00",
    );
  });
  it("rejects missing and non-Postgres connection strings", () => {
    for (const value of [
      undefined,
      "",
      "https://example.com",
      "file:///secret",
    ])
      expect(databaseUrlSchema.safeParse(value).success).toBe(false);
    expect(
      databaseUrlSchema.safeParse("postgresql://localhost/test").success,
    ).toBe(true);
  });
  it("returns only a non-cached liveness status", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "ok", check: "liveness" });
  });
});
