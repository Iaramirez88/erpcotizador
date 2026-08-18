-- CreateEnum
CREATE TYPE "InventorySupplyRequestStatus" AS ENUM ('PENDIENTE', 'COMPLETADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "InventorySupplyRequestPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'URGENTE');

-- AlterTable
ALTER TABLE "inventory_warehouses" ADD COLUMN "isSupplyHub" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "inventory_supply_requests" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "requestingWarehouseId" TEXT NOT NULL,
    "supplyWarehouseId" TEXT NOT NULL,
    "requestingSedeId" TEXT,
    "status" "InventorySupplyRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "priority" "InventorySupplyRequestPriority" NOT NULL DEFAULT 'MEDIA',
    "note" TEXT,
    "taskId" TEXT,
    "requestedById" TEXT,
    "fulfilledById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_supply_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_supply_request_items" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_supply_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_supply_requests_numero_key" ON "inventory_supply_requests"("numero");

-- CreateIndex
CREATE INDEX "inventory_supply_requests_empresaId_status_createdAt_idx" ON "inventory_supply_requests"("empresaId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_supply_requests_requestingWarehouseId_createdAt_idx" ON "inventory_supply_requests"("requestingWarehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_supply_requests_supplyWarehouseId_createdAt_idx" ON "inventory_supply_requests"("supplyWarehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_supply_requests_requestingSedeId_createdAt_idx" ON "inventory_supply_requests"("requestingSedeId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_supply_request_items_requestId_idx" ON "inventory_supply_request_items"("requestId");

-- CreateIndex
CREATE INDEX "inventory_supply_request_items_materialId_idx" ON "inventory_supply_request_items"("materialId");

-- AddForeignKey
ALTER TABLE "inventory_supply_requests" ADD CONSTRAINT "inventory_supply_requests_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_requests" ADD CONSTRAINT "inventory_supply_requests_requestingWarehouseId_fkey" FOREIGN KEY ("requestingWarehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_requests" ADD CONSTRAINT "inventory_supply_requests_supplyWarehouseId_fkey" FOREIGN KEY ("supplyWarehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_requests" ADD CONSTRAINT "inventory_supply_requests_requestingSedeId_fkey" FOREIGN KEY ("requestingSedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_requests" ADD CONSTRAINT "inventory_supply_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_requests" ADD CONSTRAINT "inventory_supply_requests_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_request_items" ADD CONSTRAINT "inventory_supply_request_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "inventory_supply_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_supply_request_items" ADD CONSTRAINT "inventory_supply_request_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;