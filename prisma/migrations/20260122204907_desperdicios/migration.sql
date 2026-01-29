-- AlterTable
ALTER TABLE "items_cotizacion" ADD COLUMN     "desperdicioPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sedes" ADD COLUMN     "desperdicioPctDefault" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sede_material_waste" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "desperdicioPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sede_material_waste_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sede_material_waste_materialId_idx" ON "sede_material_waste"("materialId");

-- CreateIndex
CREATE INDEX "sede_material_waste_sedeId_idx" ON "sede_material_waste"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "sede_material_waste_sedeId_materialId_key" ON "sede_material_waste"("sedeId", "materialId");

-- AddForeignKey
ALTER TABLE "sede_material_waste" ADD CONSTRAINT "sede_material_waste_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sede_material_waste" ADD CONSTRAINT "sede_material_waste_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
