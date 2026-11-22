import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { ExportsList } from "@/components/export/exports-view";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ExportsList locale={locale} />;
}
