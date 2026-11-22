"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { trialMessages, formatTrialTimestamp } from "@/i18n/trial";
import type { TrialSnapshot as BaseTrialSnapshot } from "@/server/trial/state";
import type { CreationAllowance } from "@/server/trial/service";
import { Button } from "@/components/ui/button";
import { post } from "./forms";
type TrialSnapshot = BaseTrialSnapshot & {
  subscription?: CreationAllowance | null;
};
export function TrialStrip({ locale }: { locale: Locale }) {
  const t = trialMessages[locale];
  const [trial, setTrial] = useState<TrialSnapshot | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const anchor = useRef({ time: 0, remaining: 0 });
  const generation = useRef(0);
  async function refresh(activate = false) {
    const requestId = ++generation.current;
    if (activate) setBusy(true);
    try {
      let data: TrialSnapshot;
      if (activate) data = await post("/api/trial", { action: "activate" });
      else {
        const response = await fetch("/api/trial", { cache: "no-store" });
        if (!response.ok) throw new Error("UNAVAILABLE");
        data = await response.json();
      }
      if (requestId !== generation.current) return;
      anchor.current = { time: performance.now(), remaining: data.remainingMs };
      setTrial(data);
      setRemaining(data.remainingMs);
      setFailed(false);
    } catch {
      if (requestId === generation.current) {
        setFailed(true);
        setTrial(null);
      }
    } finally {
      if (activate) setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
    const tick = window.setInterval(
      () =>
        setRemaining(
          Math.max(
            0,
            anchor.current.remaining -
              (performance.now() - anchor.current.time),
          ),
        ),
      1000,
    );
    const poll = window.setInterval(() => {
      void refresh();
    }, 30000);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      generation.current++;
      window.clearInterval(tick);
      window.clearInterval(poll);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, []);
  const state = trial?.expiresAt && remaining <= 0 ? "EXPIRED" : trial?.state;
  const subscription = trial?.subscription ?? null;
  if (subscription)
    return (
      <section
        aria-labelledby="trial-title"
        className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs"
      >
        <h2 id="trial-title" className="text-base font-semibold">
          {t.subscriptionTitle}
        </h2>
        <p
          role="status"
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-medium text-background"
        >
          {t.subscriptionActive}
        </p>
        <dl className="grid grid-cols-3 gap-2 text-sm [&>div]:rounded-lg [&>div]:border [&>div]:bg-surface-2 [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:font-semibold">
          <div>
            <dt>{t.subscriptionPlan}</dt>
            <dd className="font-mono">{subscription.planCode ?? "—"}</dd>
          </div>
          <div>
            <dt>{t.subscriptionUsed}</dt>
            <dd className="font-mono tabular-nums">
              {subscription.usedThisMonth}
              {subscription.monthlyLimit !== null &&
                ` / ${subscription.monthlyLimit}`}
            </dd>
          </div>
          <div>
            <dt>{t.subscriptionRemaining}</dt>
            <dd className="font-mono tabular-nums">
              {subscription.remainingThisMonth ?? t.subscriptionUnlimited}
            </dd>
          </div>
        </dl>
        <p className="text-xs leading-5 text-muted-foreground">
          {t.subscriptionNote}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => refresh()}
        >
          {t.retry}
        </Button>
      </section>
    );
  const seconds = Math.ceil(remaining / 1000);
  const duration = [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  return (
    <section
      aria-labelledby="trial-title"
      className="space-y-4 rounded-xl border bg-surface p-5 shadow-xs"
    >
      <h2 id="trial-title" className="text-base font-semibold">
        {t.title}
      </h2>
      <p role="status" className="text-sm font-medium">
        {failed ? t.error : state ? t[state] : t.loading}
      </p>
      {trial && state === "NOT_ACTIVATED" && (
        <>
          <p>{t.consent}</p>
          <p>{t.unavailable}</p>
          <Button disabled={busy} onClick={() => refresh(true)}>
            {busy ? t.busy : t.activate}
          </Button>
        </>
      )}
      {trial?.expiresAt && (
        <>
          <dl className="grid grid-cols-3 gap-2 text-sm [&>div]:rounded-lg [&>div]:border [&>div]:bg-surface-2 [&>div]:p-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:font-semibold">
            <div>
              <dt>{t.remaining}</dt>
              <dd className="font-mono text-xl tabular-nums" aria-live="off">
                {duration}
              </dd>
            </div>
            <div>
              <dt>{t.today}</dt>
              <dd>{state === "EXPIRED" ? 0 : trial.remainingToday} / 1</dd>
            </div>
            <div>
              <dt>{t.total}</dt>
              <dd>{trial.remainingTotal} / 3</dd>
            </div>
          </dl>
          <p>
            {t.expiry}:{" "}
            <time dateTime={trial.expiresAt}>
              {formatTrialTimestamp(trial.expiresAt, locale)} WIB
            </time>
          </p>
          {trial.nextAvailableAt && state !== "EXPIRED" && (
            <p>
              {t.next}: {formatTrialTimestamp(trial.nextAvailableAt, locale)}{" "}
              WIB
            </p>
          )}
          {(state === "EXPIRED" || state === "TOTAL_LIMIT") && (
            <p>{t.readOnly}</p>
          )}
        </>
      )}
      <p className="text-xs leading-5 text-muted-foreground">
        {t.limits} {t.billing}
      </p>
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => refresh()}
      >
        {t.retry}
      </Button>
    </section>
  );
}
