-- CreateEnum
CREATE TYPE "CounterpartyKind" AS ENUM ('VENDOR', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "TaxIdentityType" AS ENUM ('NPWP', 'NIK', 'FOREIGN_TIN', 'NONE');

-- CreateEnum
CREATE TYPE "TaxFamily" AS ENUM ('UNCLASSIFIED', 'PPN_FAKTUR_KELUARAN', 'PPH_UNIFIKASI_BPPU', 'PPH_UNIFIKASI_BPNR', 'PPH21_BP21', 'PPH21_BPMP', 'PPH21_BPA1', 'PPH21_BPA2', 'PPH26_BP26');

-- CreateEnum
CREATE TYPE "TransactionDocumentType" AS ENUM ('SUPPLIER_INVOICE', 'SALES_INVOICE');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('MANUAL', 'SPREADSHEET', 'OCR', 'ERP');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'EXTRACTING', 'NEEDS_REVIEW', 'VALIDATED', 'SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'EXPORTED', 'CORETAX_ACCEPTED', 'CORETAX_REJECTED', 'VOIDED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "npwpCipher" TEXT,
    "npwpIndex" TEXT,
    "npwpHint" VARCHAR(4),
    "nitkuCipher" TEXT,
    "nitkuIndex" TEXT,
    "nitkuHint" VARCHAR(4),
    "address" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counterparty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "CounterpartyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "identityType" "TaxIdentityType" NOT NULL,
    "identityCipher" TEXT,
    "identityIndex" TEXT,
    "identityHint" VARCHAR(4),
    "countryCode" CHAR(2) NOT NULL,
    "address" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "taxFamily" "TaxFamily" NOT NULL,
    "documentType" "TransactionDocumentType" NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceNumber" TEXT NOT NULL,
    "invoiceNumberNormalized" TEXT NOT NULL,
    "documentDate" DATE NOT NULL,
    "taxPeriod" CHAR(7) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "description" TEXT,
    "totalAmount" DECIMAL(20,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "voidedAt" TIMESTAMPTZ(3),
    "voidReason" TEXT,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLine" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(20,2) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,

    CONSTRAINT "TransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "scanStatus" TEXT NOT NULL DEFAULT 'NOT_SCANNED',
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionComment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Company_organizationId_npwpIndex_idx" ON "Company"("organizationId", "npwpIndex");

-- CreateIndex
CREATE UNIQUE INDEX "Company_id_organizationId_key" ON "Company"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_nitkuIndex_key" ON "Company"("organizationId", "nitkuIndex");

-- CreateIndex
CREATE INDEX "Counterparty_organizationId_nameNormalized_idx" ON "Counterparty"("organizationId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_id_organizationId_key" ON "Counterparty"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Counterparty_organizationId_identityType_identityIndex_key" ON "Counterparty"("organizationId", "identityType", "identityIndex");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_createdAt_idx" ON "Transaction"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_organizationId_invoiceNumberNormalized_idx" ON "Transaction"("organizationId", "invoiceNumberNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_id_organizationId_key" ON "Transaction"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionLine_transactionId_position_key" ON "TransactionLine"("transactionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_storageKey_key" ON "SourceDocument"("storageKey");

-- CreateIndex
CREATE INDEX "SourceDocument_organizationId_idx" ON "SourceDocument"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_transactionId_sha256_key" ON "SourceDocument"("transactionId", "sha256");

-- CreateIndex
CREATE INDEX "TransactionComment_transactionId_createdAt_idx" ON "TransactionComment"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionEvent_transactionId_createdAt_idx" ON "TransactionEvent"("transactionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counterparty" ADD CONSTRAINT "Counterparty_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_organizationId_fkey" FOREIGN KEY ("companyId", "organizationId") REFERENCES "Company"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_counterpartyId_organizationId_fkey" FOREIGN KEY ("counterpartyId", "organizationId") REFERENCES "Counterparty"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLine" ADD CONSTRAINT "TransactionLine_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionComment" ADD CONSTRAINT "TransactionComment_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionEvent" ADD CONSTRAINT "TransactionEvent_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Additional Batch 04 database invariants and append-only audit triggers.
ALTER TABLE "Transaction" ADD CONSTRAINT "transaction_total_non_negative" CHECK ("totalAmount" >= 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "transaction_version_positive" CHECK ("version" >= 1);
ALTER TABLE "Transaction" ADD CONSTRAINT "transaction_tax_period_format" CHECK ("taxPeriod" ~ '^\d{4}-(0[1-9]|1[0-2])$');
ALTER TABLE "TransactionLine" ADD CONSTRAINT "transaction_line_position_positive" CHECK ("position" >= 1);
ALTER TABLE "TransactionLine" ADD CONSTRAINT "transaction_line_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "TransactionLine" ADD CONSTRAINT "transaction_line_unit_price_non_negative" CHECK ("unitPrice" >= 0);
ALTER TABLE "TransactionLine" ADD CONSTRAINT "transaction_line_amount_non_negative" CHECK ("amount" >= 0);
ALTER TABLE "SourceDocument" ADD CONSTRAINT "source_document_size_bounds" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760);

CREATE FUNCTION prevent_intake_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Transaction events and comments are append-only';
END;
$$;
CREATE TRIGGER transaction_event_immutable BEFORE UPDATE ON "TransactionEvent" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
CREATE TRIGGER transaction_comment_immutable BEFORE UPDATE ON "TransactionComment" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
