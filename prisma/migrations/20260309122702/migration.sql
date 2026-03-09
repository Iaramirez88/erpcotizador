/*
  Warnings:

  - Added the required column `sedeId` to the `custom_product_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "custom_product_requests" ADD COLUMN     "sedeId" TEXT NOT NULL,
ADD COLUMN     "tipo" "TipoMaterial" NOT NULL DEFAULT 'OTRO';

-- AlterTable
ALTER TABLE "materiales" ADD COLUMN     "customOwnerUserId" TEXT,
ADD COLUMN     "customSedeId" TEXT;

-- CreateIndex
CREATE INDEX "custom_product_requests_empresaId_sedeId_status_idx" ON "custom_product_requests"("empresaId", "sedeId", "status");

-- CreateIndex
CREATE INDEX "idx_materiales_empresa_custom_scope" ON "materiales"("empresaId", "customOwnerUserId", "customSedeId");
