CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');
CREATE TYPE "AccountingVoucherType" AS ENUM ('DIARIO', 'INGRESO', 'EGRESO', 'AJUSTE', 'CIERRE', 'APERTURA');
CREATE TYPE "AccountingVoucherStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'VOIDED');

CREATE TABLE "accounting_periods" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "lockedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting_vouchers" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "periodId" TEXT,
  "voucherType" "AccountingVoucherType" NOT NULL,
  "status" "AccountingVoucherStatus" NOT NULL DEFAULT 'DRAFT',
  "code" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT NOT NULL,
  "externalReference" TEXT,
  "thirdPartyName" TEXT,
  "thirdPartyDocument" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'COP',
  "totalDebit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "journalEntryId" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounting_vouchers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting_voucher_lines" (
  "id" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "accountId" TEXT NOT NULL,
  "costCenterId" TEXT,
  "thirdPartyName" TEXT,
  "thirdPartyDocument" TEXT,
  "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "memo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "accounting_voucher_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_periods_empresaId_code_key" ON "accounting_periods"("empresaId", "code");
CREATE INDEX "accounting_periods_empresaId_status_startsAt_idx" ON "accounting_periods"("empresaId", "status", "startsAt");

CREATE UNIQUE INDEX "accounting_vouchers_journalEntryId_key" ON "accounting_vouchers"("journalEntryId");
CREATE UNIQUE INDEX "accounting_vouchers_empresaId_code_key" ON "accounting_vouchers"("empresaId", "code");
CREATE INDEX "accounting_vouchers_empresaId_voucherType_date_idx" ON "accounting_vouchers"("empresaId", "voucherType", "date");
CREATE INDEX "accounting_vouchers_empresaId_status_date_idx" ON "accounting_vouchers"("empresaId", "status", "date");
CREATE INDEX "accounting_vouchers_periodId_idx" ON "accounting_vouchers"("periodId");

CREATE INDEX "accounting_voucher_lines_voucherId_order_idx" ON "accounting_voucher_lines"("voucherId", "order");
CREATE INDEX "accounting_voucher_lines_accountId_idx" ON "accounting_voucher_lines"("accountId");
CREATE INDEX "accounting_voucher_lines_costCenterId_idx" ON "accounting_voucher_lines"("costCenterId");

ALTER TABLE "accounting_periods"
  ADD CONSTRAINT "accounting_periods_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounting_periods"
  ADD CONSTRAINT "accounting_periods_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_periodId_fkey"
  FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_journalEntryId_fkey"
  FOREIGN KEY ("journalEntryId") REFERENCES "accounting_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_vouchers"
  ADD CONSTRAINT "accounting_vouchers_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounting_voucher_lines"
  ADD CONSTRAINT "accounting_voucher_lines_voucherId_fkey"
  FOREIGN KEY ("voucherId") REFERENCES "accounting_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "accounting_voucher_lines"
  ADD CONSTRAINT "accounting_voucher_lines_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_voucher_lines"
  ADD CONSTRAINT "accounting_voucher_lines_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "accounting_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;