"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/messages";
import { accountMessages, accountError } from "@/i18n/account";
import { Field, Submit, post } from "./forms";
export type AuthScreen = "sign-in" | "sign-up" | "forgot" | "reset" | "verify";
export function AuthForm({
  locale,
  screen,
  ready,
}: {
  locale: Locale;
  screen: AuthScreen;
  ready: boolean;
}) {
  const t = accountMessages[locale];
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const titles = {
    "sign-in": t.signIn,
    "sign-up": t.signUp,
    forgot: t.forgot,
    reset: t.reset,
    verify: t.verify,
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setFailed(false);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();
    try {
      if (screen === "sign-in") {
        await post("/api/auth/sign-in/email", {
          email,
          password: data.get("password"),
        });
        window.location.assign(`/${locale}/app`);
      } else if (screen === "sign-up") {
        await post("/api/auth/sign-up/email", {
          email,
          name: data.get("name"),
          password: data.get("password"),
          callbackURL: `/${locale}/auth/sign-in`,
        });
        setMessage(t.checkEmail);
      } else if (screen === "forgot") {
        await post("/api/auth/request-password-reset", {
          email,
          redirectTo: `/${locale}/auth/reset`,
        });
        setMessage(t.checkEmail);
      } else if (screen === "reset") {
        await post("/api/auth/reset-password", {
          token: params.get("token"),
          newPassword: data.get("password"),
        });
        setMessage(t.changedPassword);
      } else {
        await post("/api/auth/send-verification-email", {
          email,
          callbackURL: `/${locale}/auth/sign-in`,
        });
        setMessage(t.checkEmail);
      }
    } catch (error) {
      setFailed(true);
      setMessage(
        accountError(
          error instanceof Error ? error.message : undefined,
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-12">
      <Link href={`/${locale}`}>SerenTax</Link>
      <h1 className="text-3xl font-semibold">{titles[screen]}</h1>
      {!ready && <p role="alert">{t.unavailable}</p>}
      {screen === "verify" && <p>{t.verifiedHelp}</p>}
      {params.get("error") && <p role="alert">{t.failed}</p>}
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={busy || !ready} className="space-y-5">
          {screen === "sign-up" && (
            <Field
              label={t.name}
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          )}
          {screen !== "reset" && (
            <Field
              label={t.email}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          )}
          {["sign-in", "sign-up", "reset"].includes(screen) && (
            <>
              <Field
                label={t.password}
                name="password"
                type="password"
                autoComplete={
                  screen === "sign-in" ? "current-password" : "new-password"
                }
                required
                minLength={screen === "sign-in" ? 1 : 12}
                maxLength={128}
              />
              <p className="text-sm text-muted-foreground">{t.passwordHint}</p>
            </>
          )}
          <Submit busy={busy}>
            {busy ? t.busy : screen === "verify" ? t.resend : titles[screen]}
          </Submit>
        </fieldset>
      </form>
      <p role={failed ? "alert" : "status"} aria-live="polite">
        {message}
      </p>
      <nav className="flex flex-wrap gap-4 text-sm underline">
        {(["sign-in", "sign-up", "forgot", "verify"] as const)
          .filter((s) => s !== screen)
          .map((s) => (
            <Link key={s} href={`/${locale}/auth/${s}`}>
              {titles[s]}
            </Link>
          ))}
      </nav>
      <Link
        className="block text-sm underline"
        href={`/${locale === "id" ? "en" : "id"}/auth/${screen}`}
      >
        {locale === "id" ? "English" : "Bahasa Indonesia"}
      </Link>
    </main>
  );
}
