"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { messages } from "@/i18n/messages";
import { siteMessages } from "@/i18n/site";
import { accountMessages } from "@/i18n/account";
import { LocaleSwitch, ThemeToggle } from "./preferences";
import { Button } from "@/components/ui/button";
import { post } from "@/components/account/forms";
export function AppShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = siteMessages[locale];
  const path = usePathname();
  const [data, setData] = useState<{
    workspaces: { id: string; name: string }[];
    active: null | { id: string };
  } | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/workspaces", { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw Error();
          return r.json();
        })
        .then((value) => {
          if (active) {
            setData(value);
            setError(false);
          }
        })
        .catch(() => {
          if (active) setError(true);
        });
    };
    load();
    window.addEventListener("serentax:workspaces-changed", load);
    return () => {
      active = false;
      window.removeEventListener("serentax:workspaces-changed", load);
    };
  }, []);
  const links = [
    ["", t.appTitle],
    ["transactions", t.transactions],
    ["companies", t.companies],
    ["counterparties", t.counterparties],
    ["imports", t.imports],
    ["exports", t.exports],
    ["reconciliation", t.reconciliation],
    ["settings", t.settings],
    ["help", t.help],
  ];
  const nav = (
    <nav aria-label={t.navigation} className="flex flex-wrap gap-2 lg:flex-col">
      {links.map(([slug, label]) => {
        const href = `/${locale}/app${slug ? "/" + slug : ""}`;
        const current = slug
          ? path === href || path.startsWith(`${href}/`)
          : path === href;
        return (
          <Link
            key={slug}
            href={href}
            aria-current={current ? "page" : undefined}
            className="rounded-md px-4 py-3 text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold"
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <>
      <a href="#app-content" className="skip-link">
        {messages[locale].skip}
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
        <Link
          href={`/${locale}`}
          className="text-2xl font-semibold tracking-tighter"
        >
          SerenTax.
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <LocaleSwitch locale={locale} />
          <ThemeToggle locale={locale} />
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post("/api/auth/sign-out");
                window.location.assign(`/${locale}/auth/sign-in`);
              } catch {
                setError(true);
                setBusy(false);
              }
            }}
          >
            {accountMessages[locale].signOut}
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-screen-2xl lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-6 border-b p-5 lg:min-h-screen lg:border-r lg:border-b-0">
          <label className="block text-sm font-medium">
            {t.workspaceLabel}
            <select
              aria-label={t.workspaceLabel}
              className="mt-2 min-h-11 w-full rounded-md border px-2"
              value={data?.active?.id ?? ""}
              disabled={!data || busy}
              onChange={async (e) => {
                setBusy(true);
                try {
                  await post("/api/workspaces", {
                    action: "select",
                    organizationId: e.target.value,
                  });
                  window.location.reload();
                } catch {
                  setError(true);
                  setBusy(false);
                }
              }}
            >
              <option value="" disabled>
                {data?.workspaces.length ? t.chooseWorkspace : t.noWorkspace}
              </option>
              {data?.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm">
              {t.appError}{" "}
              <button
                className="underline"
                onClick={() => window.location.reload()}
              >
                {t.refresh}
              </button>
            </p>
          )}
          <div className="hidden lg:block">{nav}</div>
          <details className="lg:hidden">
            <summary className="cursor-pointer py-2">{t.menu}</summary>
            {nav}
          </details>
          <p className="hidden text-xs leading-6 text-muted-foreground lg:block">
            {t.teamHint}
          </p>
        </aside>
        <main
          id="app-content"
          tabIndex={-1}
          className="min-w-0 p-5 sm:p-8 lg:p-10"
        >
          {children}
        </main>
      </div>
    </>
  );
}
