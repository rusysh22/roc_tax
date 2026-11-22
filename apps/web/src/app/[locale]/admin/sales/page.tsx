import { PageBody } from "@/components/views/control-panel";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { SalesAdmin } from "@/components/billing/sales-admin";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <PageBody className="max-w-6xl">
      <SalesAdmin locale={locale} />
    </PageBody>
  );
}
