-- CreateTable
CREATE TABLE "litografia_flyer_rates" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "formatoKey" TEXT NOT NULL,
    "tintas" INTEGER NOT NULL,
    "tirajeMin" INTEGER NOT NULL,
    "tirajeMax" INTEGER NOT NULL,
    "precioTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "litografia_flyer_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "litografia_flyer_rates_empresaId_formatoKey_tintas_activo_idx" ON "litografia_flyer_rates"("empresaId", "formatoKey", "tintas", "activo");

-- CreateIndex
CREATE INDEX "litografia_flyer_rates_empresaId_tirajeMin_tirajeMax_idx" ON "litografia_flyer_rates"("empresaId", "tirajeMin", "tirajeMax");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_flyer_rates_empresaId_formatoKey_tintas_tirajeMi_key" ON "litografia_flyer_rates"("empresaId", "formatoKey", "tintas", "tirajeMin", "tirajeMax");

-- AddForeignKey
ALTER TABLE "litografia_flyer_rates" ADD CONSTRAINT "litografia_flyer_rates_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
