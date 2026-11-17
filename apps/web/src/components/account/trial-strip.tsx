"use client";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { trialMessages, formatTrialTimestamp } from "@/i18n/trial";
import type { TrialSnapshot } from "@/server/trial/state";
import { Button } from "@/components/ui/button";
import { post } from "./forms";
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
      className="space-y-4 rounded-md border p-5"
    >
      <h2 id="trial-title" className="text-xl font-semibold">
        {t.title}
      </h2>
      <p role="status">{failed ? t.error : state ? t[state] : t.loading}</p>
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
          <dl className="grid gap-4 sm:grid-cols-3">
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
      <p className="text-sm text-muted-foreground">{t.limits}</p>
      <p className="text-sm text-muted-foreground">{t.billing}</p>
      <Button variant="outline" disabled={busy} onClick={() => refresh()}>
        {t.retry}
      </Button>
    </section>
  );
}
