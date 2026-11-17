import type { Locale } from "./messages";
export const BUSINESS_TIME_ZONE = "Asia/Jakarta";
const intlLocale = (locale: Locale) => (locale === "id" ? "id-ID" : "en-GB");
export function formatCurrency(value: number | bigint, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "IDR",
  }).format(value);
}
export function formatDate(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(value);
}
