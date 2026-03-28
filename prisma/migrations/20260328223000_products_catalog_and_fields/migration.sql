DO $$
BEGIN
  CREATE TYPE "ProductCustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "materiales"
ADD COLUMN "tipoNombre" TEXT,
ADD COLUMN "extraFields" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "product_type_options" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "baseTipo" "TipoMaterial" NOT NULL DEFAULT 'OTRO',
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_type_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_category_options" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_category_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_custom_field_definitions" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "fieldType" "ProductCustomFieldType" NOT NULL DEFAULT 'TEXT',
  "helpText" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "activo" BOOLEAN NOT NULL DEFAULT true,
  "optionsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_custom_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_product_type_options_empresa_nombre" ON "product_type_options"("empresaId", "nombre");
CREATE INDEX "idx_product_type_options_empresa_activo" ON "product_type_options"("empresaId", "activo");
CREATE UNIQUE INDEX "uq_product_category_options_empresa_nombre" ON "product_category_options"("empresaId", "nombre");
CREATE INDEX "idx_product_category_options_empresa_activo" ON "product_category_options"("empresaId", "activo");
CREATE UNIQUE INDEX "uq_product_custom_field_defs_empresa_key" ON "product_custom_field_definitions"("empresaId", "key");
CREATE INDEX "idx_product_custom_field_defs_empresa_activo" ON "product_custom_field_definitions"("empresaId", "activo");

ALTER TABLE "product_type_options"
ADD CONSTRAINT "product_type_options_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_category_options"
ADD CONSTRAINT "product_category_options_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_custom_field_definitions"
ADD CONSTRAINT "product_custom_field_definitions_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
