-- Migration: Add performance indexes
-- Created: 2026-01-29

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

-- Índices para búsqueda de texto (opcional, requiere extensión pg_trgm)
-- Descomenta si necesitas búsquedas de texto más rápidas:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS "idx_clientes_nombre_gin" ON "clientes" USING gin("nombre" gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS "idx_clientes_email_gin" ON "clientes" USING gin("email" gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS "idx_materiales_nombre_gin" ON "materiales" USING gin("nombre" gin_trgm_ops);
