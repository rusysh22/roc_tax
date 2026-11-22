import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { Overview } from "@/components/account/overview";
import { shellSession } from "@/server/shell/session";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await shellSession();
  return (
    <Overview
      locale={locale}
      superadmin={session.state === "ready" && session.user.superadmin}
    />
  );
}
