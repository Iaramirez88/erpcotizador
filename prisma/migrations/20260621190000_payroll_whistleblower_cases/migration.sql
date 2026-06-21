CREATE TABLE IF NOT EXISTS "payroll_whistleblower_cases" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT,
  "assignedToUserId" TEXT,
  "resolvedByUserId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIA',
  "status" TEXT NOT NULL DEFAULT 'RECIBIDA',
  "anonymousReport" BOOLEAN NOT NULL DEFAULT false,
  "confidentialityLevel" TEXT NOT NULL DEFAULT 'ALTA',
  "reportedChannel" TEXT NOT NULL DEFAULT 'PORTAL',
  "reporterName" TEXT,
  "reporterEmail" TEXT,
  "reporterRole" TEXT,
  "accusedArea" TEXT,
  "occurredAt" TIMESTAMP(3),
  "summary" TEXT NOT NULL,
  "evidenceSummary" TEXT,
  "resolution" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT true,
  "firstResponseAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_whistleblower_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_whistleblower_cases_empresaId_status_idx" ON "payroll_whistleblower_cases"("empresaId", "status");
CREATE INDEX IF NOT EXISTS "payroll_whistleblower_cases_employeeId_createdAt_idx" ON "payroll_whistleblower_cases"("employeeId", "createdAt");
CREATE INDEX IF NOT EXISTS "payroll_whistleblower_cases_assignedToUserId_idx" ON "payroll_whistleblower_cases"("assignedToUserId");
CREATE INDEX IF NOT EXISTS "payroll_whistleblower_cases_resolvedByUserId_idx" ON "payroll_whistleblower_cases"("resolvedByUserId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_whistleblower_cases_empresaId_fkey') THEN
    ALTER TABLE "payroll_whistleblower_cases" ADD CONSTRAINT "payroll_whistleblower_cases_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_whistleblower_cases_employeeId_fkey') THEN
    ALTER TABLE "payroll_whistleblower_cases" ADD CONSTRAINT "payroll_whistleblower_cases_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_whistleblower_cases_assignedToUserId_fkey') THEN
    ALTER TABLE "payroll_whistleblower_cases" ADD CONSTRAINT "payroll_whistleblower_cases_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_whistleblower_cases_resolvedByUserId_fkey') THEN
    ALTER TABLE "payroll_whistleblower_cases" ADD CONSTRAINT "payroll_whistleblower_cases_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;