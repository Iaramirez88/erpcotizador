ALTER TYPE "ModuleKey" ADD VALUE 'CRM';

CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'LOST', 'CONVERTED');
CREATE TYPE "CrmLeadSource" AS ENUM ('WEB', 'REFERIDO', 'WHATSAPP', 'LLAMADA', 'IMPORT', 'OTRO');
CREATE TYPE "CrmOpportunityStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');
CREATE TYPE "CrmActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'TASK_DONE', 'STAGE_CHANGE', 'QUOTE_SENT', 'OTHER');
CREATE TYPE "CrmTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELED');
CREATE TYPE "CrmTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE "crm_leads" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
  "source" "CrmLeadSource" NOT NULL DEFAULT 'OTRO',
  "nombre" TEXT NOT NULL,
  "empresaNombre" TEXT,
  "documento" TEXT,
  "email" TEXT,
  "telefono" TEXT,
  "celular" TEXT,
  "direccion" TEXT,
  "ciudad" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "ownerUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "convertedAt" TIMESTAMP(3),
  "convertedClienteId" TEXT,
  "lastActivityAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_opportunities" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "stage" "CrmOpportunityStage" NOT NULL DEFAULT 'NEW',
  "leadId" TEXT,
  "clienteId" TEXT,
  "expectedValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "probabilityPct" INTEGER NOT NULL DEFAULT 0,
  "expectedCloseAt" TIMESTAMP(3),
  "assignedToUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "cotizacionId" TEXT,
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_opportunities_cotizacionId_key" UNIQUE ("cotizacionId")
);

CREATE TABLE "crm_activities" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "type" "CrmActivityType" NOT NULL DEFAULT 'NOTE',
  "summary" TEXT NOT NULL,
  "details" TEXT,
  "leadId" TEXT,
  "opportunityId" TEXT,
  "clienteId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_tasks" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "CrmTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "leadId" TEXT,
  "opportunityId" TEXT,
  "clienteId" TEXT,
  "assignedToUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crm_tasks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "crm_leads"
  ADD CONSTRAINT "crm_leads_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_leads"
  ADD CONSTRAINT "crm_leads_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_leads"
  ADD CONSTRAINT "crm_leads_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_leads"
  ADD CONSTRAINT "crm_leads_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads"
  ADD CONSTRAINT "crm_leads_convertedClienteId_fkey"
  FOREIGN KEY ("convertedClienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities"
  ADD CONSTRAINT "crm_opportunities_cotizacionId_fkey"
  FOREIGN KEY ("cotizacionId") REFERENCES "cotizaciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities"
  ADD CONSTRAINT "crm_activities_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_opportunityId_fkey"
  FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_tasks"
  ADD CONSTRAINT "crm_tasks_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "crm_leads_empresaId_status_createdAt_idx" ON "crm_leads"("empresaId", "status", "createdAt");
CREATE INDEX "crm_leads_empresaId_sedeId_status_idx" ON "crm_leads"("empresaId", "sedeId", "status");
CREATE INDEX "crm_leads_ownerUserId_idx" ON "crm_leads"("ownerUserId");
CREATE INDEX "crm_leads_convertedClienteId_idx" ON "crm_leads"("convertedClienteId");

CREATE INDEX "crm_opportunities_empresaId_stage_createdAt_idx" ON "crm_opportunities"("empresaId", "stage", "createdAt");
CREATE INDEX "crm_opportunities_empresaId_sedeId_stage_idx" ON "crm_opportunities"("empresaId", "sedeId", "stage");
CREATE INDEX "crm_opportunities_assignedToUserId_idx" ON "crm_opportunities"("assignedToUserId");
CREATE INDEX "crm_opportunities_leadId_idx" ON "crm_opportunities"("leadId");
CREATE INDEX "crm_opportunities_clienteId_idx" ON "crm_opportunities"("clienteId");

CREATE INDEX "crm_activities_empresaId_occurredAt_idx" ON "crm_activities"("empresaId", "occurredAt");
CREATE INDEX "crm_activities_leadId_occurredAt_idx" ON "crm_activities"("leadId", "occurredAt");
CREATE INDEX "crm_activities_opportunityId_occurredAt_idx" ON "crm_activities"("opportunityId", "occurredAt");
CREATE INDEX "crm_activities_clienteId_occurredAt_idx" ON "crm_activities"("clienteId", "occurredAt");

CREATE INDEX "crm_tasks_empresaId_status_dueAt_idx" ON "crm_tasks"("empresaId", "status", "dueAt");
CREATE INDEX "crm_tasks_assignedToUserId_status_dueAt_idx" ON "crm_tasks"("assignedToUserId", "status", "dueAt");
CREATE INDEX "crm_tasks_leadId_idx" ON "crm_tasks"("leadId");
CREATE INDEX "crm_tasks_opportunityId_idx" ON "crm_tasks"("opportunityId");
CREATE INDEX "crm_tasks_clienteId_idx" ON "crm_tasks"("clienteId");