CREATE TYPE "RestaurantProductRole" AS ENUM ('INGREDIENT', 'PREPARATION', 'PHYSICAL_PRODUCT');

ALTER TABLE "materiales"
ADD COLUMN "restaurantRole" "RestaurantProductRole";

ALTER TABLE "items_compra"
ADD COLUMN "materialId" TEXT;

CREATE INDEX "items_compra_materialId_idx" ON "items_compra"("materialId");

ALTER TABLE "items_compra"
ADD CONSTRAINT "items_compra_materialId_fkey"
FOREIGN KEY ("materialId") REFERENCES "materiales"("id")
ON DELETE SET NULL ON UPDATE CASCADE;