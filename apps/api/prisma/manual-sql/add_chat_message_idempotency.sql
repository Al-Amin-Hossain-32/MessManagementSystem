-- Socket retries reuse the client-generated id, preventing duplicate rows.
ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "clientMessageId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_userId_clientMessageId_key"
  ON "chat_messages" ("userId", "clientMessageId");
