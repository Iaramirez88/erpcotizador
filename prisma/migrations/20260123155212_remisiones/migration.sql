-- CreateEnum
CREATE TYPE "RemisionStatus" AS ENUM ('EMITIDA', 'ANULADA');

-- AlterEnum
ALTER TYPE "InventoryMovementSourceType" ADD VALUE 'REMISION';

-- CreateTable
CREATE TABLE "remision_sequences" (
    "sedeId" TEXT NOT NULL,
    "currentNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remision_sequences_pkey" PRIMARY KEY ("sedeId")
);

-- CreateTable
CREATE TABLE "remisiones" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "RemisionStatus" NOT NULL DEFAULT 'EMITIDA',
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "clienteNombre" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remision_items" (
    "id" TEXT NOT NULL,
    "remisionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remision_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "remisiones_numero_key" ON "remisiones"("numero");

-- CreateIndex
CREATE INDEX "remisiones_empresaId_createdAt_idx" ON "remisiones"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "remisiones_sedeId_createdAt_idx" ON "remisiones"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "remisiones_warehouseId_createdAt_idx" ON "remisiones"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "remision_items_remisionId_idx" ON "remision_items"("remisionId");

-- CreateIndex
CREATE INDEX "remision_items_materialId_idx" ON "remision_items"("materialId");

-- AddForeignKey
ALTER TABLE "remision_sequences" ADD CONSTRAINT "remision_sequences_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remisiones" ADD CONSTRAINT "remisiones_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remisiones" ADD CONSTRAINT "remisiones_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remisiones" ADD CONSTRAINT "remisiones_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remisiones" ADD CONSTRAINT "remisiones_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision_items" ADD CONSTRAINT "remision_items_remisionId_fkey" FOREIGN KEY ("remisionId") REFERENCES "remisiones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remision_items" ADD CONSTRAINT "remision_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
