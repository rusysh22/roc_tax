"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleCheck, Send } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { salesMessages } from "@/i18n/sales";
import { Button } from "@/components/ui/button";
import { FormField, TextArea, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/status";

/** Public sales-led registration form (sits next to self-serve sign-up). */
export function SalesRegister({ locale }: { locale: Locale }) {
  const t = salesMessages[locale];
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: value("companyName"),
          picName: value("picName"),
          email: value("email"),
          phone: value("phone"),
          npwp: value("npwp") || undefined,
          estimatedMonthlyInvoices: value("estimated") || undefined,
          message: value("message"),
          locale,
          website: value("website") || undefined,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          code?: string;
        };
        const map = t.errors as Record<string, string>;
        setError(map[body.code ?? ""] ?? t.errors.SERVICE_UNAVAILABLE);
        return;
      }
      setDone(true);
    } catch {
      setError(t.errors.SERVICE_UNAVAILABLE);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          {t.registerTitle}
        </h1>
        <p className="text-muted-foreground">{t.registerIntro}</p>
      </div>
      <div className="rounded-xl border bg-surface p-6 shadow-sm sm:p-8">
        {done ? (
          <div className="space-y-3 py-6 text-center" role="status">
            <CircleCheck
              aria-hidden="true"
              className="mx-auto size-10 text-success"
            />
            <h2 className="text-xl font-semibold">{t.successTitle}</h2>
            <p className="text-sm text-muted-foreground">{t.successBody}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-base font-semibold">{t.formTitle}</h2>
            {error && (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            )}
            <FormField field="lead.companyName" required>
              <TextInput
                name="companyName"
                minLength={2}
                maxLength={200}
                autoComplete="organization"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField field="lead.picName" required>
                <TextInput
                  name="picName"
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                />
              </FormField>
              <FormField field="lead.email" required>
                <TextInput
                  name="email"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                />
              </FormField>
              <FormField field="lead.phone" required>
                <TextInput
                  name="phone"
                  type="tel"
                  placeholder="+62"
                  maxLength={20}
                  autoComplete="tel"
                />
              </FormField>
              <FormField field="lead.npwp">
                <TextInput name="npwp" inputMode="numeric" maxLength={32} />
              </FormField>
            </div>
            <FormField field="lead.estimatedMonthlyInvoices">
              <TextInput name="estimated" type="number" min={0} />
            </FormField>
            <FormField field="lead.message">
              <TextArea name="message" maxLength={2000} rows={4} />
            </FormField>
            {/* Honeypot for bots: hidden from people and assistive tech. */}
            <div aria-hidden="true" className="hidden">
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{t.privacyNote}</p>
            <Button type="submit" disabled={busy} className="w-full">
              <Send aria-hidden="true" />
              <span>{busy ? t.sending : t.submit}</span>
            </Button>
          </form>
        )}
      </div>
      <p className="text-center text-sm text-muted-foreground">
        {t.selfServeHint}{" "}
        <Link
          href={`/${locale}/auth/sign-up`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t.selfServeLink}
        </Link>
      </p>
    </div>
  );
}
