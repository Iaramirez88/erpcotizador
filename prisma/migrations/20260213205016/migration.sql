-- CreateTable
CREATE TABLE "plan_module_settings" (
    "id" TEXT NOT NULL,
    "planTier" "PlanTier" NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_module_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_module_settings_module_idx" ON "plan_module_settings"("module");

-- CreateIndex
CREATE UNIQUE INDEX "plan_module_settings_planTier_module_key" ON "plan_module_settings"("planTier", "module");
