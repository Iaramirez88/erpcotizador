BEGIN;

CREATE TABLE IF NOT EXISTS public."plan_module_price_settings" (
  "id" TEXT PRIMARY KEY,
  "module" public."ModuleKey" NOT NULL UNIQUE,
  "priceCOP" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "plan_module_price_settings_module_idx"
  ON public."plan_module_price_settings" ("module");

INSERT INTO public."plan_module_price_settings" ("id", "module", "priceCOP")
VALUES
  ('pmps-cotizador', 'COTIZADOR', 30000),
  ('pmps-cotizaciones', 'COTIZACIONES', 45000),
  ('pmps-clientes', 'CLIENTES', 20000),
  ('pmps-remisiones', 'REMISIONES', 18000),
  ('pmps-crm', 'CRM', 70000),
  ('pmps-ordenes', 'ORDENES', 28000),
  ('pmps-materiales', 'MATERIALES', 22000),
  ('pmps-escaneos', 'ESCANEOS', 18000),
  ('pmps-inventario', 'INVENTARIO', 40000),
  ('pmps-proveedores', 'PROVEEDORES', 24000),
  ('pmps-compras', 'COMPRAS', 32000),
  ('pmps-pos', 'POS', 50000),
  ('pmps-reportes', 'REPORTES', 24000),
  ('pmps-contabilidad', 'CONTABILIDAD', 85000)
ON CONFLICT ("module") DO NOTHING;

COMMIT;