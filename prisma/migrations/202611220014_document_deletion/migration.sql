-- Customer document deletion (tombstone keeps name/size/SHA-256 for audit).
ALTER TABLE "SourceDocument" ADD COLUMN "deletedAt" TIMESTAMPTZ(3);
ALTER TABLE "SourceDocument" ADD COLUMN "deletedBy" TEXT;
-- Duplicate prevention moves to the application (live documents only) so a
-- deleted file can be uploaded again.
DROP INDEX IF EXISTS "SourceDocument_transactionId_sha256_key";
CREATE INDEX "SourceDocument_transactionId_sha256_idx" ON "SourceDocument"("transactionId", "sha256");
