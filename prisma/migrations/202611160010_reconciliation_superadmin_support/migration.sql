-- AlterEnum
ALTER TYPE "CoretaxOutcomeStatus" ADD VALUE IF NOT EXISTS 'CORETAX_SUBMITTED';

-- CreateEnum
CREATE TYPE "SupportAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "XmlExportOutcome"
ADD COLUMN "accountHint" VARCHAR(20),
ADD COLUMN "portalTimestamp" TIMESTAMPTZ(3),
ADD COLUMN "evidenceSha256" CHAR(64);

-- CreateTable
CREATE TABLE "SupportAccessGrant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "SupportAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessAudit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "accessedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportAccessAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAccessGrant_organizationId_status_expiresAt_idx" ON "SupportAccessGrant"("organizationId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportAccessAudit_organizationId_accessedAt_idx" ON "SupportAccessAudit"("organizationId", "accessedAt");

-- CreateIndex
CREATE INDEX "SupportAccessAudit_actorId_accessedAt_idx" ON "SupportAccessAudit"("actorId", "accessedAt");

-- AddForeignKey
ALTER TABLE "SupportAccessGrant" ADD CONSTRAINT "SupportAccessGrant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessAudit" ADD CONSTRAINT "SupportAccessAudit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportAccessAudit" ADD CONSTRAINT "SupportAccessAudit_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "SupportAccessGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutable append-only protection on SupportAccessAudit.
CREATE TRIGGER support_access_audit_immutable BEFORE UPDATE ON "SupportAccessAudit" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();
