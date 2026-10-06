-- Add the Mess Group Chat storage. Safe to apply more than once.
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT NOT NULL,
  "messId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_messId_createdAt_idx"
  ON "chat_messages" ("messId", "createdAt");

CREATE INDEX IF NOT EXISTS "chat_messages_messId_userId_idx"
  ON "chat_messages" ("messId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_messId_fkey'
      AND conrelid = '"chat_messages"'::regclass
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_messId_fkey"
      FOREIGN KEY ("messId") REFERENCES "messes"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_userId_fkey'
      AND conrelid = '"chat_messages"'::regclass
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
