CREATE TABLE "plan_module_price_settings" (
  "id" TEXT NOT NULL,
  "module" "ModuleKey" NOT NULL,
  "priceCOP" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "plan_module_price_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_module_price_settings_module_key" ON "plan_module_price_settings"("module");
CREATE INDEX "plan_module_price_settings_module_idx" ON "plan_module_price_settings"("module");