-- CreateEnum
CREATE TYPE "InventoryMovementSourceType" AS ENUM ('MANUAL', 'POS_INVOICE', 'POS_RETURN');

-- CreateEnum
CREATE TYPE "PosInvoiceStatus" AS ENUM ('DRAFT', 'PAID', 'VOID', 'PARTIALLY_REFUNDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'OTHER');

-- AlterTable
ALTER TABLE "inventory_movements" ADD COLUMN     "sedeId" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" "InventoryMovementSourceType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "warehouseId" TEXT;

-- CreateTable
CREATE TABLE "inventory_warehouses" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_stocks" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sequences" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
    "nextReturnNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_invoices" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" "PosInvoiceStatus" NOT NULL DEFAULT 'PAID',
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "clienteNombre" TEXT NOT NULL,
    "clienteDocumento" TEXT,
    "ivaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "materialId" TEXT,
    "descripcion" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" "PosPaymentMethod" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_returns" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "invoiceId" TEXT,
    "motivo" TEXT,
    "ivaPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_return_items" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "materialId" TEXT,
    "descripcion" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "pos_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_warehouses_empresaId_idx" ON "inventory_warehouses"("empresaId");

-- CreateIndex
CREATE INDEX "inventory_warehouses_sedeId_idx" ON "inventory_warehouses"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_warehouses_empresaId_sedeId_nombre_key" ON "inventory_warehouses"("empresaId", "sedeId", "nombre");

-- CreateIndex
CREATE INDEX "inventory_stocks_materialId_idx" ON "inventory_stocks"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_stocks_warehouseId_materialId_key" ON "inventory_stocks"("warehouseId", "materialId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sequences_sedeId_key" ON "pos_sequences"("sedeId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_invoices_numero_key" ON "pos_invoices"("numero");

-- CreateIndex
CREATE INDEX "pos_invoices_empresaId_createdAt_idx" ON "pos_invoices"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "pos_invoices_sedeId_createdAt_idx" ON "pos_invoices"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "pos_invoice_items_invoiceId_idx" ON "pos_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "pos_invoice_items_materialId_idx" ON "pos_invoice_items"("materialId");

-- CreateIndex
CREATE INDEX "pos_payments_invoiceId_idx" ON "pos_payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_returns_numero_key" ON "pos_returns"("numero");

-- CreateIndex
CREATE INDEX "pos_returns_empresaId_createdAt_idx" ON "pos_returns"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "pos_returns_sedeId_createdAt_idx" ON "pos_returns"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "pos_returns_invoiceId_idx" ON "pos_returns"("invoiceId");

-- CreateIndex
CREATE INDEX "pos_return_items_returnId_idx" ON "pos_return_items"("returnId");

-- CreateIndex
CREATE INDEX "pos_return_items_materialId_idx" ON "pos_return_items"("materialId");

-- CreateIndex
CREATE INDEX "inventory_movements_sedeId_createdAt_idx" ON "inventory_movements"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_warehouseId_createdAt_idx" ON "inventory_movements"("warehouseId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_sourceType_sourceId_idx" ON "inventory_movements"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_warehouses" ADD CONSTRAINT "inventory_warehouses_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_stocks" ADD CONSTRAINT "inventory_stocks_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sequences" ADD CONSTRAINT "pos_sequences_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_invoices" ADD CONSTRAINT "pos_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_invoice_items" ADD CONSTRAINT "pos_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "pos_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_invoice_items" ADD CONSTRAINT "pos_invoice_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payments" ADD CONSTRAINT "pos_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "pos_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "inventory_warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "pos_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_returns" ADD CONSTRAINT "pos_returns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "pos_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_return_items" ADD CONSTRAINT "pos_return_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
