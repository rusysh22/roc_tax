"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/i18n/messages";

const LocaleContext = createContext<Locale>("id");

/** Makes the active locale available to shared components (labels, tips). */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}
