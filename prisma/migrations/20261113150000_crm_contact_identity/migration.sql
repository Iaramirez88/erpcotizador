-- M3 · CRM captación de leads: identidad central del contacto
-- Migración 100% aditiva: nuevas columnas en crm_contacts y contactId en
-- conversaciones, oportunidades y actividades. No crea aún el índice único
-- de email (eso ocurre en M4, después de fusionar duplicados).

-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DO_NOT_CONTACT');

-- AlterTable
ALTER TABLE "crm_contacts" ADD COLUMN     "apellido" TEXT,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "departamento" TEXT,
ADD COLUMN     "documento" TEXT,
ADD COLUMN     "emailNormalized" TEXT,
ADD COLUMN     "empresaNombre" TEXT,
ADD COLUMN     "lastInteractionAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" TEXT,
ADD COLUMN     "ownerUserId" TEXT,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "phoneNormalized" TEXT,
ADD COLUMN     "sitioWeb" TEXT,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "status" "CrmContactStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "crm_opportunities" ADD COLUMN     "contactId" TEXT;

-- AlterTable
ALTER TABLE "crm_activities" ADD COLUMN     "contactId" TEXT;

-- AlterTable
ALTER TABLE "crm_conversations" ADD COLUMN     "contactId" TEXT;

-- CreateIndex
CREATE INDEX "crm_contacts_empresaId_phoneNormalized_idx" ON "crm_contacts"("empresaId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "crm_contacts_empresaId_status_lastInteractionAt_idx" ON "crm_contacts"("empresaId", "status", "lastInteractionAt");

-- CreateIndex
CREATE INDEX "crm_contacts_empresaId_ownerUserId_updatedAt_idx" ON "crm_contacts"("empresaId", "ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "crm_contacts_empresaId_nombre_idx" ON "crm_contacts"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "crm_contacts_empresaId_documento_idx" ON "crm_contacts"("empresaId", "documento");

-- CreateIndex
CREATE INDEX "crm_activities_empresaId_contactId_occurredAt_idx" ON "crm_activities"("empresaId", "contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "crm_opportunities_empresaId_contactId_createdAt_idx" ON "crm_opportunities"("empresaId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_conversations_empresaId_contactId_lastMessageAt_idx" ON "crm_conversations"("empresaId", "contactId", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_conversations" ADD CONSTRAINT "crm_conversations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: normalización de identidad sobre los contactos existentes
UPDATE "crm_contacts" SET
  "emailNormalized" = NULLIF(lower(btrim("email")), '')
WHERE "emailNormalized" IS NULL AND "email" IS NOT NULL;

UPDATE "crm_contacts" SET
  "phoneNormalized" = NULLIF(regexp_replace(coalesce(NULLIF(btrim("celular"), ''), btrim("telefono"), ''), '\D', '', 'g'), '')
WHERE "phoneNormalized" IS NULL AND (coalesce(NULLIF(btrim("celular"), ''), btrim("telefono"), '') <> '');

UPDATE "crm_contacts" SET
  "lastInteractionAt" = coalesce("lastInteractionAt", "updatedAt")
WHERE "lastInteractionAt" IS NULL;

-- Backfill: propagación de identidad en conversaciones y oportunidades ya vinculadas a un lead
UPDATE "crm_conversations" v
SET "contactId" = c."id"
FROM "crm_contacts" c
WHERE v."contactId" IS NULL
  AND c."leadId" IS NOT NULL
  AND v."leadId" = c."leadId";

UPDATE "crm_opportunities" o
SET "contactId" = c."id"
FROM "crm_contacts" c
WHERE o."contactId" IS NULL
  AND c."leadId" IS NOT NULL
  AND o."leadId" = c."leadId";

UPDATE "crm_activities" a
SET "contactId" = c."id"
FROM "crm_contacts" c
WHERE a."contactId" IS NULL
  AND c."leadId" IS NOT NULL
  AND a."leadId" = c."leadId";
