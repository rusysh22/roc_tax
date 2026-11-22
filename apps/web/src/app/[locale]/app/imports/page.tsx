import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { ImportsList } from "@/components/intake/imports";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ImportsList locale={locale} />;
}
