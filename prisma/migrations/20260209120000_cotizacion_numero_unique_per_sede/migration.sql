-- Make Cotizacion.numero unique per sede (multi-tenant safe)

-- Previous schema had a global unique constraint/index on numero.
-- This caused collisions across different sedes/empresas when they generate the same formatted number.

-- Drop the old global unique constraint/index if present
ALTER TABLE "cotizaciones" DROP CONSTRAINT IF EXISTS "cotizaciones_numero_key";
DROP INDEX IF EXISTS "cotizaciones_numero_key";
DROP INDEX IF EXISTS "Cotizacion_numero_key";

-- Add composite uniqueness scoped to sede
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cotizaciones_sede_numero" ON "cotizaciones" ("sedeId", "numero");
