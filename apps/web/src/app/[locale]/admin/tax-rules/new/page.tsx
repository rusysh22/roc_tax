import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { TaxRuleForm } from "@/components/tax/admin-tax-rules";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <TaxRuleForm locale={locale} ruleId={null} />;
}
