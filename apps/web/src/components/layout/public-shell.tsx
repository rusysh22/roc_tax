import Link from "next/link";
import type { Locale } from "@/i18n/messages";
import { messages } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { siteMessages } from "@/i18n/site";
import { salesMessages } from "@/i18n/sales";
import { LocaleSwitch, ThemeToggle } from "./preferences";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand";
export function PublicShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = siteMessages[locale];
  const links = [
    { path: "features", label: t.features },
    { path: "how-it-works", label: t.workflow },
    { path: "pricing", label: t.pricing },
    { path: "faq", label: t.faq },
  ];
  return (
    <>
      <a href="#content" className="skip-link">
        {messages[locale].skip}
      </a>
      <header className="sticky top-0 z-40 border-b bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
          <Link
            href={`/${locale}`}
            className="flex items-center text-foreground"
          >
            <BrandLogo className="h-7" />
          </Link>
          <nav
            aria-label={t.navigation}
            className="hidden items-center gap-1 text-sm lg:flex"
          >
            {links.map((link) => (
              <Link
                className="rounded-md px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                key={link.path}
                href={`/${locale}/${link.path}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LocaleSwitch locale={locale} className="hover:bg-muted" />
            <ThemeToggle locale={locale} className="hover:bg-muted" />
            <Button asChild variant="outline" className="hidden md:inline-flex">
              <Link href={`/${locale}/register`}>
                {salesMessages[locale].contactSales}
              </Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href={`/${locale}/auth/sign-in`}>
                {accountMessages[locale].signIn}
              </Link>
            </Button>
          </div>
          <details className="w-full border-t pt-2 lg:hidden">
            <summary className="cursor-pointer py-2 text-sm font-medium">
              {t.menu}
            </summary>
            <nav aria-label={t.navigation} className="grid gap-1 py-3">
              {links.map((link) => (
                <Link
                  key={link.path}
                  className="rounded-md px-3 py-3 hover:bg-muted"
                  href={`/${locale}/${link.path}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                className="rounded-md px-3 py-3 hover:bg-muted"
                href={`/${locale}/register`}
              >
                {salesMessages[locale].contactSales}
              </Link>
              <Link
                className="rounded-md px-3 py-3 font-medium hover:bg-muted"
                href={`/${locale}/auth/sign-in`}
              >
                {accountMessages[locale].signIn}
              </Link>
            </nav>
          </details>
        </div>
      </header>
      <main id="content" tabIndex={-1}>
        {children}
      </main>
      <footer className="border-t bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center text-foreground"
            >
              <BrandLogo className="h-7" />
            </Link>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {messages[locale].disclaimer}
            </p>
          </div>
          <nav
            aria-label={t.footer}
            className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm"
          >
            {[
              ...links,
              { path: "security", label: t.security },
              { path: "terms", label: t.terms },
              { path: "privacy", label: t.privacy },
            ].map((link) => (
              <Link
                key={link.path}
                className="py-1 underline-offset-4 hover:underline"
                href={`/${locale}/${link.path}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
