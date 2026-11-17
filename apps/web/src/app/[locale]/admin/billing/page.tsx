import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { AdminBillingView } from "@/components/billing/admin-billing";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AdminBillingView locale={locale} />;
}
