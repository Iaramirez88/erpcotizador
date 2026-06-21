CREATE TABLE IF NOT EXISTS "payroll_performance_reviews" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT,
  "ownerUserId" TEXT,
  "cycleTitle" TEXT NOT NULL,
  "reviewType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BORRADOR',
  "managerName" TEXT,
  "competencyFocus" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "targetScore" DOUBLE PRECISION,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "developmentPlan" TEXT,
  "summary" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_performance_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_performance_reviews_empresaId_status_idx" ON "payroll_performance_reviews"("empresaId", "status");
CREATE INDEX IF NOT EXISTS "payroll_performance_reviews_employeeId_idx" ON "payroll_performance_reviews"("employeeId");
CREATE INDEX IF NOT EXISTS "payroll_performance_reviews_ownerUserId_idx" ON "payroll_performance_reviews"("ownerUserId");
CREATE INDEX IF NOT EXISTS "payroll_performance_reviews_reviewType_idx" ON "payroll_performance_reviews"("reviewType");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_performance_reviews_empresaId_fkey') THEN
    ALTER TABLE "payroll_performance_reviews" ADD CONSTRAINT "payroll_performance_reviews_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_performance_reviews_employeeId_fkey') THEN
    ALTER TABLE "payroll_performance_reviews" ADD CONSTRAINT "payroll_performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_performance_reviews_ownerUserId_fkey') THEN
    ALTER TABLE "payroll_performance_reviews" ADD CONSTRAINT "payroll_performance_reviews_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;