// Transaction status machine. Status names follow PRD FR-005; renaming requires a migration.
export const transactionStatuses = [
  "DRAFT",
  "EXTRACTING",
  "NEEDS_REVIEW",
  "VALIDATED",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "APPROVED",
  "EXPORTED",
  "CORETAX_ACCEPTED",
  "CORETAX_REJECTED",
  "VOIDED",
] as const;
export type TransactionStatus = (typeof transactionStatuses)[number];

/**
 * Planned transition graph. Batch 04 only executes edit/void/attach/comment on
 * pre-review drafts; review, approval, export and Coretax result transitions
 * are owned by later batches and must reuse this table.
 */
export const plannedTransitions: Record<
  TransactionStatus,
  readonly TransactionStatus[]
> = {
  DRAFT: ["EXTRACTING", "NEEDS_REVIEW", "VALIDATED", "VOIDED"],
  EXTRACTING: ["NEEDS_REVIEW", "DRAFT"],
  NEEDS_REVIEW: ["DRAFT", "VALIDATED", "VOIDED"],
  VALIDATED: ["SUBMITTED", "DRAFT", "VOIDED"],
  SUBMITTED: ["CHANGES_REQUESTED", "APPROVED"],
  CHANGES_REQUESTED: ["DRAFT", "VALIDATED", "VOIDED"],
  APPROVED: ["EXPORTED", "CHANGES_REQUESTED"],
  EXPORTED: ["CORETAX_ACCEPTED", "CORETAX_REJECTED"],
  CORETAX_ACCEPTED: [],
  CORETAX_REJECTED: ["CHANGES_REQUESTED"],
  VOIDED: [],
};

export type TransactionAction = "edit" | "void" | "attach" | "comment";
const actionStatuses: Record<TransactionAction, readonly TransactionStatus[]> =
  {
    edit: ["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"],
    attach: ["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"],
    void: ["DRAFT", "NEEDS_REVIEW", "CHANGES_REQUESTED"],
    comment: transactionStatuses.filter((status) => status !== "VOIDED"),
  };

export function allows(status: TransactionStatus, action: TransactionAction) {
  return actionStatuses[action].includes(status);
}

export function canTransition(from: TransactionStatus, to: TransactionStatus) {
  return plannedTransitions[from].includes(to);
}
