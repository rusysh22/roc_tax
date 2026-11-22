-- Counterparties can be archived (hidden from new selections, history kept).
ALTER TABLE "Counterparty" ADD COLUMN "archivedAt" TIMESTAMPTZ(3);
