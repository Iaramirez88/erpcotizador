-- CreateEnum
CREATE TYPE "ClienteSegmento" AS ENUM ('POTENCIAL', 'OCASIONAL', 'FRECUENTE');

-- AlterTable
ALTER TABLE "clientes" ADD COLUMN     "segmento" "ClienteSegmento";
