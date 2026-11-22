"use client";
import { codeEntry, type CodeDomain } from "@/i18n/codes";
import { viewMessages } from "@/i18n/views";
import { Badge } from "./status";
import { useLocale } from "./locale-context";
import { InfoTip } from "./tooltip";

/**
 * Standard status/code display: coloured badge with the functional label and
 * an info tip carrying the explanation plus the technical code. Never render
 * a raw enum value in the UI — use this (or codeLabel for plain text).
 */
export function CodeBadge({
  domain,
  code,
  dot = true,
  info = true,
  className,
}: {
  domain: CodeDomain;
  code: string | null | undefined;
  dot?: boolean;
  info?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const entry = codeEntry(locale, domain, code);
  const v = viewMessages[locale];
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <Badge tone={entry.tone} dot={dot} className={className}>
        {entry.label}
      </Badge>
      {info && entry.help && (
        <InfoTip
          functional={entry.help}
          technical={code ?? undefined}
          label={`${v.information}: ${entry.label}`}
          technicalLabel={v.technicalName}
        />
      )}
    </span>
  );
}
