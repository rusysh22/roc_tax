"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Minus,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { onboardingMessages, type TourStepId } from "@/i18n/onboarding";
import { fmt } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Progress = {
  role: string | null;
  steps: Record<Exclude<TourStepId, "welcome" | "done">, boolean>;
};

const ORDER: TourStepId[] = [
  "welcome",
  "workspace",
  "team",
  "company",
  "counterparty",
  "transaction",
  "approved",
  "exported",
  "done",
];
const CHECKABLE = ORDER.slice(1, -1) as Exclude<
  TourStepId,
  "welcome" | "done"
>[];

/** Event other components dispatch to (re)open the guide. */
export const OPEN_TOUR_EVENT = "serentax:open-tour";

type Saved = { dismissed: boolean; step: number };

function storageKey(email: string) {
  return `serentax-tour:${email.toLowerCase()}`;
}
function readSaved(email: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (raw)
      return {
        dismissed: false,
        step: 0,
        ...(JSON.parse(raw) as Partial<Saved>),
      };
  } catch {
    /* Storage unavailable: start fresh. */
  }
  return { dismissed: false, step: 0 };
}
function writeSaved(email: string, value: Saved) {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(value));
  } catch {
    /* Best effort only. */
  }
}

/**
 * Getting-started guide as a chat bubble. Steps tick off automatically from
 * real workspace data (/api/onboarding); each step links to the screen where
 * the user completes it. State (dismissed, current step) is a per-browser
 * convenience kept in localStorage.
 */
export function OnboardingTour({
  locale,
  email,
}: {
  locale: Locale;
  email: string;
}) {
  const t = onboardingMessages[locale];
  const path = usePathname();
  const app = `/${locale}/app`;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ready, setReady] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const autoOpen = useRef(false);
  const firstPath = useRef(path);
  const endRef = useRef<HTMLDivElement>(null);

  const links: Partial<Record<TourStepId, string>> = {
    workspace: `${app}/settings?tab=workspaces`,
    team: `${app}/settings?tab=team`,
    company: `${app}/companies`,
    counterparty: `${app}/counterparties`,
    transaction: `${app}/transactions`,
    approved: `${app}/transactions`,
    exported: `${app}/exports`,
    done: `${app}/help`,
  };

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/onboarding", { cache: "no-store" });
      if (response.ok) setProgress((await response.json()) as Progress);
    } catch {
      /* Checklist ticks are optional. */
    }
  }, []);

  // First visit: open automatically on the home screen unless dismissed.
  useEffect(() => {
    const saved = readSaved(email);
    setStep(Math.min(saved.step, ORDER.length - 1));
    setReady(true);
    autoOpen.current = !saved.dismissed && path === app;
    // Only on mount; later navigation must not reopen a dismissed guide.
  }, []);

  useEffect(() => {
    void load();
    // Following a step link collapses the guide to its launcher.
    if (path !== firstPath.current) {
      firstPath.current = path;
      setOpen(false);
    }
  }, [load, path]);

  // Open automatically once, only while some steps are still open.
  useEffect(() => {
    if (!progress || !autoOpen.current) return;
    autoOpen.current = false;
    if (CHECKABLE.some((id) => !progress.steps[id])) setOpen(true);
  }, [progress]);

  useEffect(() => {
    const reopen = () => {
      setOpen(true);
      writeSaved(email, { ...readSaved(email), dismissed: false });
    };
    window.addEventListener(OPEN_TOUR_EVENT, reopen);
    return () => window.removeEventListener(OPEN_TOUR_EVENT, reopen);
  }, [email]);

  useEffect(() => {
    if (ready) writeSaved(email, { ...readSaved(email), step });
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [step, ready, email]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function dismiss() {
    setOpen(false);
    writeSaved(email, { dismissed: true, step });
  }

  const doneCount = progress
    ? CHECKABLE.filter((id) => progress.steps[id]).length
    : 0;
  const isDone = (id: TourStepId) =>
    id !== "welcome" &&
    id !== "done" &&
    Boolean(progress?.steps[id as (typeof CHECKABLE)[number]]);
  const current = ORDER[step];
  const shown = ORDER.slice(0, step + 1);

  if (!ready) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          ref={panelRef}
          role="complementary"
          aria-label={t.guideName}
          tabIndex={-1}
          className="animate-pop flex max-h-[min(36rem,calc(100dvh-6rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-surface shadow-xl outline-none"
        >
          <header className="flex items-center gap-3 border-b bg-primary px-4 py-3 text-white">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Sparkles aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.guideName}</p>
              <p className="truncate text-xs text-white/80">
                {fmt(t.progress, { done: doneCount, total: CHECKABLE.length })}
              </p>
            </div>
            <button
              type="button"
              aria-label={t.minimize}
              onClick={() => setOpen(false)}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-white/15"
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              aria-label={t.skip}
              onClick={dismiss}
              className="inline-flex size-8 items-center justify-center rounded-md hover:bg-white/15"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </header>
          <div className="h-1 bg-muted" aria-hidden="true">
            <div
              className="h-full bg-success transition-[width] duration-300"
              style={{ width: `${(doneCount / CHECKABLE.length) * 100}%` }}
            />
          </div>

          <div
            className="scroll-thin flex-1 space-y-3 overflow-y-auto bg-surface-2 px-4 py-4"
            aria-live="polite"
          >
            {shown.map((id, index) => {
              const text = t.steps[id];
              const done = isDone(id);
              const last = index === shown.length - 1;
              return (
                <div key={id} className="space-y-2">
                  {index > 0 && (
                    <div className="flex justify-end">
                      <span className="rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-xs font-medium text-white">
                        {t.next}
                      </span>
                    </div>
                  )}
                  <div className={cn("flex gap-2", !last && "opacity-70")}>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      <Sparkles className="size-3.5" />
                    </span>
                    <div className="min-w-0 space-y-2 rounded-2xl rounded-tl-sm border bg-surface px-3 py-2.5 text-sm shadow-xs">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {text.title}
                        {done && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-success-fg">
                            <Check aria-hidden="true" className="size-3" />
                            {t.doneBadge}
                          </span>
                        )}
                      </p>
                      <p className="leading-relaxed text-muted-foreground">
                        {text.body}
                      </p>
                      {"cta" in text && text.cta && links[id] && last && (
                        <Button
                          asChild
                          size="sm"
                          variant={done ? "outline" : "default"}
                        >
                          <Link href={links[id]!}>
                            <span>{text.cta}</span>
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          <footer className="flex items-center gap-2 border-t px-3 py-2.5">
            <span className="mr-auto text-xs text-muted-foreground">
              {fmt(t.stepOf, { n: step + 1, total: ORDER.length })}
            </span>
            {step > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft aria-hidden="true" />
                <span>{t.back}</span>
              </Button>
            )}
            {current === "done" ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
                  <RotateCcw aria-hidden="true" />
                  <span>{t.restart}</span>
                </Button>
                <Button size="sm" variant="success" onClick={dismiss}>
                  <Check aria-hidden="true" />
                  <span>{t.finish}</span>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  setStep((s) => Math.min(ORDER.length - 1, s + 1))
                }
              >
                <span>{t.next}</span>
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </footer>
        </div>
      )}

      {!open && (
        <button
          type="button"
          aria-label={t.launcher}
          onClick={() => setOpen(true)}
          className="relative flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles aria-hidden="true" className="size-5" />
          {doneCount < CHECKABLE.length && (
            <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] font-bold">
              {CHECKABLE.length - doneCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
