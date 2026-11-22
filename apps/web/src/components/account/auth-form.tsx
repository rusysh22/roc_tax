"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { Locale } from "@/i18n/messages";
import { accountMessages, accountError } from "@/i18n/account";
import { Field, post } from "./forms";
import { Button } from "@/components/ui/button";
import { LocaleSwitch, ThemeToggle } from "@/components/layout/preferences";
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
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <LocaleSwitch locale={locale} className="hover:bg-muted" />
        <ThemeToggle locale={locale} className="hover:bg-muted" />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <Link
          href={`/${locale}`}
          className="mx-auto flex w-fit items-center gap-2 text-xl font-bold tracking-tight"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-foreground text-sm text-background">
            S
          </span>
          SerenTax
        </Link>
        <div className="space-y-6 rounded-xl border bg-surface p-6 shadow-md sm:p-8">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">{titles[screen]}</h1>
            {screen === "verify" && (
              <p className="text-sm text-muted-foreground">{t.verifiedHelp}</p>
            )}
          </div>
          {!ready && (
            <p
              role="alert"
              className="rounded-lg border border-dashed px-3 py-2 text-sm"
            >
              {t.unavailable}
            </p>
          )}
          {params.get("error") && (
            <p
              role="alert"
              className="rounded-lg border border-foreground px-3 py-2 text-sm"
            >
              {t.failed}
            </p>
          )}
          <form onSubmit={submit} className="space-y-5">
            <fieldset disabled={busy || !ready} className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">
                    {t.passwordHint}
                  </p>
                </>
              )}
              <Button
                type="submit"
                disabled={busy}
                aria-busy={busy}
                className="w-full"
              >
                {busy
                  ? t.busy
                  : screen === "verify"
                    ? t.resend
                    : titles[screen]}
              </Button>
            </fieldset>
          </form>
          <p
            role={failed ? "alert" : "status"}
            aria-live="polite"
            className={
              message
                ? failed
                  ? "rounded-lg border border-foreground px-3 py-2 text-sm"
                  : "rounded-lg bg-muted px-3 py-2 text-sm"
                : "sr-only"
            }
          >
            {message}
          </p>
        </div>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {(["sign-in", "sign-up", "forgot", "verify"] as const)
            .filter((s) => s !== screen)
            .map((s) => (
              <Link
                key={s}
                href={`/${locale}/auth/${s}`}
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {titles[s]}
              </Link>
            ))}
        </nav>
      </div>
    </main>
  );
}
