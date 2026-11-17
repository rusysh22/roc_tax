import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { OrgBillingView } from "@/components/billing/org-billing";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <OrgBillingView locale={locale} />;
}
