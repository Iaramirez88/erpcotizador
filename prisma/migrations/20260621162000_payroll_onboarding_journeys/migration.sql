CREATE TABLE "payroll_onboarding_journeys" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodId" TEXT,
  "workflowTemplateId" TEXT,
  "ownerUserId" TEXT,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANIFICADO',
  "phase" TEXT NOT NULL DEFAULT 'PRE_INGRESO',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "employeeRole" TEXT,
  "locationLabel" TEXT,
  "welcomeMessage" TEXT,
  "checklist" JSONB NOT NULL DEFAULT '[]',
  "startDate" TIMESTAMP(3) NOT NULL,
  "targetDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_onboarding_journeys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_onboarding_journeys_empresaId_status_idx" ON "payroll_onboarding_journeys"("empresaId", "status");
CREATE INDEX "payroll_onboarding_journeys_employeeId_startDate_idx" ON "payroll_onboarding_journeys"("employeeId", "startDate");
CREATE INDEX "payroll_onboarding_journeys_periodId_idx" ON "payroll_onboarding_journeys"("periodId");
CREATE INDEX "payroll_onboarding_journeys_workflowTemplateId_idx" ON "payroll_onboarding_journeys"("workflowTemplateId");
CREATE INDEX "payroll_onboarding_journeys_ownerUserId_idx" ON "payroll_onboarding_journeys"("ownerUserId");

ALTER TABLE "payroll_onboarding_journeys" ADD CONSTRAINT "payroll_onboarding_journeys_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_onboarding_journeys" ADD CONSTRAINT "payroll_onboarding_journeys_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_onboarding_journeys" ADD CONSTRAINT "payroll_onboarding_journeys_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_onboarding_journeys" ADD CONSTRAINT "payroll_onboarding_journeys_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "payroll_workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_onboarding_journeys" ADD CONSTRAINT "payroll_onboarding_journeys_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;