"use client";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isLocale, messages } from "@/i18n/messages";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useParams<{ locale: string }>();
  const t = messages[isLocale(locale) ? locale : "id"];
  return (
    <main className="space-y-6 p-10">
      <h1 role="alert">{t.error}</h1>
      <Button onClick={reset}>{t.retry}</Button>
    </main>
  );
}
