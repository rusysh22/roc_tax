import Link from "next/link";
import type { Locale } from "@/i18n/messages";
import { messages } from "@/i18n/messages";
import { siteMessages } from "@/i18n/site";
import { releaseFeatures, documentFamilies } from "@/lib/release";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import type { PublicCatalog } from "@/server/billing/catalog";

export const publicPages = [
  "features",
  "how-it-works",
  "pricing",
  "faq",
  "security",
  "terms",
  "privacy",
] as const;
export type PublicPage = (typeof publicPages)[number];
export function pageTitle(page: PublicPage, locale: Locale) {
  const t = siteMessages[locale];
  return page === "how-it-works" ? t.workflow : t[page];
}
export function FeatureCards({
  locale,
  onlyCurrent = false,
}: {
  locale: Locale;
  onlyCurrent?: boolean;
}) {
  const t = siteMessages[locale];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {releaseFeatures
        .filter((feature) => !onlyCurrent || feature.available)
        .map((feature) => (
          <article
            key={feature.title}
            className="flex flex-col items-start rounded-lg border bg-background p-6"
          >
            <StatusBadge active={feature.available}>
              {feature.available ? t.current : t.planned}
            </StatusBadge>
            <h3 className="mt-7 text-lg font-semibold tracking-tight">
              {t[feature.title]}
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {t[feature.body]}
            </p>
          </article>
        ))}
    </div>
  );
}
export function FamilyTable({ locale }: { locale: Locale }) {
  const t = siteMessages[locale];
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{t.familiesTitle}</caption>
        <thead className="bg-muted">
          <tr>
            <th scope="col" className="p-4 font-medium">
              {t.family}
            </th>
            <th scope="col" className="p-4 font-medium">
              {t.status}
            </th>
          </tr>
        </thead>
        <tbody>
          {documentFamilies.map((family) => (
            <tr key={family.key} className="border-t">
              <th scope="row" className="p-4 font-medium">
                {t.families[family.key]}
              </th>
              <td className="p-4 text-muted-foreground">{t[family.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Landing({ locale }: { locale: Locale }) {
  const t = siteMessages[locale];
  return (
    <>
      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
        <div>
          <StatusBadge>{t.preview}</StatusBadge>
          <p className="mt-8 text-sm font-medium text-muted-foreground">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-[1.08] font-semibold tracking-tighter sm:text-6xl xl:text-7xl">
            {messages[locale].title}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
            {t.intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={`/${locale}/auth/sign-up`}>
                {t.createAccount}
                <span aria-hidden="true">↗</span>
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/features`}>{t.explore}</Link>
            </Button>
          </div>
        </div>
        <aside
          className="rounded-xl border bg-muted/50 p-5 sm:p-8"
          aria-label={t.designed}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            SerenTax / {t.workflow}
          </p>
          <h2 className="mt-5 text-2xl font-semibold leading-snug tracking-tight">
            {t.designed}
          </h2>
          <ol className="mt-8 space-y-0">
            {[
              [t.step1, t.intake],
              [t.step2, t.review],
              [t.step3, t.export],
            ].map(([title, label], index) => (
              <li className="flex gap-4 border-t py-5" key={title}>
                <span
                  aria-hidden="true"
                  className="font-mono text-sm text-muted-foreground"
                >
                  0{index + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{label}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t pt-5 text-xs leading-6 text-muted-foreground">
            {t.workflowIntro}
          </p>
        </aside>
      </section>
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              {t.current}
            </h2>
            <Link
              href={`/${locale}/features`}
              className="text-sm underline underline-offset-4"
            >
              {t.explore}
            </Link>
          </div>
          <FeatureCards locale={locale} onlyCurrent />
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <h2 className="max-w-lg text-3xl leading-tight font-semibold tracking-tight">
          {t.promise}
        </h2>
        <div>
          <p className="text-lg leading-8 text-muted-foreground">
            {t.promiseBody}
          </p>
          <p className="mt-5 border-l-2 border-foreground pl-5 text-sm leading-7">
            {t.trialCaution}
          </p>
          <Link
            href={`/${locale}/how-it-works`}
            className="mt-6 inline-block text-sm font-medium underline underline-offset-4"
          >
            {t.workflow} →
          </Link>
        </div>
      </section>
    </>
  );
}
export function PublicContent({
  locale,
  page,
  catalog,
}: {
  locale: Locale;
  page: PublicPage;
  catalog?: PublicCatalog;
}) {
  const t = siteMessages[locale];
  const introductions = {
    features: t.featuresIntro,
    "how-it-works": t.workflowIntro,
    pricing: t.pricingIntro,
    faq: t.faqIntro,
    security: t.securityIntro,
    terms: t.legalIntro,
    privacy: t.legalIntro,
  };
  const legal = page === "terms" || page === "privacy";
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20">
      <header className="mb-12 max-w-3xl">
        {legal && <StatusBadge>{t.legalPending}</StatusBadge>}
        <h1 className="mt-4 text-4xl font-semibold tracking-tighter sm:text-5xl">
          {pageTitle(page, locale)}
        </h1>
        <p className="mt-6 text-lg leading-8 text-muted-foreground">
          {introductions[page]}
        </p>
      </header>
      {page === "features" && (
        <>
          <FeatureCards locale={locale} />
          <section className="mt-16 max-w-4xl">
            <h2 className="text-2xl font-semibold">{t.familiesTitle}</h2>
            <p className="mt-3 mb-6 leading-7 text-muted-foreground">
              {t.familiesIntro}
            </p>
            <FamilyTable locale={locale} />
          </section>
        </>
      )}
      {page === "how-it-works" && (
        <ol className="grid gap-5 md:grid-cols-2">
          {[
            [t.step1, t.step1Body],
            [t.step2, t.step2Body],
            [t.step3, t.step3Body],
            [t.step4, t.step4Body],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-lg border p-7">
              <p
                aria-hidden="true"
                className="mb-8 font-mono text-muted-foreground"
              >
                0{i + 1}
              </p>
              <StatusBadge>{t.planned}</StatusBadge>
              <h2 className="mt-4 text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-7 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ol>
      )}
      {page === "pricing" && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section
            className="rounded-lg border p-7"
            data-billing-state={catalog?.state ?? "UNAVAILABLE"}
          >
            <StatusBadge>
              {catalog?.state === "AVAILABLE" ? t.current : t.planned}
            </StatusBadge>
            {catalog?.state === "AVAILABLE" && catalog.plans.length > 0 ? (
              <div className="mt-6 space-y-4">
                <ul className="space-y-3 text-sm">
                  {catalog.plans.map((plan) => (
                    <li
                      key={plan.slug}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-4"
                    >
                      <span>
                        <strong>{plan.name}</strong> ({plan.interval})
                      </span>
                      <span className="font-mono">
                        {plan.currency} {String(plan.price)}
                      </span>
                    </li>
                  ))}
                </ul>
                {catalog.checkoutUrl && (
                  <Button asChild variant="outline">
                    <a
                      href={catalog.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Berlanggan ↗
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <h2 className="mt-6 text-2xl font-semibold">
                  {catalog?.state === "NOT_CONFIGURED" ||
                  catalog?.state === "PENDING_VERIFICATION"
                    ? t.catalogPending
                    : t.catalogUnavailable}
                </h2>
                <p className="mt-4 leading-7 text-muted-foreground">
                  {catalog?.state === "NOT_CONFIGURED" ||
                  catalog?.state === "PENDING_VERIFICATION"
                    ? t.catalogPendingBody
                    : t.catalogUnavailableBody}
                </p>
              </>
            )}
          </section>
          <section className="rounded-lg bg-muted p-7">
            <h2 className="text-2xl font-semibold">{t.trial}</h2>
            <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7">
              {t.trialRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="mt-6 border-t pt-5 text-sm leading-7 text-muted-foreground">
              {t.trialCaution}
            </p>
            <Button asChild className="mt-6">
              <Link href={`/${locale}/auth/sign-up`}>{t.createAccount}</Link>
            </Button>
          </section>
        </div>
      )}
      {page === "faq" && (
        <div className="max-w-4xl divide-y border-y">
          {t.questions.map((item) => (
            <details className="py-1" key={item.q}>
              <summary className="cursor-pointer py-5 pr-6 text-lg font-medium">
                {item.q}
              </summary>
              <p className="max-w-3xl pb-6 text-base leading-8 text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      )}
      {(page === "security" || legal) && (
        <div className="max-w-4xl space-y-8">
          {(page === "security"
            ? t.securityItems
            : page === "terms"
              ? t.termsSections
              : t.privacySections
          ).map((item) => (
            <section key={item.title} className="border-t pt-6">
              <h2 className="text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 leading-8 text-muted-foreground">
                {item.body}
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
