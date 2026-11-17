import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { TransactionsListView } from "@/components/intake/transactions-list";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TransactionsListView locale={locale} />;
}
