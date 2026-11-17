"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { reportMessages } from "@/i18n/reports";
import { siteMessages } from "@/i18n/site";
import { TrialStrip } from "./trial-strip";
import { Skeleton, StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
export function Overview({ locale }: { locale: Locale }) {
  const t = siteMessages[locale];
  const rep = reportMessages[locale];
  const [data, setData] = useState<{ active: null | { name: string } } | null>(
    null,
  );
  const [cards, setCards] = useState<{
    totalTransactions: number;
    inReviewCount: number;
    approvedCount: number;
    exportedCount: number;
    coretaxAcceptedCount: number;
    coretaxRejectedCount: number;
  } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/workspaces", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(async (v) => {
        if (!active) return;
        setData(v);
        if (v?.active) {
          const rec = await fetch(
            "/api/reports/reconciliation?page=1&pageSize=1",
            {
              cache: "no-store",
            },
          );
          if (rec.ok && active) {
            const recJson = await rec.json();
            setCards(recJson.cards ?? null);
          }
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="space-y-8">
      <header>
        <p className="mb-3 text-sm text-muted-foreground">{t.appIntro}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t.appTitle}</h1>
      </header>
      {error ? (
        <p role="alert">
          {t.appError}{" "}
          <button
            className="underline"
            onClick={() => window.location.reload()}
          >
            {t.refresh}
          </button>
        </p>
      ) : !data ? (
        <div role="status" aria-label={t.workspaceLabel}>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <section className="rounded-lg border p-6">
          <h2 className="break-words text-xl font-semibold">
            {data.active?.name ?? t.noWorkspace}
          </h2>
          {!data.active && (
            <p className="mt-3 text-muted-foreground">{t.noActiveBody}</p>
          )}
          <Link
            className="mt-5 inline-block underline underline-offset-4"
            href={`/${locale}/app/settings`}
          >
            {t.manageWorkspace}
          </Link>
        </section>
      )}
      <TrialStrip locale={locale} />
      {cards && (
        <section className="space-y-4 rounded-lg border p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{rep.reconciliationTitle}</h2>
            <Link
              className="text-sm underline underline-offset-4"
              href={`/${locale}/app/reconciliation`}
            >
              {t.reconciliation}
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            {rep.manualOnlyBanner}
          </p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              [rep.cards.total, cards.totalTransactions],
              [rep.cards.inReview, cards.inReviewCount],
              [rep.cards.approved, cards.approvedCount],
              [rep.cards.exported, cards.exportedCount],
              [rep.cards.coretaxAccepted, cards.coretaxAcceptedCount],
              [rep.cards.coretaxRejected, cards.coretaxRejectedCount],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded border p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-mono text-xl font-semibold">{val}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="rounded-lg border bg-muted/30 p-6 sm:p-8">
        <StatusBadge active>{t.current}</StatusBadge>
        <h2 className="mt-6 text-2xl font-semibold">{t.emptyTitle}</h2>
        <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
          {t.emptyBody}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/${locale}/app/transactions`}>{t.transactions}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/app/companies`}>{t.companies}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/app/counterparties`}>
              {t.counterparties}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/${locale}/features`}>{t.featuresLink}</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
