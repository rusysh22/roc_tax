import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { AdminOcrProvidersView } from "@/components/ocr/admin-providers";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <AdminOcrProvidersView locale={locale} />;
}
