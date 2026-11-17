-- CreateEnum
CREATE TYPE "ImportFormat" AS ENUM ('CSV', 'XLSX');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "importBatchId" TEXT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSha256" CHAR(64) NOT NULL,
    "format" "ImportFormat" NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "createdCount" INTEGER NOT NULL,
    "transactionIds" JSONB NOT NULL,
    "rowSummary" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_organizationId_createdAt_idx" ON "ImportBatch"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_id_organizationId_key" ON "ImportBatch"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_organizationId_idempotencyKey_key" ON "ImportBatch"("organizationId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importBatchId_organizationId_fkey" FOREIGN KEY ("importBatchId", "organizationId") REFERENCES "ImportBatch"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Batch 05 invariants and append-only batch history trigger.
ALTER TABLE "ImportBatch" ADD CONSTRAINT "import_batch_counts_non_negative" CHECK ("totalRows" >= 1 AND "validRows" >= 0 AND "invalidRows" >= 0 AND "duplicateRows" >= 0 AND "createdCount" >= 1 AND "createdCount" <= "validRows");
CREATE TRIGGER import_batch_immutable BEFORE UPDATE ON "ImportBatch" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
