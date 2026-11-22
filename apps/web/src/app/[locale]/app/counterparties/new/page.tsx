import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { CounterpartyForm } from "@/components/intake/counterparties";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CounterpartyForm locale={locale} counterpartyId={null} />;
}
