-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "trialStartedAt" TIMESTAMP(3),
ADD COLUMN     "trialTier" "PlanTier",
ADD COLUMN     "trialValidUntil" TIMESTAMP(3);
