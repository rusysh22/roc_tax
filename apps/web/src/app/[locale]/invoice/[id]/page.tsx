import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/messages";
import { shellSession } from "@/server/shell/session";
import { InvoiceSheet } from "@/components/billing/invoices";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

/** Standalone printable invoice (no app chrome, so it prints cleanly). */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const session = await shellSession();
  if (session.state === "anonymous") redirect(`/${locale}/auth/sign-in`);
  return (
    <main className="min-h-dvh bg-background print:bg-white">
      <InvoiceSheet locale={locale} invoiceId={id} />
    </main>
  );
}
