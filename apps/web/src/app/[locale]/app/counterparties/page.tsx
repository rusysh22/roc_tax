import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { CounterpartiesList } from "@/components/intake/counterparties";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CounterpartiesList locale={locale} />;
}
