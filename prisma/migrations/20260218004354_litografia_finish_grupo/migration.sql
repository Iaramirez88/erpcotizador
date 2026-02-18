-- CreateEnum
CREATE TYPE "LitografiaFinishGroup" AS ENUM ('ACABADO', 'PLASTIFICADO', 'TROQUELADO', 'CORTE');

-- AlterTable
ALTER TABLE "litografia_finish_options" ADD COLUMN     "grupo" "LitografiaFinishGroup" NOT NULL DEFAULT 'ACABADO';
