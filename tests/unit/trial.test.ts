import { describe, it, expect } from "vitest";
import {
  jakartaDate,
  nextJakartaDay,
  trialSnapshot,
  TRIAL_DURATION_MS,
} from "../../apps/web/src/server/trial/state";
import { trialMessages } from "../../apps/web/src/i18n/trial";
describe("Jakarta trial boundaries", () => {
  it("uses Jakarta midnight rather than UTC midnight", () => {
    expect(jakartaDate(new Date("2026-11-16T16:59:59.999Z"))).toBe(
      "2026-11-16",
    );
    expect(jakartaDate(new Date("2026-11-16T17:00:00.000Z"))).toBe(
      "2026-11-17",
    );
    expect(nextJakartaDay(new Date("2026-12-31T16:59:59Z")).toISOString()).toBe(
      "2026-12-31T17:00:00.000Z",
    );
    expect(jakartaDate(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
  });
  it("expires at the exact 72-hour instant and hides a later daily window", () => {
    const activatedAt = new Date("2026-11-16T10:12:13Z");
    const expiresAt = new Date(activatedAt.getTime() + TRIAL_DURATION_MS);
    expect(
      trialSnapshot(
        new Date(expiresAt.getTime() - 1),
        { activatedAt, expiresAt },
        [],
      ).remainingMs,
    ).toBe(1);
    expect(trialSnapshot(expiresAt, { activatedAt, expiresAt }, []).state).toBe(
      "EXPIRED",
    );
    const last = trialSnapshot(
      new Date("2026-11-19T10:00:00Z"),
      { activatedAt, expiresAt },
      [{ jakartaDate: "2026-11-19" }],
    );
    expect(last.nextAvailableAt).toBeNull();
  });
  it("resets only daily allowance, never total usage, at Jakarta midnight", () => {
    const activatedAt = new Date("2026-11-16T00:00:00Z");
    const expiresAt = new Date(activatedAt.getTime() + TRIAL_DURATION_MS);
    const usage = [{ jakartaDate: "2026-11-16" }];
    expect(
      trialSnapshot(
        new Date("2026-11-16T16:59:59Z"),
        { activatedAt, expiresAt },
        usage,
      ).state,
    ).toBe("DAILY_LIMIT");
    const next = trialSnapshot(
      new Date("2026-11-16T17:00:00Z"),
      { activatedAt, expiresAt },
      usage,
    );
    expect(next.remainingToday).toBe(1);
    expect(next.remainingTotal).toBe(2);
    expect(
      trialSnapshot(
        new Date("2026-11-18T17:00:00Z"),
        { activatedAt, expiresAt },
        [
          ...usage,
          { jakartaDate: "2026-11-17" },
          { jakartaDate: "2026-11-18" },
        ],
      ).state,
    ).toBe("TOTAL_LIMIT");
  });
  it("does not claim an unactivated trial is usable and preserves translation keys", () => {
    expect(trialSnapshot(new Date(), null, []).state).toBe("NOT_ACTIVATED");
    expect(trialSnapshot(new Date(), null, []).remainingToday).toBe(0);
    expect(Object.keys(trialMessages.id)).toEqual(
      Object.keys(trialMessages.en),
    );
  });
});
