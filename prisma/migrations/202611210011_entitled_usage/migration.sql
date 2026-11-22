-- CreateTable
CREATE TABLE "EntitledUsage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "planCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EntitledUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntitledUsage_transactionId_key" ON "EntitledUsage"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "EntitledUsage_organizationId_idempotencyKey_key" ON "EntitledUsage"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "EntitledUsage_organizationId_createdAt_idx" ON "EntitledUsage"("organizationId", "createdAt");

-- Receipts are append-only, like trial usage receipts.
CREATE FUNCTION prevent_entitled_usage_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Entitled usage receipts cannot be modified';
END;
$$;
CREATE TRIGGER entitled_usage_immutable BEFORE UPDATE ON "EntitledUsage" FOR EACH ROW EXECUTE FUNCTION prevent_entitled_usage_update();
