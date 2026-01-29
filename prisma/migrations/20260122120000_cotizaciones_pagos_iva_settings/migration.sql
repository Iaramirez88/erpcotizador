-- AlterTable
ALTER TABLE "sedes" ADD COLUMN     "cotizacionesPricesIncludeIva" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cotizacionesIvaPct" DOUBLE PRECISION NOT NULL DEFAULT 19;

-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "garantia" TEXT,
ADD COLUMN     "paymentMethods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "boldPaymentLinkId" TEXT,
ADD COLUMN     "boldCheckoutUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cotizaciones_boldPaymentLinkId_key" ON "cotizaciones"("boldPaymentLinkId");
