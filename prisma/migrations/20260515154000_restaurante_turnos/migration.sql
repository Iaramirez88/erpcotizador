CREATE TYPE "RestauranteTurnoStatus" AS ENUM ('ABIERTO', 'CERRADO');

CREATE TABLE "restaurante_turnos" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "title" TEXT,
  "status" "RestauranteTurnoStatus" NOT NULL DEFAULT 'ABIERTO',
  "boardData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "summaryData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "closingNotes" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "restaurante_turnos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "restaurante_turnos_empresaId_sedeId_status_updatedAt_idx"
ON "restaurante_turnos"("empresaId", "sedeId", "status", "updatedAt");

CREATE INDEX "restaurante_turnos_empresaId_sedeId_openedAt_idx"
ON "restaurante_turnos"("empresaId", "sedeId", "openedAt");