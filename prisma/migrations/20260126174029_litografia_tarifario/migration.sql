-- CreateTable
CREATE TABLE "litografia_print_profiles" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "costoPlanchaPorColor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoTintaPorColor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "litografia_print_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "litografia_paper_rates" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "gramaje" INTEGER,
    "pliegoWidthCm" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "pliegoHeightCm" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "costoPliego" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "litografia_paper_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "litografia_print_profiles_empresaId_idx" ON "litografia_print_profiles"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_print_profiles_empresaId_nombre_key" ON "litografia_print_profiles"("empresaId", "nombre");

-- CreateIndex
CREATE INDEX "litografia_paper_rates_empresaId_idx" ON "litografia_paper_rates"("empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "litografia_paper_rates_empresaId_nombre_key" ON "litografia_paper_rates"("empresaId", "nombre");

-- AddForeignKey
ALTER TABLE "litografia_print_profiles" ADD CONSTRAINT "litografia_print_profiles_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "litografia_paper_rates" ADD CONSTRAINT "litografia_paper_rates_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
