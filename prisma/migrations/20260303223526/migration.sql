-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CotizacionAuditAction" ADD VALUE 'SENT';
ALTER TYPE "CotizacionAuditAction" ADD VALUE 'SALE_REALIZED_SET';
ALTER TYPE "CotizacionAuditAction" ADD VALUE 'SALE_REALIZED_UNSET';

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "postApprovalEditCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ventaRealizadaAt" TIMESTAMP(3);
