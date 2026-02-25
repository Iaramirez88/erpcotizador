-- CreateEnum
CREATE TYPE "AccountingAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountingNormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AccountingPostingSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "AccountingEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "AccountingEventType" AS ENUM ('POS_INVOICE', 'POS_RETURN', 'COMPRA', 'COMPRA_PAGO', 'DIAN_DOCUMENT', 'MANUAL');

-- CreateEnum
CREATE TYPE "AccountingAmountKey" AS ENUM ('SUBTOTAL', 'IVA', 'DESCUENTO', 'RETENCION', 'RETEICA', 'AUTORETENCION', 'TOTAL');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'CONTABILIDAD';

-- CreateTable
CREATE TABLE "accounting_accounts" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountingAccountType" NOT NULL,
    "normalBalance" "AccountingNormalBalance" NOT NULL,
    "parentId" TEXT,
    "isPosting" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_cost_centers" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_rules" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "eventType" "AccountingEventType" NOT NULL,
    "documentType" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_rule_lines" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "side" "AccountingPostingSide" NOT NULL,
    "accountId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "amountKey" "AccountingAmountKey" NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "memoTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_rule_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journal_entries" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "status" "AccountingEntryStatus" NOT NULL DEFAULT 'POSTED',
    "eventType" "AccountingEventType" NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceExtra" JSONB NOT NULL DEFAULT '{}',
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "totalDebit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounting_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_bank_accounts" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accountingAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_bank_movements" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_bank_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_accounts_empresaId_type_idx" ON "accounting_accounts"("empresaId", "type");

-- CreateIndex
CREATE INDEX "accounting_accounts_empresaId_parentId_idx" ON "accounting_accounts"("empresaId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_empresaId_code_key" ON "accounting_accounts"("empresaId", "code");

-- CreateIndex
CREATE INDEX "accounting_cost_centers_empresaId_idx" ON "accounting_cost_centers"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_cost_centers_empresaId_code_key" ON "accounting_cost_centers"("empresaId", "code");

-- CreateIndex
CREATE INDEX "accounting_rules_empresaId_eventType_priority_idx" ON "accounting_rules"("empresaId", "eventType", "priority");

-- CreateIndex
CREATE INDEX "accounting_rules_empresaId_isActive_idx" ON "accounting_rules"("empresaId", "isActive");

-- CreateIndex
CREATE INDEX "accounting_rule_lines_ruleId_order_idx" ON "accounting_rule_lines"("ruleId", "order");

-- CreateIndex
CREATE INDEX "accounting_rule_lines_accountId_idx" ON "accounting_rule_lines"("accountId");

-- CreateIndex
CREATE INDEX "accounting_journal_entries_empresaId_date_idx" ON "accounting_journal_entries"("empresaId", "date");

-- CreateIndex
CREATE INDEX "accounting_journal_entries_empresaId_eventType_date_idx" ON "accounting_journal_entries"("empresaId", "eventType", "date");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journal_entries_empresaId_referenceType_referenc_key" ON "accounting_journal_entries"("empresaId", "referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "accounting_journal_lines_entryId_idx" ON "accounting_journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "accounting_journal_lines_accountId_idx" ON "accounting_journal_lines"("accountId");

-- CreateIndex
CREATE INDEX "accounting_journal_lines_costCenterId_idx" ON "accounting_journal_lines"("costCenterId");

-- CreateIndex
CREATE INDEX "treasury_bank_accounts_empresaId_idx" ON "treasury_bank_accounts"("empresaId");

-- CreateIndex
CREATE INDEX "treasury_bank_movements_empresaId_date_idx" ON "treasury_bank_movements"("empresaId", "date");

-- CreateIndex
CREATE INDEX "treasury_bank_movements_bankAccountId_date_idx" ON "treasury_bank_movements"("bankAccountId", "date");

-- CreateIndex
CREATE INDEX "treasury_bank_movements_journalEntryId_idx" ON "treasury_bank_movements"("journalEntryId");

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_cost_centers" ADD CONSTRAINT "accounting_cost_centers_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_rules" ADD CONSTRAINT "accounting_rules_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_rule_lines" ADD CONSTRAINT "accounting_rule_lines_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "accounting_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_rule_lines" ADD CONSTRAINT "accounting_rule_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_rule_lines" ADD CONSTRAINT "accounting_rule_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "accounting_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_entries" ADD CONSTRAINT "accounting_journal_entries_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_entries" ADD CONSTRAINT "accounting_journal_entries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "accounting_journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "accounting_cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_accounts" ADD CONSTRAINT "treasury_bank_accounts_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_accounts" ADD CONSTRAINT "treasury_bank_accounts_accountingAccountId_fkey" FOREIGN KEY ("accountingAccountId") REFERENCES "accounting_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_movements" ADD CONSTRAINT "treasury_bank_movements_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_movements" ADD CONSTRAINT "treasury_bank_movements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "treasury_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_movements" ADD CONSTRAINT "treasury_bank_movements_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "accounting_journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
