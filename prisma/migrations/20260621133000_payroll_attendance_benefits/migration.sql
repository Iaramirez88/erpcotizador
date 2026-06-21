CREATE TABLE "payroll_attendance_entries" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodId" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "shiftName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENTE',
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "minutesLate" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "leaveType" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_attendance_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_benefit_requests" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "planName" TEXT,
    "vendorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SOLICITADA',
    "pointsCost" INTEGER NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_benefit_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_attendance_entries_empresaId_entryDate_idx" ON "payroll_attendance_entries"("empresaId", "entryDate");
CREATE INDEX "payroll_attendance_entries_employeeId_entryDate_idx" ON "payroll_attendance_entries"("employeeId", "entryDate");
CREATE INDEX "payroll_attendance_entries_periodId_idx" ON "payroll_attendance_entries"("periodId");

CREATE INDEX "payroll_benefit_requests_empresaId_status_idx" ON "payroll_benefit_requests"("empresaId", "status");
CREATE INDEX "payroll_benefit_requests_employeeId_requestedAt_idx" ON "payroll_benefit_requests"("employeeId", "requestedAt");

ALTER TABLE "payroll_attendance_entries" ADD CONSTRAINT "payroll_attendance_entries_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_attendance_entries" ADD CONSTRAINT "payroll_attendance_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_attendance_entries" ADD CONSTRAINT "payroll_attendance_entries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_attendance_entries" ADD CONSTRAINT "payroll_attendance_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_attendance_entries" ADD CONSTRAINT "payroll_attendance_entries_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_benefit_requests" ADD CONSTRAINT "payroll_benefit_requests_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_benefit_requests" ADD CONSTRAINT "payroll_benefit_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_benefit_requests" ADD CONSTRAINT "payroll_benefit_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_benefit_requests" ADD CONSTRAINT "payroll_benefit_requests_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;