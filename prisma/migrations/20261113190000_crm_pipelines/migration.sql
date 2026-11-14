-- M9 · CRM captación: pipelines (embudos) múltiples
-- Migración aditiva. El embudo por defecto sigue siendo `crm_stage_settings` (pipelineId NULL).

-- CreateTable
CREATE TABLE "crm_pipelines" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stagesJson" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_pipelines_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "crm_opportunities" ADD COLUMN "pipelineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "crm_pipelines_empresaId_name_key" ON "crm_pipelines"("empresaId", "name");

-- CreateIndex
CREATE INDEX "crm_pipelines_empresaId_isDefault_idx" ON "crm_pipelines"("empresaId", "isDefault");

-- CreateIndex
CREATE INDEX "crm_opportunities_empresaId_pipelineId_stage_idx" ON "crm_opportunities"("empresaId", "pipelineId", "stage");

-- AddForeignKey
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "crm_pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
