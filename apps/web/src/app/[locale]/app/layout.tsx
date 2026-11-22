import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { AppShell } from "@/components/layout/app-shell";
import { shellSession } from "@/server/shell/session";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await shellSession();
  if (session.state === "unavailable")
    return (
      <main className="p-8" role="alert">
        {accountMessages[locale].unavailable}
      </main>
    );
  if (session.state === "anonymous") redirect(`/${locale}/auth/sign-in`);
  if (session.state === "unverified") redirect(`/${locale}/auth/verify`);
  return (
    <AppShell locale={locale} user={session.user}>
      {children}
    </AppShell>
  );
}
