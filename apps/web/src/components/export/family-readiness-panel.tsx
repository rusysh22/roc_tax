"use client";
import { Check, Minus } from "lucide-react";
import type { Locale } from "@/i18n/messages";
import { codeEntry, codeLabel } from "@/i18n/codes";
import { exportMessages } from "@/i18n/exports";
import { viewMessages } from "@/i18n/views";
import {
  readinessGates,
  type FamilyReadiness,
} from "@/lib/export/family-readiness";
import { Badge } from "@/components/ui/status";
import { InfoTip } from "@/components/ui/tooltip";

/**
 * Per-family export readiness checklist: shows which of the six gates
 * (official template … SME rules) are met, so it is clear why PPN and other
 * families are still blocked and what is needed to open them.
 */
export function FamilyReadinessPanel({
  locale,
  readiness,
}: {
  locale: Locale;
  readiness: FamilyReadiness[];
}) {
  const t = exportMessages[locale];
  const v = viewMessages[locale];
  return (
    <section className="space-y-2 rounded-xl border bg-surface p-4 shadow-xs">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold">{t.readinessTitle}</h2>
        <p className="text-xs text-muted-foreground">{t.readinessIntro}</p>
      </div>
      <div className="scroll-thin overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-surface-2 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-semibold">
                {t.familyLabel}
              </th>
              {readinessGates.map((gate) => {
                const entry = codeEntry(locale, "readinessGate", gate);
                return (
                  <th
                    key={gate}
                    className="px-2 py-2 text-center font-semibold"
                  >
                    <span className="inline-flex items-center gap-1">
                      {entry.label}
                      <InfoTip
                        functional={entry.help}
                        technical={gate}
                        label={v.information}
                        technicalLabel={v.technicalName}
                      />
                    </span>
                  </th>
                );
              })}
              <th className="px-3 py-2 text-right font-semibold">{v.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {readiness.map((row) => (
              <tr key={row.taxFamily}>
                <td className="px-3 py-2 font-medium">
                  {codeLabel(locale, "taxFamily", row.taxFamily)}
                </td>
                {readinessGates.map((gate) => (
                  <td key={gate} className="px-2 py-2 text-center">
                    {row.gates[gate] ? (
                      <Check
                        aria-label={t.readinessMet}
                        className="mx-auto size-4 text-success"
                      />
                    ) : (
                      <Minus
                        aria-label={t.readinessMissing}
                        className="mx-auto size-4 text-subtle-foreground"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Badge tone={row.ready ? "green" : "red"} dot>
                    {row.ready ? t.readinessReady : t.readinessBlocked}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
