import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { isLocale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { Workspace } from "@/components/account/workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
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
  return (
    <Workspace
      locale={locale}
      userName={session.user.name}
      email={session.user.email}
      currentSessionId={session.session.id}
    />
  );
}
