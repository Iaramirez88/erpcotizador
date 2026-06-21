CREATE TABLE "payroll_employee_service_cases" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodId" TEXT,
  "assignedToUserId" TEXT,
  "resolvedByUserId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'PORTAL',
  "priority" TEXT NOT NULL DEFAULT 'MEDIA',
  "status" TEXT NOT NULL DEFAULT 'ABIERTO',
  "portalVisibility" BOOLEAN NOT NULL DEFAULT true,
  "employeeRole" TEXT,
  "summary" TEXT NOT NULL,
  "resolution" TEXT,
  "slaHours" INTEGER NOT NULL DEFAULT 24,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "firstResponseAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_employee_service_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_employee_service_cases_empresaId_status_idx" ON "payroll_employee_service_cases"("empresaId", "status");
CREATE INDEX "payroll_employee_service_cases_employeeId_requestedAt_idx" ON "payroll_employee_service_cases"("employeeId", "requestedAt");
CREATE INDEX "payroll_employee_service_cases_periodId_idx" ON "payroll_employee_service_cases"("periodId");
CREATE INDEX "payroll_employee_service_cases_assignedToUserId_idx" ON "payroll_employee_service_cases"("assignedToUserId");
CREATE INDEX "payroll_employee_service_cases_resolvedByUserId_idx" ON "payroll_employee_service_cases"("resolvedByUserId");

ALTER TABLE "payroll_employee_service_cases" ADD CONSTRAINT "payroll_employee_service_cases_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_service_cases" ADD CONSTRAINT "payroll_employee_service_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_service_cases" ADD CONSTRAINT "payroll_employee_service_cases_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_service_cases" ADD CONSTRAINT "payroll_employee_service_cases_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_service_cases" ADD CONSTRAINT "payroll_employee_service_cases_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;