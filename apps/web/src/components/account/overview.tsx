"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Building } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { siteMessages } from "@/i18n/site";
import { shellMessages } from "@/i18n/shell";
import { Card, Skeleton } from "@/components/ui/status";
import { appModules } from "@/components/layout/modules";
import { TrialStrip } from "./trial-strip";

type Cards = {
  totalTransactions: number;
  inReviewCount: number;
  approvedCount: number;
  exportedCount: number;
  coretaxAcceptedCount: number;
  coretaxRejectedCount: number;
};

/** Odoo Enterprise-style home: module icons first, then key figures. */
export function Overview({
  locale,
  superadmin = false,
}: {
  locale: Locale;
  superadmin?: boolean;
}) {
  const t = siteMessages[locale];
  const rep = reportMessages[locale];
  const sh = shellMessages[locale];
  const modules = appModules(locale).filter(
    (m) => !m.superadminOnly || superadmin,
  );
  const [workspace, setWorkspace] = useState<{
    active: null | { name: string };
  } | null>(null);
  const [cards, setCards] = useState<Cards | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/workspaces", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("UNAVAILABLE");
        return r.json();
      })
      .then(async (value) => {
        if (!active) return;
        setWorkspace(value);
        if (value?.active) {
          const rec = await fetch(
            "/api/reports/reconciliation?page=1&pageSize=1",
            { cache: "no-store" },
          );
          if (rec.ok && active) setCards((await rec.json()).cards ?? null);
        }
      })
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);

  const figures: [string, number, string][] = cards
    ? [
        [
          rep.cards.total,
          cards.totalTransactions,
          `/${locale}/app/transactions`,
        ],
        [
          rep.cards.inReview,
          cards.inReviewCount,
          `/${locale}/app/transactions`,
        ],
        [rep.cards.approved, cards.approvedCount, `/${locale}/app/exports`],
        [rep.cards.exported, cards.exportedCount, `/${locale}/app/exports`],
        [
          rep.cards.coretaxAccepted,
          cards.coretaxAcceptedCount,
          `/${locale}/app/reconciliation`,
        ],
        [
          rep.cards.coretaxRejected,
          cards.coretaxRejectedCount,
          `/${locale}/app/reconciliation`,
        ],
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
      <section aria-labelledby="apps-title" className="space-y-6">
        <div className="space-y-1 text-center">
          <h1 id="apps-title" className="text-2xl font-semibold sm:text-3xl">
            {workspace?.active?.name ?? sh.homeTitle}
          </h1>
          <p className="text-sm text-muted-foreground">{sh.homeIntro}</p>
        </div>
        <ul className="mx-auto grid max-w-4xl grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-4 lg:grid-cols-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <li key={module.id}>
                <Link
                  href={module.href}
                  title={module.hint}
                  className="group flex flex-col items-center gap-2.5 rounded-xl p-2 text-center outline-offset-4"
                >
                  <span
                    className={`flex size-16 items-center justify-center rounded-2xl ${module.tile} shadow-md transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:shadow-lg group-active:translate-y-0 sm:size-[4.5rem]`}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-7 sm:size-8"
                      strokeWidth={1.75}
                    />
                  </span>
                  <span className="text-sm leading-tight font-medium">
                    {module.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="glance-title" className="space-y-4">
        <h2
          id="glance-title"
          className="text-sm font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {sh.atAGlance}
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            {error ? (
              <Card className="p-5 text-sm" role="alert">
                {t.appError}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => window.location.reload()}
                >
                  {t.refresh}
                </button>
              </Card>
            ) : !workspace ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <Card className="flex items-start gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Building aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-base font-semibold break-words">
                    {workspace.active?.name ?? t.noWorkspace}
                  </p>
                  {!workspace.active && (
                    <p className="text-sm text-muted-foreground">
                      {t.noActiveBody}
                    </p>
                  )}
                  <Link
                    className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                    href={`/${locale}/app/settings`}
                  >
                    {t.manageWorkspace}
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              </Card>
            )}
            <TrialStrip locale={locale} />
          </div>
          {cards && (
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">
                  {rep.reconciliationTitle}
                </h2>
                <Link
                  className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                  href={`/${locale}/app/reconciliation`}
                >
                  {t.reconciliation}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {figures.map(([label, value, href]) => (
                  <Link
                    key={label}
                    href={href}
                    className="rounded-lg border bg-surface-2 p-4 transition-colors hover:border-foreground/40"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                      {value}
                    </p>
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {rep.manualOnlyBanner}
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
