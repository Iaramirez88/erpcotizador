-- CreateIndex
CREATE INDEX "idx_clientes_empresa_nombre" ON "clientes"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "idx_compras_sede_fecha" ON "compras"("sedeId", "fechaCompra");

-- CreateIndex
CREATE INDEX "idx_cotizaciones_estado_created" ON "cotizaciones"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "idx_cotizaciones_sede_created" ON "cotizaciones"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_cotizaciones_sede_estado" ON "cotizaciones"("sedeId", "estado");

-- CreateIndex
CREATE INDEX "idx_items_cotizacion_cot" ON "items_cotizacion"("cotizacionId");

-- CreateIndex
CREATE INDEX "idx_materiales_empresa_activo" ON "materiales"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "idx_ordenes_estado_created" ON "ordenes_trabajo"("estado", "createdAt");

-- CreateIndex
CREATE INDEX "idx_ordenes_sede_created" ON "ordenes_trabajo"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_ordenes_sede_estado" ON "ordenes_trabajo"("sedeId", "estado");
