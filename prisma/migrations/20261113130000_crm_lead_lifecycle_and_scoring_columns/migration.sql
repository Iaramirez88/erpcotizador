-- M1 · CRM captación de leads: ciclo de vida, puntuación y origen consultable
-- Migración 100% aditiva: no elimina ni renombra columnas existentes.
-- No usa los nuevos valores del enum CrmLeadSource en el mismo bloque, por compatibilidad con PostgreSQL 11.

-- CreateEnum
CREATE TYPE "CrmLeadLifecycleStatus" AS ENUM ('NEW', 'PENDING_REVIEW', 'NURTURING', 'QUALIFIED', 'SALES_ASSIGNED', 'CONVERTED', 'DISCARDED', 'DO_NOT_CONTACT');

-- CreateEnum
CREATE TYPE "CrmLeadScoreBand" AS ENUM ('COLD', 'WARM', 'HOT');

-- AlterEnum
ALTER TYPE "CrmLeadSource" ADD VALUE 'GOOGLE_ADS';
ALTER TYPE "CrmLeadSource" ADD VALUE 'META_ADS';
ALTER TYPE "CrmLeadSource" ADD VALUE 'LANDING_PAGE';
ALTER TYPE "CrmLeadSource" ADD VALUE 'API';
ALTER TYPE "CrmLeadSource" ADD VALUE 'EVENTO';
ALTER TYPE "CrmLeadSource" ADD VALUE 'ORGANICO';

-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedByUserId" TEXT,
ADD COLUMN     "campaignName" TEXT,
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "discardReason" TEXT,
ADD COLUMN     "discardedAt" TIMESTAMP(3),
ADD COLUMN     "firstTouchAt" TIMESTAMP(3),
ADD COLUMN     "formId" TEXT,
ADD COLUMN     "formName" TEXT,
ADD COLUMN     "lastCaptureAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleStatus" "CrmLeadLifecycleStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "noContactRequestedAt" TIMESTAMP(3),
ADD COLUMN     "nurtureStartedAt" TIMESTAMP(3),
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scoreBand" "CrmLeadScoreBand" NOT NULL DEFAULT 'COLD',
ADD COLUMN     "scoreUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "serviceInterest" TEXT,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "sourceLabel" TEXT;

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_lifecycleStatus_createdAt_idx" ON "crm_leads"("empresaId", "lifecycleStatus", "createdAt");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_ownerUserId_lifecycleStatus_idx" ON "crm_leads"("empresaId", "ownerUserId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_contactId_createdAt_idx" ON "crm_leads"("empresaId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_scoreBand_score_idx" ON "crm_leads"("empresaId", "scoreBand", "score");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_formId_createdAt_idx" ON "crm_leads"("empresaId", "formId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_campaignName_createdAt_idx" ON "crm_leads"("empresaId", "campaignName", "createdAt");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_serviceInterest_createdAt_idx" ON "crm_leads"("empresaId", "serviceInterest", "createdAt");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_lastCaptureAt_idx" ON "crm_leads"("empresaId", "lastCaptureAt");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_email_idx" ON "crm_leads"("empresaId", "email");

-- CreateIndex
CREATE INDEX "crm_leads_empresaId_telefono_idx" ON "crm_leads"("empresaId", "telefono");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill de ciclo de vida desde el status histórico del embudo (idempotente sobre filas ya migradas)
UPDATE "crm_leads" SET "lifecycleStatus" =
  CASE
    WHEN "convertedClienteId" IS NOT NULL OR "status" = 'CONVERTED' THEN 'CONVERTED'::"CrmLeadLifecycleStatus"
    WHEN "status" = 'QUALIFIED' THEN 'QUALIFIED'::"CrmLeadLifecycleStatus"
    WHEN "status" = 'LOST' THEN 'DISCARDED'::"CrmLeadLifecycleStatus"
    WHEN "status" = 'CONTACTED' THEN 'PENDING_REVIEW'::"CrmLeadLifecycleStatus"
    ELSE 'NEW'::"CrmLeadLifecycleStatus"
  END,
  "discardedAt" = CASE WHEN "status" = 'LOST' THEN coalesce("updatedAt", now()) ELSE "discardedAt" END;

-- Backfill de primeras marcas temporales de captación
UPDATE "crm_leads" SET
  "firstTouchAt" = coalesce("firstTouchAt", "createdAt"),
  "lastCaptureAt" = coalesce("lastCaptureAt", "lastActivityAt", "createdAt");
