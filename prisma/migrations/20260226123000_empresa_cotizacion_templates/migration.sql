-- Empresa-level PDF template for cotizaciones

-- CreateTable empresa_cotizacion_templates
CREATE TABLE IF NOT EXISTS "empresa_cotizacion_templates" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "defaultSettings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresa_cotizacion_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "empresa_cotizacion_templates_empresaId_key" ON "empresa_cotizacion_templates"("empresaId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_cotizacion_templates_empresaId_fkey'
  ) THEN
    ALTER TABLE "empresa_cotizacion_templates" ADD CONSTRAINT "empresa_cotizacion_templates_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable empresa_cotizacion_template_versions
CREATE TABLE IF NOT EXISTS "empresa_cotizacion_template_versions" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "defaultSettings" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_cotizacion_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "empresa_cotizacion_template_versions_empresaId_createdAt_idx" ON "empresa_cotizacion_template_versions"("empresaId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_cotizacion_template_versions_empresaId_fkey'
  ) THEN
    ALTER TABLE "empresa_cotizacion_template_versions" ADD CONSTRAINT "empresa_cotizacion_template_versions_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'empresa_cotizacion_template_versions_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "empresa_cotizacion_template_versions" ADD CONSTRAINT "empresa_cotizacion_template_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
