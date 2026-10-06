-- Run against the existing PostgreSQL database before deploying the
-- notification API. All additions are safe to re-run.
ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "notifications"
  ALTER COLUMN "channel" SET DEFAULT 'IN_APP';

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_idempotencyKey_key"
  ON "notifications" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx"
  ON "notifications" ("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_userId_fkey'
      AND conrelid = '"notifications"'::regclass
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
