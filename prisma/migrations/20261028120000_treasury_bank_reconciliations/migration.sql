-- CreateTable
CREATE TABLE "treasury_bank_reconciliations" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(24) NOT NULL,
    "bankBalance" DOUBLE PRECISION NOT NULL,
    "ledgerBalance" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "movementsCount" INTEGER NOT NULL DEFAULT 0,
    "pendingMovements" INTEGER NOT NULL DEFAULT 0,
    "pendingEntries" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treasury_bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "treasury_bank_movements" ADD COLUMN "reconciliationId" TEXT;

-- CreateIndex
CREATE INDEX "treasury_bank_reconciliations_empresaId_asOf_idx" ON "treasury_bank_reconciliations"("empresaId", "asOf");

-- CreateIndex
CREATE INDEX "treasury_bank_reconciliations_bankAccountId_asOf_idx" ON "treasury_bank_reconciliations"("bankAccountId", "asOf");

-- CreateIndex
CREATE INDEX "treasury_bank_movements_reconciliationId_idx" ON "treasury_bank_movements"("reconciliationId");

-- AddForeignKey
ALTER TABLE "treasury_bank_reconciliations" ADD CONSTRAINT "treasury_bank_reconciliations_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_reconciliations" ADD CONSTRAINT "treasury_bank_reconciliations_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "treasury_bank_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_reconciliations" ADD CONSTRAINT "treasury_bank_reconciliations_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_bank_movements" ADD CONSTRAINT "treasury_bank_movements_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "treasury_bank_reconciliations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
