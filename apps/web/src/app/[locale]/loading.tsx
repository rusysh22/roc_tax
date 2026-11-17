"use client";
import { useParams } from "next/navigation";
import { isLocale, messages } from "@/i18n/messages";
import { Skeleton } from "@/components/ui/status";
export default function Loading() {
  const { locale } = useParams<{ locale: string }>();
  return (
    <main className="p-10" role="status">
      {messages[isLocale(locale) ? locale : "id"].loading}
      <div aria-hidden="true" className="mt-8 space-y-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    </main>
  );
}
