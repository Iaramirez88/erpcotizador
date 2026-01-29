-- CreateTable
CREATE TABLE "terminados" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadAplicacion" TEXT NOT NULL,
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "empresaId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_cotizacion_terminados" (
    "id" TEXT NOT NULL,
    "itemCotizacionId" TEXT NOT NULL,
    "terminadoId" TEXT NOT NULL,
    "unidadAplicacion" TEXT NOT NULL,
    "baseCantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_cotizacion_terminados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terminados_empresaId_nombre_key" ON "terminados"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "terminados_empresaId_idx" ON "terminados"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "item_cotizacion_terminados_itemCotizacionId_terminadoId_key" ON "item_cotizacion_terminados"("itemCotizacionId", "terminadoId");

-- CreateIndex
CREATE INDEX "item_cotizacion_terminados_terminadoId_idx" ON "item_cotizacion_terminados"("terminadoId");

-- CreateIndex
CREATE INDEX "item_cotizacion_terminados_itemCotizacionId_idx" ON "item_cotizacion_terminados"("itemCotizacionId");

-- AddForeignKey
ALTER TABLE "terminados" ADD CONSTRAINT "terminados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_cotizacion_terminados" ADD CONSTRAINT "item_cotizacion_terminados_itemCotizacionId_fkey" FOREIGN KEY ("itemCotizacionId") REFERENCES "items_cotizacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_cotizacion_terminados" ADD CONSTRAINT "item_cotizacion_terminados_terminadoId_fkey" FOREIGN KEY ("terminadoId") REFERENCES "terminados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
