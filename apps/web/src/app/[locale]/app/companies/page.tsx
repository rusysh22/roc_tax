import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { CompaniesView } from "@/components/intake/companies";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <CompaniesView locale={locale} />;
}
