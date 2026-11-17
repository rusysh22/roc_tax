import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { ExportsView } from "@/components/export/exports-view";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ExportsView locale={locale} />;
}
