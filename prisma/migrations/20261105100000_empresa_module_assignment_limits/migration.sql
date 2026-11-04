-- Consumo y cobro opcional por módulo asignado a una empresa (super admin).
-- `limitValue` en NULL significa que se hereda el límite del plan efectivo.
ALTER TABLE "empresa_module_overrides" ADD COLUMN IF NOT EXISTS "limitValue" INTEGER;
ALTER TABLE "empresa_module_overrides" ADD COLUMN IF NOT EXISTS "limitPeriod" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "empresa_module_overrides" ADD COLUMN IF NOT EXISTS "overagePolicy" TEXT;
ALTER TABLE "empresa_module_overrides" ADD COLUMN IF NOT EXISTS "pricePerExtraUnitCOP" INTEGER;
ALTER TABLE "empresa_module_overrides" ADD COLUMN IF NOT EXISTS "notes" TEXT;
