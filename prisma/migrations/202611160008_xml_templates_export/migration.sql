-- CreateEnum
CREATE TYPE "XmlTemplateStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'RETIRED');

-- CreateEnum
CREATE TYPE "CoretaxOutcomeStatus" AS ENUM ('CORETAX_ACCEPTED', 'CORETAX_REJECTED');

-- AlterTable
ALTER TABLE "TransactionTaxInput"
ADD COLUMN "recipientTku" TEXT,
ADD COLUMN "taxCertificate" TEXT NOT NULL DEFAULT 'N/A',
ADD COLUMN "referenceDocType" TEXT NOT NULL DEFAULT 'CommercialInvoice',
ADD COLUMN "govTreasurerOpt" TEXT NOT NULL DEFAULT 'N/A',
ADD COLUMN "sp2dNumber" TEXT,
ADD COLUMN "withholdingDate" DATE;

-- CreateTable
CREATE TABLE "XmlTemplate" (
    "id" TEXT NOT NULL,
    "taxFamily" "TaxFamily" NOT NULL,
    "versionTag" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "sourcePublishedAt" TIMESTAMPTZ(3),
    "sourceSha256" CHAR(64) NOT NULL,
    "referenceUrl" TEXT,
    "referenceSha256" CHAR(64),
    "xsdSchemaHash" CHAR(64) NOT NULL,
    "status" "XmlTemplateStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "fixtureVerified" BOOLEAN NOT NULL DEFAULT false,
    "mappingSpec" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "XmlTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XmlExportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "taxFamily" "TaxFamily" NOT NULL,
    "taxPeriod" CHAR(7) NOT NULL,
    "templateVersionTag" TEXT NOT NULL,
    "sourceSha256" CHAR(64) NOT NULL,
    "exportVersion" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "xmlSha256" CHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "totalDppAmount" DECIMAL(20,2) NOT NULL,
    "totalTaxAmount" DECIMAL(20,2) NOT NULL,
    "exportedBy" TEXT NOT NULL,
    "exportedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XmlExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XmlExportItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "transactionVersion" INTEGER NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "taxObjectCode" TEXT NOT NULL,
    "dppAmount" DECIMAL(20,2) NOT NULL,
    "taxAmount" DECIMAL(20,2) NOT NULL,
    "ratePercent" TEXT NOT NULL,
    "payloadMeta" JSONB NOT NULL,

    CONSTRAINT "XmlExportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XmlExportOutcome" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "outcome" "CoretaxOutcomeStatus" NOT NULL,
    "coretaxReference" TEXT,
    "notes" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XmlExportOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XmlTemplate_taxFamily_status_idx" ON "XmlTemplate"("taxFamily", "status");

-- CreateIndex
CREATE UNIQUE INDEX "XmlTemplate_taxFamily_versionTag_key" ON "XmlTemplate"("taxFamily", "versionTag");

-- CreateIndex
CREATE UNIQUE INDEX "XmlExportBatch_storageKey_key" ON "XmlExportBatch"("storageKey");

-- CreateIndex
CREATE INDEX "XmlExportBatch_organizationId_exportedAt_idx" ON "XmlExportBatch"("organizationId", "exportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "XmlExportBatch_id_organizationId_key" ON "XmlExportBatch"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "XmlExportBatch_organizationId_idempotencyKey_key" ON "XmlExportBatch"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "XmlExportBatch_organizationId_companyId_taxFamily_taxPeriod_exportVersion_key" ON "XmlExportBatch"("organizationId", "companyId", "taxFamily", "taxPeriod", "exportVersion");

-- CreateIndex
CREATE INDEX "XmlExportItem_transactionId_idx" ON "XmlExportItem"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "XmlExportItem_batchId_transactionId_key" ON "XmlExportItem"("batchId", "transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "XmlExportItem_batchId_sequenceNo_key" ON "XmlExportItem"("batchId", "sequenceNo");

-- CreateIndex
CREATE INDEX "XmlExportOutcome_batchId_recordedAt_idx" ON "XmlExportOutcome"("batchId", "recordedAt");

-- AddForeignKey
ALTER TABLE "XmlExportBatch" ADD CONSTRAINT "XmlExportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportBatch" ADD CONSTRAINT "XmlExportBatch_companyId_organizationId_fkey" FOREIGN KEY ("companyId", "organizationId") REFERENCES "Company"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportBatch" ADD CONSTRAINT "XmlExportBatch_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "XmlTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportItem" ADD CONSTRAINT "XmlExportItem_batchId_organizationId_fkey" FOREIGN KEY ("batchId", "organizationId") REFERENCES "XmlExportBatch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportItem" ADD CONSTRAINT "XmlExportItem_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportItem" ADD CONSTRAINT "XmlExportItem_snapshotId_organizationId_fkey" FOREIGN KEY ("snapshotId", "organizationId") REFERENCES "TaxEvaluationSnapshot"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportOutcome" ADD CONSTRAINT "XmlExportOutcome_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlExportOutcome" ADD CONSTRAINT "XmlExportOutcome_batchId_organizationId_fkey" FOREIGN KEY ("batchId", "organizationId") REFERENCES "XmlExportBatch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Batch 08 invariants and immutable XML export history.
ALTER TABLE "XmlTemplate" ADD CONSTRAINT "xml_template_sha_bounds" CHECK (char_length("sourceSha256") = 64 AND char_length("xsdSchemaHash") = 64);
ALTER TABLE "XmlExportBatch" ADD CONSTRAINT "xml_export_batch_bounds" CHECK ("exportVersion" > 0 AND "itemCount" > 0 AND "sizeBytes" > 0 AND "totalDppAmount" > 0 AND "totalTaxAmount" >= 0);
ALTER TABLE "XmlExportItem" ADD CONSTRAINT "xml_export_item_bounds" CHECK ("sequenceNo" > 0 AND "dppAmount" > 0 AND "taxAmount" >= 0);

CREATE TRIGGER xml_export_batch_immutable BEFORE UPDATE ON "XmlExportBatch" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
CREATE TRIGGER xml_export_item_immutable BEFORE UPDATE ON "XmlExportItem" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
CREATE TRIGGER xml_export_outcome_immutable BEFORE UPDATE ON "XmlExportOutcome" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();

-- Seed ONLY the source-verified official DJP BPPU v.3 template metadata downloaded from pajak.go.id.
-- No unverified statutory tax rules are seeded; production approval still requires SME-approved rules.
INSERT INTO "XmlTemplate" (
    "id",
    "taxFamily",
    "versionTag",
    "sourceUrl",
    "sourceLabel",
    "sourcePublishedAt",
    "sourceSha256",
    "referenceUrl",
    "referenceSha256",
    "xsdSchemaHash",
    "status",
    "fixtureVerified",
    "mappingSpec",
    "notes",
    "verifiedBy",
    "verifiedAt",
    "createdBy",
    "createdAt",
    "updatedAt"
) VALUES (
    'tpl_bppu_v3_2025_09',
    'PPH_UNIFIKASI_BPPU',
    'BPPU-v3-2025-09',
    'https://pajak.go.id/sites/default/files/2025-09/BPPU%20Excel%20to%20XML%20v.3.xlsx',
    'DJP Coretax BPPU Excel to XML v.3 & official bppu.zip sample',
    '2025-09-04T04:32:24.000Z',
    'b59813365bccdf9d63a47051d4d2b0b58c53351b8c981a6f33144be05b429089',
    'https://pajak.go.id/sites/default/files/2024-12/bppu.zip',
    '8a90ea38737bd8d5f0563c12c11ec076b91138f0865ac9f46fd0d4414b004deb',
    '9ccf6e1b0f36cb0936d0ad5e8725bfeb0bbd61e2174553162b3c8c7c4a1019d7',
    'VERIFIED',
    true,
    '{"catalogPage":"https://pajak.go.id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml","rootElement":"BpuBulk","schemaId":"Schema3","mapName":"BpuBulk_Map","sampleXmlSha256":"bd52881b465315072fe3820f3f63b38b6e966d72e7da22ec94afcac1b55635e5","elementOrder":["TaxPeriodMonth","TaxPeriodYear","CounterpartTin","IDPlaceOfBusinessActivityOfIncomeRecipient","TaxCertificate","TaxObjectCode","TaxBase","Rate","Document","DocumentNumber","DocumentDate","IDPlaceOfBusinessActivity","GovTreasurerOpt","SP2DNumber","WithholdingDate"],"encoding":"UTF-8"}'::jsonb,
    'Derived directly from xl/xmlMaps.xml (Schema3) inside BPPU Excel to XML v.3.xlsx and verified against bppu.xml.',
    'system:djp-source-verified-2026-11-17',
    '2026-11-17T00:00:00.000Z',
    'system:djp-source-verified-2026-11-17',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
