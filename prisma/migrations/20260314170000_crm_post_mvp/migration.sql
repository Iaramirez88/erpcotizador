CREATE TABLE "crm_stage_settings" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "key" "CrmOpportunityStage" NOT NULL,
  "label" TEXT NOT NULL,
  "color" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crm_stage_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_stage_settings_empresaId_key_key" UNIQUE ("empresaId", "key")
);

CREATE TABLE "crm_contacts" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "leadId" TEXT,
  "clienteId" TEXT,
  "nombre" TEXT NOT NULL,
  "email" TEXT,
  "telefono" TEXT,
  "celular" TEXT,
  "cargo" TEXT,
  "notes" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "crm_stage_settings"
  ADD CONSTRAINT "crm_stage_settings_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_contacts"
  ADD CONSTRAINT "crm_contacts_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_contacts"
  ADD CONSTRAINT "crm_contacts_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_contacts"
  ADD CONSTRAINT "crm_contacts_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_contacts"
  ADD CONSTRAINT "crm_contacts_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_contacts"
  ADD CONSTRAINT "crm_contacts_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "crm_stage_settings_empresaId_sortOrder_idx" ON "crm_stage_settings"("empresaId", "sortOrder");
CREATE INDEX "crm_contacts_empresaId_createdAt_idx" ON "crm_contacts"("empresaId", "createdAt");
CREATE INDEX "crm_contacts_leadId_idx" ON "crm_contacts"("leadId");
CREATE INDEX "crm_contacts_clienteId_idx" ON "crm_contacts"("clienteId");
CREATE INDEX "crm_contacts_leadId_isPrimary_idx" ON "crm_contacts"("leadId", "isPrimary");
CREATE INDEX "crm_contacts_clienteId_isPrimary_idx" ON "crm_contacts"("clienteId", "isPrimary");

INSERT INTO "crm_stage_settings" ("id", "empresaId", "key", "label", "color", "sortOrder", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text) || md5(random()::text || e."id") AS "id",
  e."id" AS "empresaId",
  s."key"::"CrmOpportunityStage" AS "key",
  s."label",
  s."color",
  s."sortOrder",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "empresas" e
CROSS JOIN (
  VALUES
    ('NEW', 'Nuevo', '#64748b', 10),
    ('QUALIFIED', 'Calificada', '#0f766e', 20),
    ('PROPOSAL', 'Propuesta', '#2563eb', 30),
    ('NEGOTIATION', 'Negociación', '#d97706', 40),
    ('WON', 'Ganada', '#16a34a', 50),
    ('LOST', 'Perdida', '#dc2626', 60)
) AS s("key", "label", "color", "sortOrder");
