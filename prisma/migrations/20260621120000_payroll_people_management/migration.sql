CREATE TABLE "payroll_org_units" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT,
    "parentId" TEXT,
    "managerEmployeeId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_org_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_portal_highlights" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "employeeId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "audience" TEXT NOT NULL DEFAULT 'ALL',
    "actionLabel" TEXT,
    "actionUrl" TEXT,
    "metricLabel" TEXT,
    "metricValue" TEXT,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_portal_highlights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_access_profiles" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT,
    "profileName" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "lastReviewedAt" TIMESTAMP(3),
    "lastAccessAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_access_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_workflow_templates" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "ownerEmployeeId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "triggerType" TEXT NOT NULL,
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "automationLevel" TEXT NOT NULL DEFAULT 'SEMI_AUTOMATIC',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "lastExecutedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_people_reports" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "metricValue" TEXT NOT NULL,
    "metricTrend" TEXT,
    "filtersSummary" TEXT,
    "lastGeneratedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_people_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_org_units_empresaId_code_key" ON "payroll_org_units"("empresaId", "code");
CREATE INDEX "payroll_org_units_empresaId_status_idx" ON "payroll_org_units"("empresaId", "status");
CREATE INDEX "payroll_org_units_parentId_idx" ON "payroll_org_units"("parentId");
CREATE INDEX "payroll_org_units_sedeId_idx" ON "payroll_org_units"("sedeId");
CREATE INDEX "payroll_org_units_managerEmployeeId_idx" ON "payroll_org_units"("managerEmployeeId");

CREATE INDEX "payroll_portal_highlights_empresaId_status_idx" ON "payroll_portal_highlights"("empresaId", "status");
CREATE INDEX "payroll_portal_highlights_employeeId_idx" ON "payroll_portal_highlights"("employeeId");

CREATE INDEX "payroll_access_profiles_empresaId_status_idx" ON "payroll_access_profiles"("empresaId", "status");
CREATE INDEX "payroll_access_profiles_userId_idx" ON "payroll_access_profiles"("userId");
CREATE INDEX "payroll_access_profiles_employeeId_idx" ON "payroll_access_profiles"("employeeId");

CREATE INDEX "payroll_workflow_templates_empresaId_status_idx" ON "payroll_workflow_templates"("empresaId", "status");
CREATE INDEX "payroll_workflow_templates_ownerUserId_idx" ON "payroll_workflow_templates"("ownerUserId");
CREATE INDEX "payroll_workflow_templates_ownerEmployeeId_idx" ON "payroll_workflow_templates"("ownerEmployeeId");

CREATE INDEX "payroll_people_reports_empresaId_status_idx" ON "payroll_people_reports"("empresaId", "status");
CREATE INDEX "payroll_people_reports_ownerUserId_idx" ON "payroll_people_reports"("ownerUserId");

ALTER TABLE "payroll_org_units" ADD CONSTRAINT "payroll_org_units_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_org_units" ADD CONSTRAINT "payroll_org_units_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_org_units" ADD CONSTRAINT "payroll_org_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "payroll_org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_org_units" ADD CONSTRAINT "payroll_org_units_managerEmployeeId_fkey" FOREIGN KEY ("managerEmployeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_portal_highlights" ADD CONSTRAINT "payroll_portal_highlights_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_portal_highlights" ADD CONSTRAINT "payroll_portal_highlights_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_access_profiles" ADD CONSTRAINT "payroll_access_profiles_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_access_profiles" ADD CONSTRAINT "payroll_access_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_access_profiles" ADD CONSTRAINT "payroll_access_profiles_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_workflow_templates" ADD CONSTRAINT "payroll_workflow_templates_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_workflow_templates" ADD CONSTRAINT "payroll_workflow_templates_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_workflow_templates" ADD CONSTRAINT "payroll_workflow_templates_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_people_reports" ADD CONSTRAINT "payroll_people_reports_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_people_reports" ADD CONSTRAINT "payroll_people_reports_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;