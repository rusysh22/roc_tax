import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { PublicShell } from "@/components/layout/public-shell";
import { Landing } from "@/components/marketing/content";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <PublicShell locale={locale}>
      <Landing locale={locale} />
    </PublicShell>
  );
}
