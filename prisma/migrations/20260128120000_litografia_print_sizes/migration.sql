-- CreateTable
CREATE TABLE "litografia_print_sizes" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "widthCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "heightCm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "litografia_print_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "litografia_print_sizes_empresaId_key_key" ON "litografia_print_sizes"("empresaId", "key");

-- CreateIndex
CREATE INDEX "litografia_print_sizes_empresaId_activo_idx" ON "litografia_print_sizes"("empresaId", "activo");

-- AddForeignKey
ALTER TABLE "litografia_print_sizes" ADD CONSTRAINT "litografia_print_sizes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
