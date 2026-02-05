-- Performance indexes (formalized as Prisma migration)
-- Note: these statements are idempotent via IF NOT EXISTS.

-- Índices compuestos para cotizaciones (queries más frecuentes)
CREATE INDEX IF NOT EXISTS "idx_cotizaciones_sede_estado" ON "cotizaciones"("sedeId", "estado");
CREATE INDEX IF NOT EXISTS "idx_cotizaciones_sede_created" ON "cotizaciones"("sedeId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_cotizaciones_estado_created" ON "cotizaciones"("estado", "createdAt" DESC);

-- Índice para items de cotización (evitar N+1)
CREATE INDEX IF NOT EXISTS "idx_items_cotizacion_cot" ON "items_cotizacion"("cotizacionId");

-- Índices compuestos para órdenes de trabajo
CREATE INDEX IF NOT EXISTS "idx_ordenes_sede_estado" ON "ordenes_trabajo"("sedeId", "estado");
CREATE INDEX IF NOT EXISTS "idx_ordenes_sede_created" ON "ordenes_trabajo"("sedeId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_ordenes_estado_created" ON "ordenes_trabajo"("estado", "createdAt" DESC);

-- Índices para clientes (búsquedas frecuentes)
CREATE INDEX IF NOT EXISTS "idx_clientes_empresa_nombre" ON "clientes"("empresaId", "nombre");

-- Índices para materiales
CREATE INDEX IF NOT EXISTS "idx_materiales_empresa_activo" ON "materiales"("empresaId", "activo");

-- Índices para compras
CREATE INDEX IF NOT EXISTS "idx_compras_sede_fecha" ON "compras"("sedeId", "fechaCompra" DESC);
CREATE INDEX IF NOT EXISTS "idx_compras_estado" ON "compras"("estado");
