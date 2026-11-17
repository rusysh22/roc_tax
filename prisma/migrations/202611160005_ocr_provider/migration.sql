-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('NONE', 'SUPERADMIN');

-- CreateEnum
CREATE TYPE "OcrAdapterKey" AS ENUM ('NONE', 'SYNTHETIC_TEST', 'EXTERNAL_NOT_CONFIGURED');

-- CreateEnum
CREATE TYPE "OcrJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'DEAD_LETTER', 'CANCELLED');

-- CreateTable
CREATE TABLE "OcrProviderConfig" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "adapterKey" "OcrAdapterKey" NOT NULL,
    "endpointUrl" TEXT,
    "secretRef" TEXT,
    "model" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "maxPages" INTEGER NOT NULL DEFAULT 10,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "monthlyPageCap" INTEGER NOT NULL DEFAULT 500,
    "monthlySpendCapIdr" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "estimatedCostPerPageIdr" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "retentionPolicy" TEXT NOT NULL DEFAULT 'ZERO_RETENTION_REQUIRED',
    "processorNotice" TEXT NOT NULL DEFAULT '',
    "vendorApproved" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OcrProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationOcrSetting" (
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT,
    "externalAiConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentedBy" TEXT,
    "consentedAt" TIMESTAMPTZ(3),
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrganizationOcrSetting_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "OcrJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerSlug" TEXT NOT NULL,
    "adapterKey" "OcrAdapterKey" NOT NULL,
    "model" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "status" "OcrJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "estimatedCostIdr" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OcrJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrCandidate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "providerSlug" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "providerVersion" TEXT NOT NULL,
    "extractedFields" JSONB NOT NULL,
    "appliedFields" JSONB,
    "promptInjectionDetected" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OcrProviderConfig_slug_key" ON "OcrProviderConfig"("slug");

-- CreateIndex
CREATE INDEX "OcrJob_status_nextRunAt_idx" ON "OcrJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "OcrJob_organizationId_createdAt_idx" ON "OcrJob"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "OcrJob_transactionId_createdAt_idx" ON "OcrJob"("transactionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OcrJob_id_organizationId_key" ON "OcrJob"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrCandidate_jobId_key" ON "OcrCandidate"("jobId");

-- CreateIndex
CREATE INDEX "OcrCandidate_transactionId_createdAt_idx" ON "OcrCandidate"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "OcrCandidate_organizationId_idx" ON "OcrCandidate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OcrCandidate_jobId_organizationId_key" ON "OcrCandidate"("jobId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_id_organizationId_key" ON "SourceDocument"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationOcrSetting" ADD CONSTRAINT "OrganizationOcrSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationOcrSetting" ADD CONSTRAINT "OrganizationOcrSetting_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "OcrProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_documentId_organizationId_fkey" FOREIGN KEY ("documentId", "organizationId") REFERENCES "SourceDocument"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "OcrProviderConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrCandidate" ADD CONSTRAINT "OcrCandidate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrCandidate" ADD CONSTRAINT "OcrCandidate_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrCandidate" ADD CONSTRAINT "OcrCandidate_documentId_organizationId_fkey" FOREIGN KEY ("documentId", "organizationId") REFERENCES "SourceDocument"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrCandidate" ADD CONSTRAINT "OcrCandidate_jobId_organizationId_fkey" FOREIGN KEY ("jobId", "organizationId") REFERENCES "OcrJob"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Batch 06 invariants: bounds, spend limits, and single active job per document.
ALTER TABLE "OcrProviderConfig" ADD CONSTRAINT "ocr_provider_bounds" CHECK ("maxPages" BETWEEN 1 AND 100 AND "timeoutMs" BETWEEN 1000 AND 60000 AND "monthlyPageCap" >= 0 AND "monthlySpendCapIdr" >= 0 AND "estimatedCostPerPageIdr" >= 0);
ALTER TABLE "OcrJob" ADD CONSTRAINT "ocr_job_bounds" CHECK ("attemptCount" >= 0 AND "maxAttempts" BETWEEN 1 AND 5 AND "pageCount" >= 1 AND "estimatedCostIdr" >= 0);
CREATE UNIQUE INDEX "OcrJob_active_document_key" ON "OcrJob"("transactionId", "documentId") WHERE "status" IN ('QUEUED', 'RUNNING', 'FAILED_RETRYABLE');