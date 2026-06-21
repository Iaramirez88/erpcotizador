CREATE TABLE "payroll_training_assignments" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT,
  "ownerUserId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANIFICADA',
  "modality" TEXT NOT NULL DEFAULT 'VIRTUAL',
  "provider" TEXT,
  "durationHours" INTEGER NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "score" DOUBLE PRECISION,
  "certificateUrl" TEXT,
  "summary" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_training_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_training_assignments_empresaId_status_idx" ON "payroll_training_assignments"("empresaId", "status");
CREATE INDEX "payroll_training_assignments_employeeId_idx" ON "payroll_training_assignments"("employeeId");
CREATE INDEX "payroll_training_assignments_ownerUserId_idx" ON "payroll_training_assignments"("ownerUserId");
CREATE INDEX "payroll_training_assignments_category_idx" ON "payroll_training_assignments"("category");

ALTER TABLE "payroll_training_assignments" ADD CONSTRAINT "payroll_training_assignments_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_training_assignments" ADD CONSTRAINT "payroll_training_assignments_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_training_assignments" ADD CONSTRAINT "payroll_training_assignments_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;