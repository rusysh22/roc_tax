import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { OrgOcrSettingsView } from "@/components/ocr/org-settings";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <OrgOcrSettingsView locale={locale} />;
}
