-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstadoOrden" ADD VALUE 'RECIBIDO';
ALTER TYPE "EstadoOrden" ADD VALUE 'COTIZADO';
ALTER TYPE "EstadoOrden" ADD VALUE 'APROBADO';
ALTER TYPE "EstadoOrden" ADD VALUE 'EN_CORRECCION';
ALTER TYPE "EstadoOrden" ADD VALUE 'APROBADO_PRODUCCION';
ALTER TYPE "EstadoOrden" ADD VALUE 'EN_IMPRESION';
ALTER TYPE "EstadoOrden" ADD VALUE 'EN_ACONDICIONAMIENTO';
ALTER TYPE "EstadoOrden" ADD VALUE 'EN_ENTREGA';
ALTER TYPE "EstadoOrden" ADD VALUE 'FACTURADO';
ALTER TYPE "EstadoOrden" ADD VALUE 'CERRADO';

-- AlterTable
ALTER TABLE "ordenes_trabajo" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToUserId" TEXT;

-- CreateIndex
CREATE INDEX "ordenes_trabajo_assignedToUserId_idx" ON "ordenes_trabajo"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
