import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { isLocale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { AppShell } from "@/components/layout/app-shell";
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
  let session;
  try {
    session = await getAuth().api.getSession({
      headers: await headers(),
      query: { disableCookieCache: true },
    });
  } catch {
    return (
      <main className="p-8" role="alert">
        {accountMessages[locale].unavailable}
      </main>
    );
  }
  if (!session) redirect(`/${locale}/auth/sign-in`);
  if (!session.user.emailVerified) redirect(`/${locale}/auth/verify`);
  return <AppShell locale={locale}>{children}</AppShell>;
}
