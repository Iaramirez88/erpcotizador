CREATE TYPE "InternalChatThreadType" AS ENUM ('DIRECT');

CREATE TABLE "internal_chat_threads" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "type" "InternalChatThreadType" NOT NULL DEFAULT 'DIRECT',
    "title" TEXT,
    "createdById" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_chat_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internal_chat_participants" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_chat_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "internal_chat_messages" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "sentByUserId" TEXT,
    "bodyText" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "internal_chat_threads_empresaId_lastMessageAt_idx" ON "internal_chat_threads"("empresaId", "lastMessageAt");
CREATE INDEX "internal_chat_threads_createdById_createdAt_idx" ON "internal_chat_threads"("createdById", "createdAt");
CREATE UNIQUE INDEX "internal_chat_participants_threadId_userId_key" ON "internal_chat_participants"("threadId", "userId");
CREATE INDEX "internal_chat_participants_userId_updatedAt_idx" ON "internal_chat_participants"("userId", "updatedAt");
CREATE INDEX "internal_chat_messages_empresaId_occurredAt_idx" ON "internal_chat_messages"("empresaId", "occurredAt");
CREATE INDEX "internal_chat_messages_threadId_occurredAt_idx" ON "internal_chat_messages"("threadId", "occurredAt");
CREATE INDEX "internal_chat_messages_sentByUserId_occurredAt_idx" ON "internal_chat_messages"("sentByUserId", "occurredAt");

ALTER TABLE "internal_chat_threads" ADD CONSTRAINT "internal_chat_threads_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_chat_threads" ADD CONSTRAINT "internal_chat_threads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "internal_chat_participants" ADD CONSTRAINT "internal_chat_participants_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "internal_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_chat_participants" ADD CONSTRAINT "internal_chat_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_chat_messages" ADD CONSTRAINT "internal_chat_messages_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_chat_messages" ADD CONSTRAINT "internal_chat_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "internal_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "internal_chat_messages" ADD CONSTRAINT "internal_chat_messages_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;