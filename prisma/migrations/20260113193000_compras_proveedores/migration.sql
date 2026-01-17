-- CreateEnum
CREATE TYPE "EstadoCompra" AS ENUM ('BORRADOR', 'REGISTRADA', 'ANULADA');

-- CreateTable
CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nit" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "email" TEXT,
    "contacto" TEXT,
    "ciudad" TEXT,
    "departamento" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compras" (
    "id" TEXT NOT NULL,
    "fechaCompra" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoCompra" NOT NULL DEFAULT 'BORRADOR',

    "proveedorId" TEXT,
    "proveedorNombre" TEXT NOT NULL,
    "proveedorTelefono" TEXT,
    "proveedorDireccion" TEXT,

    "recibidoPorId" TEXT,
    "recibidoPorNombre" TEXT,

    "numeroPedido" TEXT,
    "numeroOrden" TEXT,
    "numeroFactura" TEXT,

    "subtotalSinIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalConIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,

    "sede" TEXT,
    "observaciones" TEXT,

    "autorizado" BOOLEAN NOT NULL DEFAULT false,
    "autorizadoAt" TIMESTAMP(3),
    "autorizadoById" TEXT,

    "userId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items_compra" (
    "id" TEXT NOT NULL,
    "compraId" TEXT NOT NULL,

    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT,
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotalSinIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,

    "orden" INTEGER NOT NULL DEFAULT 0,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_compra_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "proveedores_nit_key" ON "proveedores"("nit");

CREATE INDEX "proveedores_nombre_idx" ON "proveedores"("nombre");
CREATE INDEX "proveedores_empresaId_idx" ON "proveedores"("empresaId");

CREATE INDEX "compras_fechaCompra_idx" ON "compras"("fechaCompra");
CREATE INDEX "compras_estado_idx" ON "compras"("estado");
CREATE INDEX "compras_autorizado_idx" ON "compras"("autorizado");
CREATE INDEX "compras_empresaId_idx" ON "compras"("empresaId");
CREATE INDEX "compras_proveedorNombre_idx" ON "compras"("proveedorNombre");

CREATE INDEX "items_compra_compraId_idx" ON "items_compra"("compraId");

-- FKs
ALTER TABLE "proveedores" ADD CONSTRAINT "proveedores_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "compras" ADD CONSTRAINT "compras_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "proveedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_recibidoPorId_fkey" FOREIGN KEY ("recibidoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compras" ADD CONSTRAINT "compras_autorizadoById_fkey" FOREIGN KEY ("autorizadoById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "items_compra" ADD CONSTRAINT "items_compra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
