-- Sales-led registration and per-invoice offers.
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'REJECTED');
CREATE TYPE "PricingModel" AS ENUM ('SUBSCRIPTION', 'PER_INVOICE');

CREATE TABLE "SalesLead" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "picName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "npwpCipher" TEXT,
    "npwpHint" VARCHAR(4),
    "estimatedMonthlyInvoices" INTEGER,
    "message" TEXT NOT NULL DEFAULT '',
    "locale" VARCHAR(2) NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "requesterHash" CHAR(64) NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");
CREATE INDEX "SalesLead_requesterHash_createdAt_idx" ON "SalesLead"("requesterHash", "createdAt");

CREATE TABLE "OrganizationOffer" (
    "organizationId" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'SUBSCRIPTION',
    "pricePerInvoiceIdr" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "minimumMonthlyIdr" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "monthlyInvoiceCap" INTEGER,
    "offerReference" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "OrganizationOffer_pkey" PRIMARY KEY ("organizationId")
);
ALTER TABLE "OrganizationOffer" ADD CONSTRAINT "OrganizationOffer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
