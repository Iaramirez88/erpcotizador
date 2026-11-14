-- M2 · CRM captación de leads: origen consultable en la captura
-- Migración 100% aditiva sobre crm_lead_captures.

-- AlterTable
ALTER TABLE "crm_lead_captures" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "campaignName" TEXT,
ADD COLUMN     "consentJson" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "dedupeStrategy" TEXT,
ADD COLUMN     "emailNormalized" TEXT,
ADD COLUMN     "formId" TEXT,
ADD COLUMN     "formName" TEXT,
ADD COLUMN     "isFirstTouch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resourceLabel" TEXT,
ADD COLUMN     "scoreDelta" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "serviceInterest" TEXT;

-- CreateIndex
CREATE INDEX "crm_lead_captures_empresaId_contactId_createdAt_idx" ON "crm_lead_captures"("empresaId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_lead_captures_empresaId_formId_createdAt_idx" ON "crm_lead_captures"("empresaId", "formId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_lead_captures_empresaId_campaignName_createdAt_idx" ON "crm_lead_captures"("empresaId", "campaignName", "createdAt");

-- CreateIndex
CREATE INDEX "crm_lead_captures_empresaId_serviceInterest_createdAt_idx" ON "crm_lead_captures"("empresaId", "serviceInterest", "createdAt");

-- CreateIndex
CREATE INDEX "crm_lead_captures_empresaId_emailNormalized_createdAt_idx" ON "crm_lead_captures"("empresaId", "emailNormalized", "createdAt");

-- AddForeignKey
ALTER TABLE "crm_lead_captures" ADD CONSTRAINT "crm_lead_captures_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: las capturas heredadas de formularios identifican su formulario por la conexión de canal.
UPDATE "crm_lead_captures" k
SET "formId" = cc."id",
    "formName" = cc."name"
FROM "crm_channel_connections" cc
WHERE k."channelConnectionId" = cc."id"
  AND cc."provider"::text IN ('WEB_FORM', 'WEB_CHATBOT')
  AND k."formId" IS NULL;

-- Backfill: origen y campaña desde las UTM ya registradas
UPDATE "crm_lead_captures" SET
  "campaignName" = coalesce("campaignName", NULLIF(btrim("utmCampaign"), '')),
  "serviceInterest" = coalesce("serviceInterest", NULLIF(btrim("normalizedDataJson"->>'serviceInterest'), ''))
WHERE "campaignName" IS NULL OR "serviceInterest" IS NULL;

-- Backfill: email normalizado de la captura a partir del lead asociado
UPDATE "crm_lead_captures" k
SET "emailNormalized" = NULLIF(lower(btrim(l."email")), '')
FROM "crm_leads" l
WHERE k."leadId" = l."id"
  AND k."emailNormalized" IS NULL
  AND l."email" IS NOT NULL;

-- Backfill: primera captura del lead (isFirstTouch)
WITH firsts AS (
  SELECT DISTINCT ON ("leadId") "id"
  FROM "crm_lead_captures"
  WHERE "leadId" IS NOT NULL
  ORDER BY "leadId", "createdAt" ASC, "id" ASC
)
UPDATE "crm_lead_captures" k SET "isFirstTouch" = true
FROM firsts f
WHERE k."id" = f."id";

-- Backfill: denormalización del origen en el lead (última captura con formulario)
UPDATE "crm_leads" l
SET "formId" = c."formId",
    "formName" = c."formName"
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", "formId", "formName"
  FROM "crm_lead_captures"
  WHERE "leadId" IS NOT NULL AND "formId" IS NOT NULL
  ORDER BY "leadId", "createdAt" DESC
) c
WHERE l."id" = c."leadId" AND l."formId" IS NULL;

UPDATE "crm_leads" l
SET "campaignName" = c."campaignName"
FROM (
  SELECT DISTINCT ON ("leadId") "leadId", "campaignName"
  FROM "crm_lead_captures"
  WHERE "leadId" IS NOT NULL AND "campaignName" IS NOT NULL
  ORDER BY "leadId", "createdAt" DESC
) c
WHERE l."id" = c."leadId" AND l."campaignName" IS NULL;

-- Backfill: el nombre del formulario heredado también es la etiqueta de origen
UPDATE "crm_leads" SET
  "sourceKey" = coalesce("sourceKey", "formId"),
  "sourceLabel" = coalesce("sourceLabel", "formName")
WHERE "sourceKey" IS NULL AND "formId" IS NOT NULL;
