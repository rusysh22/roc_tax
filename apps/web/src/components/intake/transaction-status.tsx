import type { Locale } from "@/i18n/messages";
import { intakeMessages } from "@/i18n/intake";
import type { TransactionStatus } from "@/lib/intake/state";
import { Badge } from "@/components/ui/status";

/** Monochrome status pill; weight and fill encode workflow progress. */
export function TransactionStatusBadge({
  status,
  locale,
}: {
  status: TransactionStatus;
  locale: Locale;
}) {
  const label = intakeMessages[locale].statuses[status];
  switch (status) {
    case "APPROVED":
    case "EXPORTED":
    case "CORETAX_ACCEPTED":
      return (
        <Badge tone="solid" dot>
          {label}
        </Badge>
      );
    case "VALIDATED":
    case "SUBMITTED":
      return (
        <Badge tone="neutral" dot>
          {label}
        </Badge>
      );
    case "NEEDS_REVIEW":
    case "CHANGES_REQUESTED":
    case "CORETAX_REJECTED":
      return (
        <Badge tone="muted" dot>
          {label}
        </Badge>
      );
    case "VOIDED":
      return (
        <Badge tone="muted" className="line-through">
          {label}
        </Badge>
      );
    default:
      return <Badge tone="outline">{label}</Badge>;
  }
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
