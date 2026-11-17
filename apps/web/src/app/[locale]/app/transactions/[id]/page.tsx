import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { TransactionDetailView } from "@/components/intake/transaction-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <TransactionDetailView locale={locale} transactionId={id} />;
}
