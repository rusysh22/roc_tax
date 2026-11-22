import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { OcrProviderForm } from "@/components/ocr/admin-providers";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <OcrProviderForm locale={locale} providerId={id} />;
}
