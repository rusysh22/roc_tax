"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import type { Locale } from "@/i18n/messages";
import { accountError, accountMessages } from "@/i18n/account";
import { Button } from "@/components/ui/button";
import { post } from "./forms";
export function Invitation({ locale }: { locale: Locale }) {
  const t = accountMessages[locale];
  const [token, setToken] = useState("");
  const consumedFragment = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (consumedFragment.current) return;
    consumedFragment.current = true;
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function accept() {
    setBusy(true);
    try {
      await post("/api/workspaces", { action: "accept", token });
      window.location.assign(`/${locale}/app`);
    } catch (error) {
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
    <main className="mx-auto max-w-lg space-y-6 p-8">
      <h1 className="text-2xl font-semibold">{t.accept}</h1>
      <p>{t.invitationHelp}</p>
      <nav className="flex gap-6 underline">
        <Link href={`/${locale}/auth/sign-in`}>{t.signIn}</Link>
        <Link href={`/${locale}/auth/sign-up`}>{t.signUp}</Link>
      </nav>
      <Button disabled={busy || !/^[a-f0-9]{64}$/.test(token)} onClick={accept}>
        {busy ? t.busy : t.accept}
      </Button>
      <p role="alert">{message}</p>
    </main>
  );
}
