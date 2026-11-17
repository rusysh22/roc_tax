-- CreateEnum
CREATE TYPE "TaxRuleStatus" AS ENUM ('DRAFT', 'SME_APPROVED', 'NON_PRODUCTION_TEST', 'RETIRED');

-- CreateEnum
CREATE TYPE "TaxRoundingMode" AS ENUM ('HALF_UP', 'FLOOR', 'CEIL');

-- CreateEnum
CREATE TYPE "SegregationPolicy" AS ENUM ('STRICT_SEPARATION', 'SOLE_USER_EXCEPTION');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "lastReviewedBy" TEXT,
ADD COLUMN     "lastSubmittedBy" TEXT;

-- CreateTable
CREATE TABLE "TaxRule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "taxFamily" "TaxFamily" NOT NULL,
    "documentType" "TransactionDocumentType" NOT NULL,
    "objectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'ID',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "rateNumerator" INTEGER NOT NULL,
    "rateDenominator" INTEGER NOT NULL,
    "roundingMode" "TaxRoundingMode" NOT NULL DEFAULT 'HALF_UP',
    "requireCounterpartyIdentity" BOOLEAN NOT NULL DEFAULT true,
    "requirePayrollEvidence" BOOLEAN NOT NULL DEFAULT false,
    "requireTreatyEvidence" BOOLEAN NOT NULL DEFAULT false,
    "sourceCitation" TEXT NOT NULL,
    "catalogStatus" "TaxRuleStatus" NOT NULL DEFAULT 'DRAFT',
    "smeReviewedBy" TEXT,
    "smeReviewedAt" TIMESTAMPTZ(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationTaxPolicy" (
    "organizationId" TEXT NOT NULL,
    "segregationPolicy" "SegregationPolicy" NOT NULL DEFAULT 'STRICT_SEPARATION',
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrganizationTaxPolicy_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "TransactionTaxInput" (
    "transactionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "objectCode" TEXT,
    "payrollEvidenceRef" TEXT,
    "treatyCertificateRef" TEXT,
    "treatyCountryCode" CHAR(2),
    "smeOverrideNote" TEXT,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TransactionTaxInput_pkey" PRIMARY KEY ("transactionId")
);

-- CreateTable
CREATE TABLE "TaxEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionVersion" INTEGER NOT NULL,
    "ruleId" TEXT,
    "ruleCode" TEXT,
    "ruleVersion" INTEGER,
    "catalogStatus" "TaxRuleStatus",
    "taxFamily" "TaxFamily" NOT NULL,
    "objectCode" TEXT,
    "dppAmount" DECIMAL(20,2) NOT NULL,
    "taxAmount" DECIMAL(20,2) NOT NULL,
    "rateNumerator" INTEGER NOT NULL DEFAULT 0,
    "rateDenominator" INTEGER NOT NULL DEFAULT 1,
    "roundingMode" "TaxRoundingMode" NOT NULL DEFAULT 'HALF_UP',
    "blockers" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "evaluatedBy" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxEvaluationSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "transactionVersion" INTEGER NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "sourceCitation" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "taxFamily" "TaxFamily" NOT NULL,
    "objectCode" TEXT NOT NULL,
    "dppAmount" DECIMAL(20,2) NOT NULL,
    "taxAmount" DECIMAL(20,2) NOT NULL,
    "rateNumerator" INTEGER NOT NULL,
    "rateDenominator" INTEGER NOT NULL,
    "roundingMode" "TaxRoundingMode" NOT NULL,
    "evidence" JSONB NOT NULL,
    "segregationPolicy" "SegregationPolicy" NOT NULL,
    "soleUserExceptionUsed" BOOLEAN NOT NULL DEFAULT false,
    "submittedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxEvaluationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxRule_taxFamily_catalogStatus_effectiveFrom_idx" ON "TaxRule"("taxFamily", "catalogStatus", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRule_code_version_key" ON "TaxRule"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTaxInput_transactionId_organizationId_key" ON "TransactionTaxInput"("transactionId", "organizationId");

-- CreateIndex
CREATE INDEX "TaxEvaluation_transactionId_evaluatedAt_idx" ON "TaxEvaluation"("transactionId", "evaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxEvaluation_id_organizationId_key" ON "TaxEvaluation"("id", "organizationId");

-- CreateIndex
CREATE INDEX "TaxEvaluationSnapshot_transactionId_approvedAt_idx" ON "TaxEvaluationSnapshot"("transactionId", "approvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaxEvaluationSnapshot_id_organizationId_key" ON "TaxEvaluationSnapshot"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationTaxPolicy" ADD CONSTRAINT "OrganizationTaxPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionTaxInput" ADD CONSTRAINT "TransactionTaxInput_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluation" ADD CONSTRAINT "TaxEvaluation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluation" ADD CONSTRAINT "TaxEvaluation_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluation" ADD CONSTRAINT "TaxEvaluation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluationSnapshot" ADD CONSTRAINT "TaxEvaluationSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluationSnapshot" ADD CONSTRAINT "TaxEvaluationSnapshot_transactionId_organizationId_fkey" FOREIGN KEY ("transactionId", "organizationId") REFERENCES "Transaction"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluationSnapshot" ADD CONSTRAINT "TaxEvaluationSnapshot_evaluationId_organizationId_fkey" FOREIGN KEY ("evaluationId", "organizationId") REFERENCES "TaxEvaluation"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxEvaluationSnapshot" ADD CONSTRAINT "TaxEvaluationSnapshot_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "TaxRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Batch 07 invariants and append-only audit/snapshot immutability.
ALTER TABLE "TaxRule" ADD CONSTRAINT "tax_rule_rate_bounds" CHECK ("version" >= 1 AND "rateNumerator" >= 0 AND "rateDenominator" > 0 AND "rateNumerator" <= "rateDenominator");
ALTER TABLE "TaxRule" ADD CONSTRAINT "tax_rule_effective_range" CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");
ALTER TABLE "TaxEvaluation" ADD CONSTRAINT "tax_evaluation_bounds" CHECK ("dppAmount" >= 0 AND "taxAmount" >= 0 AND "rateDenominator" > 0);
ALTER TABLE "TaxEvaluationSnapshot" ADD CONSTRAINT "tax_snapshot_bounds" CHECK ("dppAmount" >= 0 AND "taxAmount" >= 0 AND "rateDenominator" > 0);

CREATE TRIGGER tax_evaluation_immutable BEFORE UPDATE ON "TaxEvaluation" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
CREATE TRIGGER tax_snapshot_immutable BEFORE UPDATE ON "TaxEvaluationSnapshot" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();