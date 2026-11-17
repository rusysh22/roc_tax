import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/database";
import { isLocale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { ocrMessages } from "@/i18n/ocr";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
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

  const user = await getDatabase().user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });
  if (user?.platformRole !== "SUPERADMIN") {
    return (
      <AppShell locale={locale}>
        <div role="alert" className="max-w-xl rounded-lg border p-6 text-sm">
          {ocrMessages[locale].forbiddenAdmin}
        </div>
      </AppShell>
    );
  }

  return <AppShell locale={locale}>{children}</AppShell>;
}
