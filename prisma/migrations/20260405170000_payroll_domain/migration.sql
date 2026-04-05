ALTER TYPE "AccountingEventType" ADD VALUE IF NOT EXISTS 'PAYROLL_PERIOD';
ALTER TYPE "AccountingEventType" ADD VALUE IF NOT EXISTS 'PAYROLL_PAYMENT';
ALTER TYPE "AccountingEventType" ADD VALUE IF NOT EXISTS 'PAYROLL_SETTLEMENT';

ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'DEVENGADO';
ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'DEDUCCIONES';
ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'NETO_PAGAR';
ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'SEGURIDAD_SOCIAL_EMPLEADO';
ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'SEGURIDAD_SOCIAL_EMPRESA';
ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'PARAFISCALES';
ALTER TYPE "AccountingAmountKey" ADD VALUE IF NOT EXISTS 'PROVISIONES';

CREATE TYPE "PayrollEmployeeStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'RETIRED');
CREATE TYPE "PayrollContractType" AS ENUM ('INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'APRENDIZAJE', 'PRESTACION');
CREATE TYPE "PayrollContractStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'FINALIZED');
CREATE TYPE "PayrollFrequency" AS ENUM ('QUINCENAL', 'MENSUAL', 'SEMANAL', 'JORNAL');
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('BORRADOR', 'CALCULADA', 'PAGADA', 'CERRADA');
CREATE TYPE "PayrollAccountingStatus" AS ENUM ('PENDIENTE', 'CONTABILIZADA');
CREATE TYPE "PayrollNoveltyType" AS ENUM ('INCAPACIDAD', 'HORA_EXTRA', 'AUSENCIA', 'LICENCIA', 'BONIFICACION', 'DESCUENTO', 'RECARGO', 'COMISION', 'EMBARGO', 'PRESTAMO', 'VACACIONES');
CREATE TYPE "PayrollNoveltyStatus" AS ENUM ('RADICADA', 'VALIDADA', 'APLICADA', 'RECHAZADA');
CREATE TYPE "PayrollSettlementReason" AS ENUM ('RENUNCIA', 'TERMINACION', 'MUTUO_ACUERDO', 'JUSTA_CAUSA', 'FIN_CONTRATO');
CREATE TYPE "PayrollSettlementStatus" AS ENUM ('PENDIENTE', 'LIQUIDADA', 'PAGADA', 'ANULADA');
CREATE TYPE "PayrollConceptCategory" AS ENUM ('DEVENGO', 'DEDUCCION', 'APORTE_EMPLEADO', 'APORTE_EMPRESA', 'PARAFISCAL', 'PROVISION');
CREATE TYPE "PayrollPayslipDeliveryChannel" AS ENUM ('PORTAL', 'EMAIL', 'PDF', 'FISICO');

CREATE TABLE "payroll_employees" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "userId" TEXT,
  "costCenterId" TEXT,
  "code" TEXT NOT NULL,
  "documentType" TEXT NOT NULL DEFAULT 'CC',
  "documentNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "middleName" TEXT,
  "lastName" TEXT NOT NULL,
  "secondLastName" TEXT,
  "personalEmail" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "city" TEXT,
  "jobTitle" TEXT NOT NULL,
  "hireDate" TIMESTAMP(3) NOT NULL,
  "retirementDate" TIMESTAMP(3),
  "status" "PayrollEmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
  "bankName" TEXT,
  "bankAccountType" TEXT,
  "bankAccountNumber" TEXT,
  "epsEntity" TEXT,
  "pensionEntity" TEXT,
  "cesantiasEntity" TEXT,
  "compensationFundEntity" TEXT,
  "arlEntity" TEXT,
  "arlRiskClass" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_contracts" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "costCenterId" TEXT,
  "contractType" "PayrollContractType" NOT NULL,
  "status" "PayrollContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "frequency" "PayrollFrequency" NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "baseSalary" DOUBLE PRECISION NOT NULL,
  "variableSalary" BOOLEAN NOT NULL DEFAULT false,
  "integralSalary" BOOLEAN NOT NULL DEFAULT false,
  "transportationAllowance" BOOLEAN NOT NULL DEFAULT false,
  "payrollGroup" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_contracts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_periods" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "frequency" "PayrollFrequency" NOT NULL,
  "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'BORRADOR',
  "accountingStatus" "PayrollAccountingStatus" NOT NULL DEFAULT 'PENDIENTE',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),
  "employeesCount" INTEGER NOT NULL DEFAULT 0,
  "grossTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deductionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "socialSecurityTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "parafiscalesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "provisionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_period_items" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "costCenterId" TEXT,
  "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'BORRADOR',
  "workedDays" INTEGER NOT NULL DEFAULT 0,
  "paidDays" INTEGER NOT NULL DEFAULT 0,
  "grossTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "deductionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "employeeSocialSecurityTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "employerSocialSecurityTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "parafiscalesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "provisionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_period_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_novelties" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractId" TEXT,
  "periodId" TEXT,
  "type" "PayrollNoveltyType" NOT NULL,
  "status" "PayrollNoveltyStatus" NOT NULL DEFAULT 'RADICADA',
  "source" TEXT NOT NULL DEFAULT 'MANUAL',
  "detail" TEXT NOT NULL,
  "amount" DOUBLE PRECISION,
  "quantity" DOUBLE PRECISION,
  "days" DOUBLE PRECISION,
  "occurredOn" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "supportNumber" TEXT,
  "supportUrl" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_novelties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_concept_lines" (
  "id" TEXT NOT NULL,
  "periodItemId" TEXT NOT NULL,
  "noveltyId" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "category" "PayrollConceptCategory" NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION,
  "baseAmount" DOUBLE PRECISION,
  "rate" DOUBLE PRECISION,
  "amount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_concept_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_settlements" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "contractId" TEXT,
  "periodId" TEXT,
  "reason" "PayrollSettlementReason" NOT NULL,
  "status" "PayrollSettlementStatus" NOT NULL DEFAULT 'PENDIENTE',
  "retirementDate" TIMESTAMP(3) NOT NULL,
  "liquidationDate" TIMESTAMP(3),
  "paymentDate" TIMESTAMP(3),
  "workedDays" INTEGER NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accountingStatus" "PayrollAccountingStatus" NOT NULL DEFAULT 'PENDIENTE',
  "notes" TEXT,
  "createdById" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_settlement_lines" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "category" "PayrollConceptCategory" NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_settlement_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payroll_payslips" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodId" TEXT NOT NULL,
  "periodItemId" TEXT,
  "deliveryChannel" "PayrollPayslipDeliveryChannel" NOT NULL DEFAULT 'PORTAL',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "signedAt" TIMESTAMP(3),
  "fileUrl" TEXT,
  "netTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_payslips_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_employees_userId_key" ON "payroll_employees"("userId");
CREATE UNIQUE INDEX "payroll_employees_empresaId_code_key" ON "payroll_employees"("empresaId", "code");
CREATE UNIQUE INDEX "payroll_employees_empresaId_documentType_documentNumber_key" ON "payroll_employees"("empresaId", "documentType", "documentNumber");
CREATE INDEX "payroll_employees_empresaId_status_idx" ON "payroll_employees"("empresaId", "status");
CREATE INDEX "payroll_employees_sedeId_status_idx" ON "payroll_employees"("sedeId", "status");
CREATE INDEX "payroll_employees_costCenterId_idx" ON "payroll_employees"("costCenterId");

CREATE INDEX "payroll_contracts_empresaId_status_idx" ON "payroll_contracts"("empresaId", "status");
CREATE INDEX "payroll_contracts_employeeId_status_idx" ON "payroll_contracts"("employeeId", "status");
CREATE INDEX "payroll_contracts_sedeId_idx" ON "payroll_contracts"("sedeId");
CREATE INDEX "payroll_contracts_costCenterId_idx" ON "payroll_contracts"("costCenterId");

CREATE UNIQUE INDEX "payroll_periods_empresaId_code_key" ON "payroll_periods"("empresaId", "code");
CREATE INDEX "payroll_periods_empresaId_frequency_startsAt_idx" ON "payroll_periods"("empresaId", "frequency", "startsAt");
CREATE INDEX "payroll_periods_empresaId_status_idx" ON "payroll_periods"("empresaId", "status");
CREATE INDEX "payroll_periods_sedeId_idx" ON "payroll_periods"("sedeId");

CREATE UNIQUE INDEX "payroll_period_items_periodId_employeeId_key" ON "payroll_period_items"("periodId", "employeeId");
CREATE INDEX "payroll_period_items_empresaId_periodId_idx" ON "payroll_period_items"("empresaId", "periodId");
CREATE INDEX "payroll_period_items_employeeId_idx" ON "payroll_period_items"("employeeId");
CREATE INDEX "payroll_period_items_contractId_idx" ON "payroll_period_items"("contractId");
CREATE INDEX "payroll_period_items_costCenterId_idx" ON "payroll_period_items"("costCenterId");

CREATE INDEX "payroll_novelties_empresaId_type_status_idx" ON "payroll_novelties"("empresaId", "type", "status");
CREATE INDEX "payroll_novelties_employeeId_createdAt_idx" ON "payroll_novelties"("employeeId", "createdAt");
CREATE INDEX "payroll_novelties_periodId_idx" ON "payroll_novelties"("periodId");
CREATE INDEX "payroll_novelties_contractId_idx" ON "payroll_novelties"("contractId");

CREATE INDEX "payroll_concept_lines_periodItemId_order_idx" ON "payroll_concept_lines"("periodItemId", "order");
CREATE INDEX "payroll_concept_lines_noveltyId_idx" ON "payroll_concept_lines"("noveltyId");

CREATE INDEX "payroll_settlements_empresaId_status_idx" ON "payroll_settlements"("empresaId", "status");
CREATE INDEX "payroll_settlements_employeeId_retirementDate_idx" ON "payroll_settlements"("employeeId", "retirementDate");
CREATE INDEX "payroll_settlements_periodId_idx" ON "payroll_settlements"("periodId");

CREATE INDEX "payroll_settlement_lines_settlementId_order_idx" ON "payroll_settlement_lines"("settlementId", "order");

CREATE UNIQUE INDEX "payroll_payslips_periodItemId_key" ON "payroll_payslips"("periodItemId");
CREATE UNIQUE INDEX "payroll_payslips_periodId_employeeId_key" ON "payroll_payslips"("periodId", "employeeId");
CREATE INDEX "payroll_payslips_empresaId_generatedAt_idx" ON "payroll_payslips"("empresaId", "generatedAt");
CREATE INDEX "payroll_payslips_employeeId_generatedAt_idx" ON "payroll_payslips"("employeeId", "generatedAt");

ALTER TABLE "payroll_employees"
  ADD CONSTRAINT "payroll_employees_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_employees"
  ADD CONSTRAINT "payroll_employees_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_employees"
  ADD CONSTRAINT "payroll_employees_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_employees"
  ADD CONSTRAINT "payroll_employees_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "accounting_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_contracts"
  ADD CONSTRAINT "payroll_contracts_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_contracts"
  ADD CONSTRAINT "payroll_contracts_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_contracts"
  ADD CONSTRAINT "payroll_contracts_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_contracts"
  ADD CONSTRAINT "payroll_contracts_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "accounting_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_periods"
  ADD CONSTRAINT "payroll_periods_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_period_items"
  ADD CONSTRAINT "payroll_period_items_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_period_items"
  ADD CONSTRAINT "payroll_period_items_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_period_items"
  ADD CONSTRAINT "payroll_period_items_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_period_items"
  ADD CONSTRAINT "payroll_period_items_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "payroll_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_period_items"
  ADD CONSTRAINT "payroll_period_items_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "accounting_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "payroll_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_novelties"
  ADD CONSTRAINT "payroll_novelties_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_concept_lines"
  ADD CONSTRAINT "payroll_concept_lines_periodItemId_fkey"
  FOREIGN KEY ("periodItemId") REFERENCES "payroll_period_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_concept_lines"
  ADD CONSTRAINT "payroll_concept_lines_noveltyId_fkey"
  FOREIGN KEY ("noveltyId") REFERENCES "payroll_novelties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_settlements"
  ADD CONSTRAINT "payroll_settlements_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_settlements"
  ADD CONSTRAINT "payroll_settlements_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_settlements"
  ADD CONSTRAINT "payroll_settlements_contractId_fkey"
  FOREIGN KEY ("contractId") REFERENCES "payroll_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_settlements"
  ADD CONSTRAINT "payroll_settlements_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_settlements"
  ADD CONSTRAINT "payroll_settlements_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payroll_settlement_lines"
  ADD CONSTRAINT "payroll_settlement_lines_settlementId_fkey"
  FOREIGN KEY ("settlementId") REFERENCES "payroll_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "payroll_employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_payslips"
  ADD CONSTRAINT "payroll_payslips_periodItemId_fkey"
  FOREIGN KEY ("periodItemId") REFERENCES "payroll_period_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;