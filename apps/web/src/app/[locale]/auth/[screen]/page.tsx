import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AuthForm, type AuthScreen } from "@/components/account/auth-form";
import { isLocale, messages } from "@/i18n/messages";
import { authConfiguration } from "@/server/auth/config";
export const dynamic = "force-dynamic";
export default async function AuthPage({
  params,
}: {
  params: Promise<{ locale: string; screen: string }>;
}) {
  const { locale, screen } = await params;
  if (
    !isLocale(locale) ||
    !["sign-in", "sign-up", "forgot", "reset", "verify"].includes(screen)
  )
    notFound();
  let ready = true;
  try {
    authConfiguration();
  } catch {
    ready = false;
  }
  return (
    <Suspense fallback={<p role="status">{messages[locale].loading}</p>}>
      <AuthForm locale={locale} screen={screen as AuthScreen} ready={ready} />
    </Suspense>
  );
}
