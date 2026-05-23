ALTER TABLE "empresas"
  ADD COLUMN "businessType" TEXT,
  ADD COLUMN "onboardingStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN "onboardingData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "dashboardConfig" JSONB NOT NULL DEFAULT '{}'::jsonb;