-- Control de capacidad centralizado por plan (límites editables desde super admin).
CREATE TABLE IF NOT EXISTS "plan_limit_settings" (
  "id" TEXT NOT NULL,
  "planTier" "PlanTier" NOT NULL,
  "resource" TEXT NOT NULL,
  "limitValue" INTEGER,
  "period" TEXT NOT NULL DEFAULT 'MONTHLY',
  "overagePolicy" TEXT NOT NULL DEFAULT 'BLOCK',
  "warningPct" INTEGER NOT NULL DEFAULT 80,
  "criticalPct" INTEGER NOT NULL DEFAULT 90,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_limit_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_limit_settings_planTier_resource_key" ON "plan_limit_settings"("planTier", "resource");
CREATE INDEX IF NOT EXISTS "plan_limit_settings_resource_idx" ON "plan_limit_settings"("resource");
