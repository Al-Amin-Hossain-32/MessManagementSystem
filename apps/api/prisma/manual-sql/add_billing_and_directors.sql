DO $$ BEGIN
  CREATE TYPE "OfflinePaymentMethod" AS ENUM ('BKASH', 'NAGAD', 'BANK_TRANSFER', 'CASH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingPaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_PAYMENT_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_PAYMENT_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'BILLING_PAYMENT_REJECTED';

CREATE TABLE IF NOT EXISTS "billing_payment_requests" (
  "id" TEXT NOT NULL,
  "messId" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "reviewedBy" TEXT,
  "plan" "SubscriptionPlan" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "OfflinePaymentMethod" NOT NULL,
  "paymentReference" TEXT NOT NULL,
  "proofUrl" TEXT,
  "notes" TEXT,
  "status" "BillingPaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "billing_payment_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "billing_payment_requests_messId_status_requestedAt_idx"
  ON "billing_payment_requests" ("messId", "status", "requestedAt");
CREATE INDEX IF NOT EXISTS "billing_payment_requests_status_requestedAt_idx"
  ON "billing_payment_requests" ("status", "requestedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_payment_requests_messId_paymentReference_key"
  ON "billing_payment_requests" ("messId", "paymentReference");
CREATE UNIQUE INDEX IF NOT EXISTS "billing_payment_requests_one_pending_per_mess_key"
  ON "billing_payment_requests" ("messId") WHERE "status" = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_payment_requests_messId_fkey') THEN
    ALTER TABLE "billing_payment_requests"
      ADD CONSTRAINT "billing_payment_requests_messId_fkey"
      FOREIGN KEY ("messId") REFERENCES "messes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_payment_requests_requestedBy_fkey') THEN
    ALTER TABLE "billing_payment_requests"
      ADD CONSTRAINT "billing_payment_requests_requestedBy_fkey"
      FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'billing_payment_requests_reviewedBy_fkey') THEN
    ALTER TABLE "billing_payment_requests"
      ADD CONSTRAINT "billing_payment_requests_reviewedBy_fkey"
      FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
