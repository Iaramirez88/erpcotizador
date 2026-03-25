-- Extiende el chat interno con soporte para grupos y adjuntos.

ALTER TYPE "InternalChatThreadType" ADD VALUE IF NOT EXISTS 'GROUP';

ALTER TABLE "internal_chat_messages"
  ALTER COLUMN "bodyText" DROP NOT NULL;

ALTER TABLE "internal_chat_messages"
  ADD COLUMN IF NOT EXISTS "attachmentsJson" JSONB DEFAULT '[]'::jsonb;

UPDATE "internal_chat_messages"
SET "attachmentsJson" = '[]'::jsonb
WHERE "attachmentsJson" IS NULL;

ALTER TABLE "internal_chat_messages"
  ALTER COLUMN "attachmentsJson" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "attachmentsJson" SET NOT NULL;