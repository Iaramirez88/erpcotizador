CREATE TABLE IF NOT EXISTS "plan_catalog_settings" (
  "id" TEXT NOT NULL,
  "planTier" "PlanTier" NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT NOT NULL,
  "precioMensualCOP" INTEGER NOT NULL,
  "tagline" TEXT NOT NULL,
  "forWho" TEXT NOT NULL,
  "incluyeJson" JSONB NOT NULL,
  "alcanceJson" JSONB NOT NULL,
  "storageLimitGb" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_catalog_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_catalog_settings_planTier_key" ON "plan_catalog_settings"("planTier");
CREATE INDEX IF NOT EXISTS "plan_catalog_settings_active_displayOrder_idx" ON "plan_catalog_settings"("active", "displayOrder");