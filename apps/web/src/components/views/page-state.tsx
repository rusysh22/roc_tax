"use client";
import Link from "next/link";
import { Building } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { viewMessages } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import type { ComboOption } from "@/components/ui/combobox";
import { fmt } from "@/i18n/views";

/** Shown when the session has no active workspace. */
export function NoWorkspace({ locale }: { locale: Locale }) {
  const v = viewMessages[locale];
  return (
    <EmptyState
      icon={<Building />}
      title={v.noWorkspaceTitle}
      hint={v.noWorkspaceBody}
      action={
        <Button asChild variant="outline">
          <Link href={`/${locale}/app/settings`}>{v.manageWorkspace}</Link>
        </Button>
      }
    />
  );
}

/** Localised labels for Combobox / MultiCombobox. */
export function comboLabels(locale: Locale) {
  const v = viewMessages[locale];
  return {
    placeholder: v.selectPlaceholder,
    noOptions: v.noOptions,
    clear: v.clearValue,
    searchMore: v.searchMore,
    removeTag: (label: string) => fmt(v.removeTag, { label }),
    moreTags: (n: number) => fmt(v.moreTags, { n }),
  };
}

export function toOptions<T>(
  items: T[],
  value: (item: T) => string,
  label: (item: T) => string,
  description?: (item: T) => string | undefined,
): ComboOption[] {
  return items.map((item) => ({
    value: value(item),
    label: label(item),
    description: description?.(item),
  }));
}
