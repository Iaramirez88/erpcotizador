-- M7 · CRM captación: idempotencia del historial (CrmActivity.eventKey)
-- Migración 100% aditiva. Postgres permite múltiples NULL en un índice único.

-- AlterTable
ALTER TABLE "crm_activities" ADD COLUMN "eventKey" TEXT,
ADD COLUMN "metadataJson" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE UNIQUE INDEX "crm_activities_empresaId_eventKey_key" ON "crm_activities"("empresaId", "eventKey");
