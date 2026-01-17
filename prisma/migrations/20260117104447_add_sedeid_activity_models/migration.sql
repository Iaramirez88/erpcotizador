-- AlterTable
ALTER TABLE "compras" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "document_scans" ADD COLUMN     "sedeId" TEXT;

-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN     "sedeId" TEXT;

-- CreateIndex
CREATE INDEX "compras_sedeId_idx" ON "compras"("sedeId");

-- CreateIndex
CREATE INDEX "cotizaciones_sedeId_idx" ON "cotizaciones"("sedeId");

-- CreateIndex
CREATE INDEX "document_scans_sedeId_idx" ON "document_scans"("sedeId");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_sedeId_idx" ON "ordenes_trabajo"("sedeId");

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compras" ADD CONSTRAINT "compras_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_scans" ADD CONSTRAINT "document_scans_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
