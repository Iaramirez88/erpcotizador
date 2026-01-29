-- CreateTable
CREATE TABLE "litografia_finish_options" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "litografia_finish_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "litografia_finish_options_empresaId_activo_idx" ON "litografia_finish_options"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_finish_options_empresaId_key_key" ON "litografia_finish_options"("empresaId", "key");

-- AddForeignKey
ALTER TABLE "litografia_finish_options" ADD CONSTRAINT "litografia_finish_options_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "litografia_flyer_rates" ADD COLUMN     "paperRateId" TEXT,
ADD COLUMN     "finishOptionId" TEXT;

-- DropIndex
DROP INDEX "litografia_flyer_rates_empresaId_formatoKey_tintas_tirajeMi_key";

-- CreateIndex
CREATE INDEX "litografia_flyer_rates_empresaId_formatoKey_tintas_paperRateId_f_idx" ON "litografia_flyer_rates"("empresaId", "formatoKey", "tintas", "paperRateId", "finishOptionId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_flyer_rates_empresaId_formatoKey_tintas_tirajeMi_pap_key" ON "litografia_flyer_rates"("empresaId", "formatoKey", "tintas", "tirajeMin", "tirajeMax", "paperRateId", "finishOptionId");

-- AddForeignKey
ALTER TABLE "litografia_flyer_rates" ADD CONSTRAINT "litografia_flyer_rates_paperRateId_fkey" FOREIGN KEY ("paperRateId") REFERENCES "litografia_paper_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litografia_flyer_rates" ADD CONSTRAINT "litografia_flyer_rates_finishOptionId_fkey" FOREIGN KEY ("finishOptionId") REFERENCES "litografia_finish_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
