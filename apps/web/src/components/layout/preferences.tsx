"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/messages";
import { siteMessages } from "@/i18n/site";
import { Button } from "@/components/ui/button";
export function LocaleSwitch({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const other = locale === "id" ? "en" : "id";
  const destination = pathname.replace(/^\/(id|en)(?=\/|$)/, `/${other}`);
  return (
    <Link
      className="inline-flex min-h-11 items-center px-2 text-sm"
      href={destination}
      lang={other}
      hrefLang={other}
    >
      {other === "en" ? "English" : "Bahasa Indonesia"}
    </Link>
  );
}
export function ThemeToggle({ locale }: { locale: Locale }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    setDark(
      stored
        ? stored === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("serentax-theme", next ? "dark" : "light");
    } catch {
      /* Theme still applies when browser storage is unavailable. */
    }
  }
  const t = siteMessages[locale];
  return (
    <Button
      variant="outline"
      onClick={toggle}
      aria-label={t.theme}
      aria-pressed={dark}
      title={dark ? t.light : t.dark}
      className="w-11 px-0"
    >
      <span aria-hidden="true">{dark ? "☀" : "◐"}</span>
    </Button>
  );
}
