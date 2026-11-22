import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/figtree";
import { isLocale, locales, messages } from "@/i18n/messages";
import { themeBootScript } from "@/lib/theme";
import { ThemeGuard } from "@/components/layout/preferences";
import "../globals.css";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: { default: "SerenTax", template: "%s · SerenTax" },
    description: messages[locale].description,
  };
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
};
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint (no light flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeGuard />
        {children}
      </body>
    </html>
  );
}
