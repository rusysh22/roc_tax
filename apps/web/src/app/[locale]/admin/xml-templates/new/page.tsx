import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { XmlTemplateForm } from "@/components/export/admin-xml-templates";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <XmlTemplateForm locale={locale} templateId={null} />;
}
