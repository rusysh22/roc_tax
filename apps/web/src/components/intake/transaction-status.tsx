import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import type { TransactionStatus } from "@/lib/intake/state";
import { CodeBadge } from "@/components/ui/code-badge";

/** Coloured status badge from the code registry (label + info tip). */
export function TransactionStatusBadge({
  status,
}: {
  status: TransactionStatus;
  locale?: Locale;
}) {
  return (
    <CodeBadge
      domain="transactionStatus"
      code={status}
      className={status === "VOIDED" ? "line-through" : undefined}
    />
  );
}

/** Main workflow pipeline shown in the transaction status bar. */
export function transactionSteps(locale: Locale, current: TransactionStatus) {
  const t = intakeMessages[locale].statuses;
  const first: TransactionStatus = [
    "NEEDS_REVIEW",
    "CHANGES_REQUESTED",
    "EXTRACTING",
  ].includes(current)
    ? current
    : "DRAFT";
  const last: TransactionStatus =
    current === "CORETAX_REJECTED" ? "CORETAX_REJECTED" : "CORETAX_ACCEPTED";
  return (
    [first, "VALIDATED", "SUBMITTED", "APPROVED", "EXPORTED", last] as const
  ).map((id) => ({ id, label: t[id] }));
}
