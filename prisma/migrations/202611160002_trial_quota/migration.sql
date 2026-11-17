-- CreateTable
CREATE TABLE "TrialAccount" (
    "userId" TEXT NOT NULL,
    "activatedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TrialAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TrialUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "jakartaDate" CHAR(10) NOT NULL,
    "slot" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TrialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_transactionId_key" ON "TrialUsage"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_userId_jakartaDate_key" ON "TrialUsage"("userId", "jakartaDate");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_userId_slot_key" ON "TrialUsage"("userId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "TrialUsage_userId_idempotencyKey_key" ON "TrialUsage"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "TrialAccount" ADD CONSTRAINT "TrialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialUsage" ADD CONSTRAINT "TrialUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TrialAccount"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Additional guards not expressible in the Prisma schema.
ALTER TABLE "TrialAccount" ADD CONSTRAINT "trial_exact_duration" CHECK ("expiresAt" = "activatedAt" + INTERVAL '72 hours');
ALTER TABLE "TrialUsage" ADD CONSTRAINT "trial_slot_range" CHECK ("slot" BETWEEN 1 AND 3);
ALTER TABLE "TrialUsage" ADD CONSTRAINT "trial_jakarta_date" CHECK ("jakartaDate" = to_char("createdAt" AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD'));
CREATE FUNCTION prevent_trial_receipt_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Trial activation and usage receipts cannot be modified';
END;
$$;
CREATE TRIGGER trial_activation_immutable BEFORE UPDATE ON "TrialAccount" FOR EACH ROW EXECUTE FUNCTION prevent_trial_receipt_update();
CREATE TRIGGER trial_usage_immutable BEFORE UPDATE ON "TrialUsage" FOR EACH ROW EXECUTE FUNCTION prevent_trial_receipt_update();
