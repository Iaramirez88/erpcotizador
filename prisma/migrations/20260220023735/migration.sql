-- DropForeignKey
ALTER TABLE "empresas" DROP CONSTRAINT "empresas_planOwnerUserId_fkey";

-- DropIndex
DROP INDEX "empresas_planOwnerUserId_idx";

-- RenameIndex
ALTER INDEX "billing_reminder_logs_unique_key" RENAME TO "billing_reminder_logs_empresaId_planValidUntil_billingCycle_key";
