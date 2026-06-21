CREATE TABLE "payroll_employee_documents" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BORRADOR',
  "signatureRequired" BOOLEAN NOT NULL DEFAULT true,
  "signatureStatus" TEXT NOT NULL DEFAULT 'PENDIENTE',
  "visibleInPortal" BOOLEAN NOT NULL DEFAULT true,
  "deliveryChannel" TEXT NOT NULL DEFAULT 'PORTAL',
  "fileFormat" TEXT NOT NULL DEFAULT 'PDF',
  "fileUrl" TEXT,
  "requestedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "notes" TEXT,
  "signedById" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_employee_documents_empresaId_status_idx" ON "payroll_employee_documents"("empresaId", "status");
CREATE INDEX "payroll_employee_documents_employeeId_createdAt_idx" ON "payroll_employee_documents"("employeeId", "createdAt");
CREATE INDEX "payroll_employee_documents_periodId_idx" ON "payroll_employee_documents"("periodId");
CREATE INDEX "payroll_employee_documents_signatureStatus_signatureRequired_idx" ON "payroll_employee_documents"("signatureStatus", "signatureRequired");

ALTER TABLE "payroll_employee_documents" ADD CONSTRAINT "payroll_employee_documents_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_documents" ADD CONSTRAINT "payroll_employee_documents_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_documents" ADD CONSTRAINT "payroll_employee_documents_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_employee_documents" ADD CONSTRAINT "payroll_employee_documents_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;