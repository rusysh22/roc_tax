import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { salesMessages } from "@/i18n/sales";
import { PublicShell } from "@/components/layout/public-shell";
import { SalesRegister } from "@/components/marketing/sales-register";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return isLocale(locale) ? { title: salesMessages[locale].registerTitle } : {};
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <PublicShell locale={locale}>
      <SalesRegister locale={locale} />
    </PublicShell>
  );
}
