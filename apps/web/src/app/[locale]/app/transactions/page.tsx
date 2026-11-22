import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { TransactionsList } from "@/components/intake/transactions-list";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TransactionsList locale={locale} />;
}
