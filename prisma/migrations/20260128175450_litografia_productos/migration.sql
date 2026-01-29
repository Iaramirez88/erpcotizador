-- AlterTable
ALTER TABLE "litografia_flyer_rates" ADD COLUMN     "productoId" TEXT;

-- CreateTable
CREATE TABLE "litografia_productos" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "formatoKey" TEXT NOT NULL,
    "tintas" INTEGER NOT NULL,
    "paperRateId" TEXT NOT NULL,
    "finishOptionId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "litografia_productos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "litografia_productos_empresaId_activo_idx" ON "litografia_productos"("empresaId", "activo");

-- CreateIndex
CREATE INDEX "litografia_productos_empresaId_formatoKey_tintas_idx" ON "litografia_productos"("empresaId", "formatoKey", "tintas");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_productos_empresaId_nombre_key" ON "litografia_productos"("empresaId", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_productos_empresaId_paperRateId_formatoKey_tinta_key" ON "litografia_productos"("empresaId", "paperRateId", "formatoKey", "tintas", "finishOptionId");

-- CreateIndex
CREATE INDEX "litografia_flyer_rates_empresaId_productoId_activo_idx" ON "litografia_flyer_rates"("empresaId", "productoId", "activo");

-- AddForeignKey
ALTER TABLE "litografia_productos" ADD CONSTRAINT "litografia_productos_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litografia_productos" ADD CONSTRAINT "litografia_productos_paperRateId_fkey" FOREIGN KEY ("paperRateId") REFERENCES "litografia_paper_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litografia_productos" ADD CONSTRAINT "litografia_productos_finishOptionId_fkey" FOREIGN KEY ("finishOptionId") REFERENCES "litografia_finish_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litografia_flyer_rates" ADD CONSTRAINT "litografia_flyer_rates_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "litografia_productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
