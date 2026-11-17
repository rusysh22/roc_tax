import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { NewTransactionView } from "@/components/intake/transaction-new";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <NewTransactionView locale={locale} />;
}
