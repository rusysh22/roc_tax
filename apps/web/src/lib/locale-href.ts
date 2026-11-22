import type { Locale } from "../i18n/messages";

/** Swaps only the leading `/id` or `/en` segment of a path. */
export function localeHref(pathname: string, target: Locale) {
  return pathname.replace(/^\/(id|en)(?=\/|$)/, `/${target}`);
}
