import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { ExportBatchForm } from "@/components/export/exports-view";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <ExportBatchForm locale={locale} batchId={id} />;
}
