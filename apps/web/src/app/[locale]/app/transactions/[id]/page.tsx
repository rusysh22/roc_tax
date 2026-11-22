import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { TransactionForm } from "@/components/intake/transaction-form";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <TransactionForm locale={locale} transactionId={id} />;
}
