CREATE TABLE "payroll_benefit_offerings" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'PLAN',
  "category" TEXT NOT NULL,
  "vendorName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVO',
  "pricingModel" TEXT NOT NULL DEFAULT 'PUNTOS',
  "pointsCost" INTEGER NOT NULL DEFAULT 0,
  "employerCost" DOUBLE PRECISION,
  "employeeCopay" DOUBLE PRECISION,
  "discountRate" DOUBLE PRECISION,
  "spotlight" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_benefit_offerings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_benefit_offerings_empresaId_status_idx" ON "payroll_benefit_offerings"("empresaId", "status");
CREATE INDEX "payroll_benefit_offerings_kind_idx" ON "payroll_benefit_offerings"("kind");
CREATE INDEX "payroll_benefit_offerings_category_idx" ON "payroll_benefit_offerings"("category");

ALTER TABLE "payroll_benefit_offerings" ADD CONSTRAINT "payroll_benefit_offerings_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;