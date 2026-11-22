import { notFound, redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { isLocale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { ocrMessages } from "@/i18n/ocr";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/status";
import { shellSession } from "@/server/shell/session";

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
      {session.user.superadmin ? (
        children
      ) : (
        <div role="alert">
          <EmptyState
            icon={<ShieldAlert />}
            title={ocrMessages[locale].forbiddenAdmin}
          />
        </div>
      )}
    </AppShell>
  );
}
