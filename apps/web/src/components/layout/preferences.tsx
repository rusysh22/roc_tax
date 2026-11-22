"use client";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { siteMessages } from "@/i18n/site";
import {
  ensureTheme,
  getTheme,
  setTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";
import { localeHref } from "@/lib/locale-href";

/** Keeps <html data-theme> in place for the whole session. */
export function ThemeGuard() {
  useEffect(() => {
    ensureTheme();
    return subscribeTheme(() => undefined);
  }, []);
  return null;
}

function useTheme(): Theme | null {
  return useSyncExternalStore(
    subscribeTheme,
    () => getTheme(),
    () => null,
  );
}

/**
 * Switching language swaps the root layout (<html lang>). A full navigation
 * re-runs the theme boot script before paint and keeps query string + hash,
 * so neither the theme nor active filters are lost.
 */
export function LocaleSwitch({
  locale,
  className,
  compact = false,
}: {
  locale: Locale;
  className?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const other: Locale = locale === "id" ? "en" : "id";
  const label = other === "en" ? "English" : "Bahasa Indonesia";
  return (
    <a
      href={localeHref(pathname, other)}
      lang={other}
      hrefLang={other}
      aria-label={compact ? label : undefined}
      title={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const { pathname: path, search, hash } = window.location;
        window.location.assign(`${localeHref(path, other)}${search}${hash}`);
      }}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors",
        className,
      )}
    >
      <Languages aria-hidden="true" className="size-4" />
      {compact ? (
        <span className="text-xs font-semibold uppercase">{other}</span>
      ) : (
        <span>{label}</span>
      )}
    </a>
  );
}

export function ThemeToggle({
  locale,
  className,
}: {
  locale: Locale;
  className?: string;
}) {
  const theme = useTheme();
  const t = siteMessages[locale];
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={t.theme}
      aria-pressed={theme === null ? undefined : dark}
      title={dark ? t.light : t.dark}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md transition-colors",
        className,
      )}
    >
      {/* Both icons render identically on server and client; CSS picks one. */}
      <Sun
        aria-hidden="true"
        className="hidden size-4 [[data-theme=dark]_&]:block"
      />
      <Moon
        aria-hidden="true"
        className="block size-4 [[data-theme=dark]_&]:hidden"
      />
    </button>
  );
}
