-- CreateTable
CREATE TABLE "material_quantity_discounts" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "minQty" DOUBLE PRECISION NOT NULL,
    "discountPct" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_quantity_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_quantity_discounts_materialId_idx" ON "material_quantity_discounts"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "material_quantity_discounts_materialId_minQty_key" ON "material_quantity_discounts"("materialId", "minQty");

-- AddForeignKey
ALTER TABLE "material_quantity_discounts" ADD CONSTRAINT "material_quantity_discounts_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
