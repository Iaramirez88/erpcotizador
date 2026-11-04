-- Facturación solo por módulos (sin plan base) + capacidad/consumo configurable por recurso.
-- `moduleOnlyBilling` = true: no se cobra plan base y cada módulo habilitado se factura aparte.
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "moduleOnlyBilling" BOOLEAN NOT NULL DEFAULT false;

-- Límites y cobro por consumo medidos por recurso (cotizaciones, productos, sedes, usuarios…).
CREATE TABLE IF NOT EXISTS "empresa_capacity_overrides" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "limitValue" INTEGER,
    "limitPeriod" TEXT NOT NULL DEFAULT 'MONTHLY',
    "overagePolicy" TEXT,
    "pricePerExtraUnitCOP" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_capacity_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "empresa_capacity_overrides_empresaId_resource_key"
    ON "empresa_capacity_overrides"("empresaId", "resource");

CREATE INDEX IF NOT EXISTS "empresa_capacity_overrides_empresaId_idx"
    ON "empresa_capacity_overrides"("empresaId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'empresa_capacity_overrides_empresaId_fkey'
    ) THEN
        ALTER TABLE "empresa_capacity_overrides"
            ADD CONSTRAINT "empresa_capacity_overrides_empresaId_fkey"
            FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
