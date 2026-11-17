import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { PublicShell } from "@/components/layout/public-shell";
import {
  PublicContent,
  publicPages,
  pageTitle,
  type PublicPage,
} from "@/components/marketing/content";
import { getPublicCatalog } from "@/server/billing/catalog";
type Props = { params: Promise<{ locale: string; publicPage: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale, publicPage } = await params;
  return isLocale(locale) && publicPages.includes(publicPage as PublicPage)
    ? { title: pageTitle(publicPage as PublicPage, locale) + " | SerenTax" }
    : {};
}
export default async function Page({ params }: Props) {
  const { locale, publicPage } = await params;
  if (!isLocale(locale) || !publicPages.includes(publicPage as PublicPage))
    notFound();
  return (
    <PublicShell locale={locale}>
      <PublicContent
        locale={locale}
        page={publicPage as PublicPage}
        catalog={
          publicPage === "pricing" ? await getPublicCatalog() : undefined
        }
      />
    </PublicShell>
  );
}
