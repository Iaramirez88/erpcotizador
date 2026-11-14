-- M6 · CRM captación: scoring, reglas de asignación y consentimiento por canal
-- Migración 100% aditiva. No modifica tablas existentes.

-- CreateEnum
CREATE TYPE "CrmScoreEventType" AS ENUM ('DOCUMENT_DOWNLOAD', 'EMAIL_OPEN', 'LINK_CLICK', 'SERVICE_PAGE_VISIT', 'INFO_REQUEST', 'QUOTE_REQUEST', 'MEETING_BOOKED', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CrmContactChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'CALL');

-- CreateEnum
CREATE TYPE "CrmConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'REVOKED');

-- CreateTable
CREATE TABLE "crm_scoring_settings" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "warmThreshold" INTEGER NOT NULL DEFAULT 20,
    "hotThreshold" INTEGER NOT NULL DEFAULT 50,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_scoring_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_scoring_rules" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "eventType" "CrmScoreEventType" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "oncePerLead" BOOLEAN NOT NULL DEFAULT true,
    "dedupeWindowHours" INTEGER NOT NULL DEFAULT 0,
    "maxPerLead" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_score_events" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contactId" TEXT,
    "captureId" TEXT,
    "eventType" "CrmScoreEventType" NOT NULL,
    "points" INTEGER NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_score_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_assignment_rules" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "matchJson" JSONB NOT NULL DEFAULT '{}',
    "assigneeUserId" TEXT,
    "teamId" TEXT,
    "stopOnMatch" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_contact_consents" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "channel" "CrmContactChannel" NOT NULL,
    "status" "CrmConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "evidenceJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_contact_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_scoring_settings_empresaId_key" ON "crm_scoring_settings"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "crm_scoring_rules_empresaId_eventType_key" ON "crm_scoring_rules"("empresaId", "eventType");

-- CreateIndex
CREATE INDEX "crm_scoring_rules_empresaId_active_idx" ON "crm_scoring_rules"("empresaId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "crm_lead_score_events_leadId_dedupeKey_key" ON "crm_lead_score_events"("leadId", "dedupeKey");

-- CreateIndex
CREATE INDEX "crm_lead_score_events_empresaId_occurredAt_idx" ON "crm_lead_score_events"("empresaId", "occurredAt");

-- CreateIndex
CREATE INDEX "crm_lead_score_events_leadId_occurredAt_idx" ON "crm_lead_score_events"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "crm_assignment_rules_empresaId_active_priority_idx" ON "crm_assignment_rules"("empresaId", "active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "crm_contact_consents_contactId_channel_key" ON "crm_contact_consents"("contactId", "channel");

-- CreateIndex
CREATE INDEX "crm_contact_consents_empresaId_channel_status_idx" ON "crm_contact_consents"("empresaId", "channel", "status");

-- AddForeignKey
ALTER TABLE "crm_scoring_settings" ADD CONSTRAINT "crm_scoring_settings_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_scoring_rules" ADD CONSTRAINT "crm_scoring_rules_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_score_events" ADD CONSTRAINT "crm_lead_score_events_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_score_events" ADD CONSTRAINT "crm_lead_score_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_assignment_rules" ADD CONSTRAINT "crm_assignment_rules_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_consents" ADD CONSTRAINT "crm_contact_consents_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contact_consents" ADD CONSTRAINT "crm_contact_consents_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
