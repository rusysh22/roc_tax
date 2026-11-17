"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isLocale, messages } from "@/i18n/messages";
export default function NotFound() {
  const params = useParams<{ locale?: string }>();
  const locale =
    params.locale && isLocale(params.locale) ? params.locale : "id";
  const t = messages[locale];
  return (
    <main className="space-y-6 p-10">
      <h1>{t.missing}</h1>
      <Link href={`/${locale}`}>{t.home}</Link>
    </main>
  );
}
