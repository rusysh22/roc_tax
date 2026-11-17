import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { siteMessages } from "@/i18n/site";
import { StatusBadge } from "@/components/ui/status";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; section: string }>;
}) {
  const { locale, section } = await params;
  if (!isLocale(locale) || section !== "help") notFound();
  const t = siteMessages[locale];
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold">
        {t[section as "exports" | "help"]}
      </h1>
      {section !== "help" && <StatusBadge>{t.planned}</StatusBadge>}
      <p className="leading-8 text-muted-foreground">
        {section === "help" ? t.helpIntro : t.emptyBody}
      </p>
      {section !== "help" && (
        <p className="rounded-lg border p-6 text-sm leading-7">
          {t.futureNote}
        </p>
      )}
      <div className="flex flex-wrap gap-6">
        <Link href={`/${locale}/app/settings`} className="underline">
          {t.settings}
        </Link>
        <Link href={`/${locale}/features`} className="underline">
          {t.featuresLink}
        </Link>
        <Link href={`/${locale}/faq`} className="underline">
          {t.faq}
        </Link>
      </div>
    </div>
  );
}
