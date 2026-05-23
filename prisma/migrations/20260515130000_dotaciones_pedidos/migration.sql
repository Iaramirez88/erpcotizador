CREATE TYPE "DotacionPedidoStatus" AS ENUM ('BORRADOR', 'EN_PREPARACION', 'ENTREGA_PARCIAL', 'ENTREGADA', 'CANCELADA');
CREATE TYPE "DotacionPedidoItemStatus" AS ENUM ('PENDIENTE', 'REMITIDA', 'CANCELADA');

CREATE TABLE "dotacion_pedidos" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "clienteId" TEXT,
  "clienteNombre" TEXT,
  "cotizacionId" TEXT,
  "cotizacionNumero" TEXT,
  "warehouseId" TEXT,
  "title" TEXT,
  "batchNote" TEXT,
  "status" "DotacionPedidoStatus" NOT NULL DEFAULT 'BORRADOR',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dotacion_pedidos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dotacion_pedido_items" (
  "id" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "employeeId" TEXT,
  "employeeName" TEXT,
  "sedeId" TEXT,
  "sedeName" TEXT,
  "materialId" TEXT,
  "materialName" TEXT,
  "talla" TEXT,
  "color" TEXT,
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "note" TEXT,
  "selected" BOOLEAN NOT NULL DEFAULT true,
  "status" "DotacionPedidoItemStatus" NOT NULL DEFAULT 'PENDIENTE',
  "deliveredAt" TIMESTAMP(3),
  "remisionId" TEXT,
  "remisionNumero" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dotacion_pedido_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dotacion_pedidos_empresaId_updatedAt_idx" ON "dotacion_pedidos"("empresaId", "updatedAt");
CREATE INDEX "dotacion_pedidos_empresaId_sedeId_status_idx" ON "dotacion_pedidos"("empresaId", "sedeId", "status");
CREATE INDEX "dotacion_pedidos_clienteId_updatedAt_idx" ON "dotacion_pedidos"("clienteId", "updatedAt");
CREATE INDEX "dotacion_pedidos_cotizacionId_idx" ON "dotacion_pedidos"("cotizacionId");
CREATE INDEX "dotacion_pedido_items_pedidoId_sortOrder_idx" ON "dotacion_pedido_items"("pedidoId", "sortOrder");
CREATE INDEX "dotacion_pedido_items_employeeId_idx" ON "dotacion_pedido_items"("employeeId");
CREATE INDEX "dotacion_pedido_items_materialId_idx" ON "dotacion_pedido_items"("materialId");
CREATE INDEX "dotacion_pedido_items_sedeId_idx" ON "dotacion_pedido_items"("sedeId");
CREATE INDEX "dotacion_pedido_items_status_deliveredAt_idx" ON "dotacion_pedido_items"("status", "deliveredAt");

ALTER TABLE "dotacion_pedido_items"
  ADD CONSTRAINT "dotacion_pedido_items_pedidoId_fkey"
  FOREIGN KEY ("pedidoId") REFERENCES "dotacion_pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;