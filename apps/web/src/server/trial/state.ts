export const TRIAL_HOURS = 72;
export const TRIAL_TOTAL = 3;
export const TRIAL_DURATION_MS = TRIAL_HOURS * 60 * 60 * 1000;
export function jakartaDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function nextJakartaDay(now: Date) {
  // Jakarta is UTC+07:00 with no DST; arithmetic is done on the local date.
  const localMidnight = new Date(`${jakartaDate(now)}T00:00:00+07:00`);
  return new Date(localMidnight.getTime() + 86400000);
}
export type TrialState =
  "NOT_ACTIVATED" | "ACTIVE" | "DAILY_LIMIT" | "TOTAL_LIMIT" | "EXPIRED";
export type TrialSnapshot = {
  state: TrialState;
  serverNow: string;
  activatedAt: string | null;
  expiresAt: string | null;
  remainingMs: number;
  remainingToday: number;
  remainingTotal: number;
  usedTotal: number;
  nextAvailableAt: string | null;
};
export function trialSnapshot(
  now: Date,
  trial: { activatedAt: Date; expiresAt: Date } | null,
  usage: { jakartaDate: string }[],
): TrialSnapshot {
  const total = usage.length;
  const remainingTotal = Math.max(0, TRIAL_TOTAL - total);
  const remainingMs = trial
    ? Math.max(0, trial.expiresAt.getTime() - now.getTime())
    : 0;
  const spentToday = usage.some(
    (entry) => entry.jakartaDate === jakartaDate(now),
  );
  const state: TrialState = !trial
    ? "NOT_ACTIVATED"
    : remainingMs === 0
      ? "EXPIRED"
      : remainingTotal === 0
        ? "TOTAL_LIMIT"
        : spentToday
          ? "DAILY_LIMIT"
          : "ACTIVE";
  const next = nextJakartaDay(now);
  return {
    state,
    serverNow: now.toISOString(),
    activatedAt: trial?.activatedAt.toISOString() ?? null,
    expiresAt: trial?.expiresAt.toISOString() ?? null,
    remainingMs,
    remainingToday: state === "ACTIVE" ? 1 : 0,
    remainingTotal,
    usedTotal: total,
    nextAvailableAt:
      state === "DAILY_LIMIT" && trial && next < trial.expiresAt
        ? next.toISOString()
        : null,
  };
}
