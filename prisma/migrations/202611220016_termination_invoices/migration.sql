-- Subscription termination lifecycle, automatic document purge, invoices.
CREATE TYPE "TerminationStatus" AS ENUM ('REQUESTED', 'CANCELLED', 'TERMINATED', 'PURGED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

ALTER TABLE "OrganizationOffer" ADD COLUMN "vatRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "OrganizationOffer" ADD COLUMN "paymentTermDays" INTEGER NOT NULL DEFAULT 14;

CREATE TABLE "WorkspaceTermination" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" "TerminationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL,
    "effectiveAt" TIMESTAMPTZ(3) NOT NULL,
    "terminatedAt" TIMESTAMPTZ(3),
    "purgeAfter" TIMESTAMPTZ(3),
    "purgedAt" TIMESTAMPTZ(3),
    "purgedDocuments" INTEGER NOT NULL DEFAULT 0,
    "purgedExports" INTEGER NOT NULL DEFAULT 0,
    "cancelledBy" TEXT,
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceTermination_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceTermination_organizationId_status_idx" ON "WorkspaceTermination"("organizationId", "status");
CREATE INDEX "WorkspaceTermination_status_effectiveAt_idx" ON "WorkspaceTermination"("status", "effectiveAt");
CREATE INDEX "WorkspaceTermination_status_purgeAfter_idx" ON "WorkspaceTermination"("status", "purgeAfter");
ALTER TABLE "WorkspaceTermination" ADD CONSTRAINT "WorkspaceTermination_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "period" CHAR(7) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceCount" INTEGER NOT NULL,
    "pricePerInvoiceIdr" DECIMAL(20,2) NOT NULL,
    "minimumMonthlyIdr" DECIMAL(20,2) NOT NULL,
    "subtotalIdr" DECIMAL(20,2) NOT NULL,
    "vatRatePercent" DECIMAL(5,2) NOT NULL,
    "vatIdr" DECIMAL(20,2) NOT NULL,
    "totalIdr" DECIMAL(20,2) NOT NULL,
    "offerReference" TEXT NOT NULL,
    "sellerSnapshot" JSONB NOT NULL,
    "buyerSnapshot" JSONB NOT NULL,
    "paymentLink" TEXT,
    "issuedAt" TIMESTAMPTZ(3),
    "dueAt" TIMESTAMPTZ(3),
    "paidAt" TIMESTAMPTZ(3),
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "voidReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingInvoice_number_key" ON "BillingInvoice"("number");
CREATE INDEX "BillingInvoice_organizationId_period_idx" ON "BillingInvoice"("organizationId", "period");
CREATE INDEX "BillingInvoice_status_dueAt_idx" ON "BillingInvoice"("status", "dueAt");
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
