CREATE TYPE "CrmChannelProvider" AS ENUM (
  'WHATSAPP_CLOUD',
  'WHATSAPP_SANDBOX',
  'FACEBOOK_PAGE',
  'MESSENGER',
  'WEB_FORM',
  'WEB_CHATBOT',
  'INSTAGRAM_DM'
);

CREATE TYPE "CrmChannelConnectionStatus" AS ENUM (
  'DRAFT',
  'TESTING',
  'ACTIVE',
  'DISABLED',
  'ERROR'
);

CREATE TYPE "CrmConversationStatus" AS ENUM (
  'OPEN',
  'PENDING',
  'BOT_ACTIVE',
  'HUMAN_ACTIVE',
  'RESOLVED',
  'SPAM'
);

CREATE TYPE "CrmMessageDirection" AS ENUM (
  'INBOUND',
  'OUTBOUND',
  'SYSTEM'
);

CREATE TYPE "CrmMessageType" AS ENUM (
  'TEXT',
  'IMAGE',
  'AUDIO',
  'DOCUMENT',
  'TEMPLATE',
  'FORM_SUBMISSION',
  'EVENT'
);

CREATE TYPE "CrmMessageStatus" AS ENUM (
  'RECEIVED',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED'
);

CREATE TYPE "CrmLeadCaptureType" AS ENUM (
  'WEB_FORM',
  'META_LEAD_AD',
  'WHATSAPP_INBOUND',
  'MESSENGER_INBOUND',
  'CHATBOT_START',
  'MANUAL_IMPORT'
);

CREATE TABLE "crm_channel_connections" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "provider" "CrmChannelProvider" NOT NULL,
  "status" "CrmChannelConnectionStatus" NOT NULL DEFAULT 'DRAFT',
  "name" TEXT NOT NULL,
  "externalAccountId" TEXT,
  "externalPageId" TEXT,
  "externalPhoneNumberId" TEXT,
  "verifyToken" TEXT,
  "settingsJson" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT NOT NULL,
  "lastSyncAt" TIMESTAMP(3),
  "lastWebhookAt" TIMESTAMP(3),
  "lastErrorAt" TIMESTAMP(3),
  "lastErrorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_channel_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_conversations" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "channelConnectionId" TEXT NOT NULL,
  "leadId" TEXT,
  "clienteId" TEXT,
  "opportunityId" TEXT,
  "status" "CrmConversationStatus" NOT NULL DEFAULT 'OPEN',
  "directionLastMessage" "CrmMessageDirection" NOT NULL DEFAULT 'INBOUND',
  "externalThreadId" TEXT,
  "contactDisplayName" TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  "assignedToUserId" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "firstInboundAt" TIMESTAMP(3),
  "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "source" TEXT,
  "sourceCampaign" TEXT,
  "sourceMedium" TEXT,
  "sourceContent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_messages" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "conversationId" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "direction" "CrmMessageDirection" NOT NULL,
  "messageType" "CrmMessageType" NOT NULL DEFAULT 'TEXT',
  "status" "CrmMessageStatus" NOT NULL DEFAULT 'RECEIVED',
  "bodyText" TEXT,
  "payloadJson" JSONB NOT NULL DEFAULT '{}',
  "attachmentsJson" JSONB DEFAULT '[]',
  "sentByUserId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_lead_captures" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "channelConnectionId" TEXT NOT NULL,
  "leadId" TEXT,
  "conversationId" TEXT,
  "providerLeadId" TEXT,
  "captureType" "CrmLeadCaptureType" NOT NULL,
  "rawPayloadJson" JSONB NOT NULL DEFAULT '{}',
  "normalizedDataJson" JSONB NOT NULL DEFAULT '{}',
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "utmContent" TEXT,
  "utmTerm" TEXT,
  "landingPageUrl" TEXT,
  "referrerUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_lead_captures_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "crm_channel_connections"
  ADD CONSTRAINT "crm_channel_connections_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_channel_connections_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_channel_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_conversations"
  ADD CONSTRAINT "crm_conversations_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_conversations_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_conversations_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "crm_channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_conversations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_conversations_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_conversations_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_conversations_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_messages"
  ADD CONSTRAINT "crm_messages_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_messages_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crm_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_messages_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_lead_captures"
  ADD CONSTRAINT "crm_lead_captures_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_lead_captures_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_lead_captures_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "crm_channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_lead_captures_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "crm_lead_captures_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "crm_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "crm_channel_connections_empresaId_provider_status_idx" ON "crm_channel_connections"("empresaId", "provider", "status");
CREATE INDEX "crm_channel_connections_empresaId_sedeId_provider_idx" ON "crm_channel_connections"("empresaId", "sedeId", "provider");
CREATE INDEX "crm_channel_connections_createdById_idx" ON "crm_channel_connections"("createdById");

CREATE INDEX "crm_conversations_empresaId_status_lastMessageAt_idx" ON "crm_conversations"("empresaId", "status", "lastMessageAt");
CREATE INDEX "crm_conversations_channelConnectionId_status_lastMessageAt_idx" ON "crm_conversations"("channelConnectionId", "status", "lastMessageAt");
CREATE INDEX "crm_conversations_leadId_lastMessageAt_idx" ON "crm_conversations"("leadId", "lastMessageAt");
CREATE INDEX "crm_conversations_clienteId_lastMessageAt_idx" ON "crm_conversations"("clienteId", "lastMessageAt");
CREATE INDEX "crm_conversations_opportunityId_lastMessageAt_idx" ON "crm_conversations"("opportunityId", "lastMessageAt");
CREATE INDEX "crm_conversations_assignedToUserId_status_lastMessageAt_idx" ON "crm_conversations"("assignedToUserId", "status", "lastMessageAt");

CREATE INDEX "crm_messages_empresaId_occurredAt_idx" ON "crm_messages"("empresaId", "occurredAt");
CREATE INDEX "crm_messages_conversationId_occurredAt_idx" ON "crm_messages"("conversationId", "occurredAt");
CREATE INDEX "crm_messages_providerMessageId_idx" ON "crm_messages"("providerMessageId");
CREATE INDEX "crm_messages_sentByUserId_occurredAt_idx" ON "crm_messages"("sentByUserId", "occurredAt");

CREATE INDEX "crm_lead_captures_empresaId_captureType_createdAt_idx" ON "crm_lead_captures"("empresaId", "captureType", "createdAt");
CREATE INDEX "crm_lead_captures_channelConnectionId_createdAt_idx" ON "crm_lead_captures"("channelConnectionId", "createdAt");
CREATE INDEX "crm_lead_captures_leadId_createdAt_idx" ON "crm_lead_captures"("leadId", "createdAt");
CREATE INDEX "crm_lead_captures_conversationId_createdAt_idx" ON "crm_lead_captures"("conversationId", "createdAt");