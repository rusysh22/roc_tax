"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Download, ShieldCheck } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { accountMessages } from "@/i18n/account";
import { fmt } from "@/i18n/views";
import { Button } from "@/components/ui/button";
import { Badge, Notice, Skeleton } from "@/components/ui/status";
import { ApiFailure, apiGet, formatFailure } from "@/components/intake/client";
import { TerminationSection } from "./termination-section";

type Overview = {
  canExport: boolean;
  documents: { stored: number; storedBytes: number; deleted: number };
  retention: {
    daysAfterTermination: number | null;
    exportDaysAfterTermination: number | null;
    dataLocation: string | null;
  };
  subprocessors: {
    name: string;
    purpose: string;
    location: string;
    source: "PLATFORM" | "OCR";
  }[];
};

function bytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function Section({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-0.5 border-b pb-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

/** Settings → Data & privacy: commitments, documents, retention, sub-processors, export. */
export function PrivacyPanel({ locale }: { locale: Locale }) {
  const t = accountMessages[locale].settings.privacy;
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<Overview>("/api/privacy")
      .then(setData)
      .catch((failure: unknown) =>
        setError(
          failure instanceof ApiFailure
            ? formatFailure(failure, locale)
            : String(failure),
        ),
      );
  }, [locale]);

  if (error) return <Notice tone="danger">{error}</Notice>;
  if (!data) return <Skeleton className="h-64 w-full" />;
  const days = (n: number | null) => (n ? fmt(t.days, { n }) : t.notConfigured);

  return (
    <div className="space-y-8">
      <Section title={t.commitmentTitle}>
        <ul className="grid gap-2 sm:grid-cols-2">
          {[t.commitment1, t.commitment2, t.commitment3, t.commitment4].map(
            (text) => (
              <li
                key={text}
                className="flex gap-2.5 rounded-lg border border-success/30 bg-success-soft px-3 py-2.5 text-sm"
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-success"
                />
                <span>{text}</span>
              </li>
            ),
          )}
        </ul>
        <p className="text-xs text-muted-foreground">{t.summaryNote}</p>
      </Section>

      <Section title={t.documentsTitle} intro={t.documentsIntro}>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [t.stored, String(data.documents.stored)],
            [t.storedSize, bytes(data.documents.storedBytes)],
            [t.deleted, String(data.documents.deleted)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border bg-surface-2 px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums">
                {value}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t.retentionTitle}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[16rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{t.dataLocation}</dt>
          <dd className="font-medium">
            {data.retention.dataLocation ?? t.notConfigured}
          </dd>
          <dt className="text-muted-foreground">{t.retentionAfter}</dt>
          <dd className="font-medium">
            {days(data.retention.daysAfterTermination)}
          </dd>
          <dt className="text-muted-foreground">{t.exportAfter}</dt>
          <dd className="font-medium">
            {days(data.retention.exportDaysAfterTermination)}
          </dd>
        </dl>
        <p className="text-xs text-muted-foreground">{t.retentionNote}</p>
      </Section>

      <Section title={t.subprocessorsTitle} intro={t.subprocessorsIntro}>
        {data.subprocessors.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            {t.noSubprocessors}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="bg-surface-2 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t.subprocessorName}
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t.subprocessorPurpose}
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold">
                      {t.subprocessorLocation}
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.subprocessors.map((s) => (
                    <tr key={`${s.source}-${s.name}`}>
                      <td className="px-3 py-2.5 font-medium">{s.name}</td>
                      <td className="px-3 py-2.5">{s.purpose}</td>
                      <td className="px-3 py-2.5">{s.location}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge tone={s.source === "OCR" ? "violet" : "gray"}>
                          {s.source === "OCR" ? t.sourceOcr : t.sourcePlatform}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <Section title={t.exportTitle} intro={t.exportIntro}>
        {data.canExport ? (
          <Button asChild>
            <a href="/api/privacy/export" download>
              <Download aria-hidden="true" />
              <span>{t.exportButton}</span>
            </a>
          </Button>
        ) : (
          <Notice tone="info">{t.exportOwnerOnly}</Notice>
        )}
      </Section>

      <TerminationSection locale={locale} />
    </div>
  );
}
