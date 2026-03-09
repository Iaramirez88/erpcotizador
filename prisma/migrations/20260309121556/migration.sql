-- CreateEnum
CREATE TYPE "CustomProductRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CustomProductKind" AS ENUM ('METRAJE', 'FISICO');

-- AlterTable
ALTER TABLE "materiales" ADD COLUMN     "isCustom" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "material_allowed_terminados" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "terminadoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_allowed_terminados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_product_requests" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" "CustomProductRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "externalId" TEXT,
    "nombre" TEXT NOT NULL,
    "kind" "CustomProductKind" NOT NULL,
    "unidadMedida" TEXT NOT NULL,
    "categoria" TEXT,
    "proveedor" TEXT,
    "observaciones" TEXT,
    "ancho" DOUBLE PRECISION,
    "largo" DOUBLE PRECISION,
    "precioM2" DOUBLE PRECISION,
    "precioMetro" DOUBLE PRECISION,
    "precioUnidad" DOUBLE PRECISION,
    "materialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_product_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_product_request_terminados" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "terminadoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_product_request_terminados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_allowed_terminados_terminadoId_idx" ON "material_allowed_terminados"("terminadoId");

-- CreateIndex
CREATE INDEX "material_allowed_terminados_materialId_idx" ON "material_allowed_terminados"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "material_allowed_terminados_materialId_terminadoId_key" ON "material_allowed_terminados"("materialId", "terminadoId");

-- CreateIndex
CREATE INDEX "custom_product_requests_empresaId_status_idx" ON "custom_product_requests"("empresaId", "status");

-- CreateIndex
CREATE INDEX "custom_product_requests_empresaId_createdAt_idx" ON "custom_product_requests"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "custom_product_request_terminados_terminadoId_idx" ON "custom_product_request_terminados"("terminadoId");

-- CreateIndex
CREATE INDEX "custom_product_request_terminados_requestId_idx" ON "custom_product_request_terminados"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_product_request_terminados_requestId_terminadoId_key" ON "custom_product_request_terminados"("requestId", "terminadoId");

-- CreateIndex
CREATE INDEX "idx_materiales_empresa_is_custom" ON "materiales"("empresaId", "isCustom");

-- AddForeignKey
ALTER TABLE "material_allowed_terminados" ADD CONSTRAINT "material_allowed_terminados_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_allowed_terminados" ADD CONSTRAINT "material_allowed_terminados_terminadoId_fkey" FOREIGN KEY ("terminadoId") REFERENCES "terminados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_product_requests" ADD CONSTRAINT "custom_product_requests_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_product_requests" ADD CONSTRAINT "custom_product_requests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_product_requests" ADD CONSTRAINT "custom_product_requests_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_product_requests" ADD CONSTRAINT "custom_product_requests_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materiales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_product_request_terminados" ADD CONSTRAINT "custom_product_request_terminados_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "custom_product_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_product_request_terminados" ADD CONSTRAINT "custom_product_request_terminados_terminadoId_fkey" FOREIGN KEY ("terminadoId") REFERENCES "terminados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
