-- M4 · CRM captación de leads: unicidad de email por empresa
-- 1) Normaliza el email de los contactos.
-- 2) Fusiona duplicados: el contacto más antiguo es el canónico; los demás quedan
--    marcados con mergedIntoId, sin borrar datos y conservando el email original.
-- 3) Crea el índice único que garantiza la identidad del contacto.
-- Idempotente: puede ejecutarse sobre una base ya normalizada.

-- 1) Normalización
UPDATE "crm_contacts" SET
  "emailNormalized" = NULLIF(lower(btrim("email")), '')
WHERE "email" IS NOT NULL
  AND "emailNormalized" IS DISTINCT FROM NULLIF(lower(btrim("email")), '');

-- 2) Fusión de duplicados (uno por empresa + email normalizado)
WITH ranked AS (
  SELECT "id",
         first_value("id") OVER w AS canonical_id,
         row_number() OVER w AS row_number
  FROM "crm_contacts"
  WHERE "emailNormalized" IS NOT NULL
    AND "mergedIntoId" IS NULL
  WINDOW w AS (PARTITION BY "empresaId", "emailNormalized" ORDER BY "createdAt" ASC, "id" ASC)
)
UPDATE "crm_contacts" c
SET "mergedIntoId" = r.canonical_id,
    "emailNormalized" = NULL,
    "status" = 'INACTIVE'::"CrmContactStatus",
    "updatedAt" = now()
FROM ranked r
WHERE c."id" = r."id"
  AND r.row_number > 1;

-- 3) Repuntar referencias al contacto canónico
UPDATE "crm_leads" t SET "contactId" = c."mergedIntoId", "updatedAt" = now()
FROM "crm_contacts" c
WHERE t."contactId" = c."id" AND c."mergedIntoId" IS NOT NULL;

UPDATE "crm_lead_captures" t SET "contactId" = c."mergedIntoId", "updatedAt" = now()
FROM "crm_contacts" c
WHERE t."contactId" = c."id" AND c."mergedIntoId" IS NOT NULL;

UPDATE "crm_conversations" t SET "contactId" = c."mergedIntoId", "updatedAt" = now()
FROM "crm_contacts" c
WHERE t."contactId" = c."id" AND c."mergedIntoId" IS NOT NULL;

UPDATE "crm_opportunities" t SET "contactId" = c."mergedIntoId", "updatedAt" = now()
FROM "crm_contacts" c
WHERE t."contactId" = c."id" AND c."mergedIntoId" IS NOT NULL;

UPDATE "crm_activities" t SET "contactId" = c."mergedIntoId", "updatedAt" = now()
FROM "crm_contacts" c
WHERE t."contactId" = c."id" AND c."mergedIntoId" IS NOT NULL;

-- 4) Índice único de identidad
CREATE UNIQUE INDEX "crm_contacts_empresaId_emailNormalized_key" ON "crm_contacts"("empresaId", "emailNormalized");
