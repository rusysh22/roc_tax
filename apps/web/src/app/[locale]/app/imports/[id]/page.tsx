import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { ImportBatchForm } from "@/components/intake/imports";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  return <ImportBatchForm locale={locale} batchId={id} />;
}
