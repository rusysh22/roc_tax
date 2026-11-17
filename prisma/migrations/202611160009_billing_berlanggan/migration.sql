-- CreateEnum
CREATE TYPE "BillingAdapterMode" AS ENUM ('NOT_CONFIGURED', 'SYNTHETIC_TEST', 'BERLANGGAN_LIVE');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('NOT_CONFIGURED', 'ACTIVE', 'GRACE', 'EXPIRED', 'SUSPENDED', 'REVOKED', 'INVALID', 'SEAT_FULL', 'RATE_LIMITED', 'COMPATIBILITY_BLOCKED');

-- CreateTable
CREATE TABLE "BillingConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "adapterMode" "BillingAdapterMode" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "apiBaseUrl" TEXT,
    "productSlug" TEXT,
    "storefrontUrl" TEXT,
    "productSecretRef" TEXT,
    "webhookSecretRef" TEXT,
    "ed25519PublicKey" TEXT,
    "saasLicensingApproved" BOOLEAN NOT NULL DEFAULT false,
    "compatibilityNote" TEXT NOT NULL DEFAULT '',
    "catalogSnapshot" JSONB,
    "catalogFetchedAt" TIMESTAMPTZ(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BillingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationLicense" (
    "organizationId" TEXT NOT NULL,
    "licenseKeyCipher" TEXT,
    "licenseKeyHint" VARCHAR(8),
    "licenseKeyIndex" TEXT,
    "licenseKeySha256" CHAR(64),
    "fingerprint" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "planCode" TEXT,
    "entitlements" JSONB,
    "entitlementEnvelope" JSONB,
    "entitlementSignature" TEXT,
    "tokenExpiresAt" TIMESTAMPTZ(3),
    "licenseExpiresAt" TIMESTAMPTZ(3),
    "lastValidatedAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "activatedBy" TEXT,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrganizationLicense_pkey" PRIMARY KEY ("organizationId")
);

-- CreateTable
CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "organizationId" TEXT,
    "licenseKeyHash" CHAR(64),
    "payloadHash" CHAR(64) NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "payloadSummary" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationLicense_licenseKeyIndex_idx" ON "OrganizationLicense"("licenseKeyIndex");

-- CreateIndex
CREATE INDEX "OrganizationLicense_licenseKeySha256_idx" ON "OrganizationLicense"("licenseKeySha256");

-- CreateIndex
CREATE UNIQUE INDEX "BillingWebhookEvent_eventId_key" ON "BillingWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_eventType_receivedAt_idx" ON "BillingWebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "BillingWebhookEvent_organizationId_receivedAt_idx" ON "BillingWebhookEvent"("organizationId", "receivedAt");

-- AddForeignKey
ALTER TABLE "OrganizationLicense" ADD CONSTRAINT "OrganizationLicense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only immutability on received webhook logs and default fail-closed BillingConfig row.
CREATE TRIGGER billing_webhook_event_immutable BEFORE UPDATE ON "BillingWebhookEvent" FOR EACH ROW EXECUTE FUNCTION prevent_intake_audit_mutation();

INSERT INTO "BillingConfig" ("id", "adapterMode", "saasLicensingApproved", "compatibilityNote", "createdAt", "updatedAt")
VALUES (
    'default',
    'NOT_CONFIGURED',
    false,
    'Pending Berlanggan confirmation of server-hosted multi-tenant SaaS licensing semantics (documented docs describe on-premise device fingerprint/seat licensing).',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
