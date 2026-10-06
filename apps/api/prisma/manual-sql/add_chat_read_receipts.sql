-- Store per-user message read receipts and expose them to mess chat members.
CREATE TABLE IF NOT EXISTS "chat_message_reads" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_message_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_message_reads_messageId_userId_key"
  ON "chat_message_reads" ("messageId", "userId");

CREATE INDEX IF NOT EXISTS "chat_message_reads_userId_seenAt_idx"
  ON "chat_message_reads" ("userId", "seenAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_message_reads_messageId_fkey'
      AND conrelid = '"chat_message_reads"'::regclass
  ) THEN
    ALTER TABLE "chat_message_reads"
      ADD CONSTRAINT "chat_message_reads_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_message_reads_userId_fkey'
      AND conrelid = '"chat_message_reads"'::regclass
  ) THEN
    ALTER TABLE "chat_message_reads"
      ADD CONSTRAINT "chat_message_reads_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
