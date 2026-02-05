-- AlterTable
ALTER TABLE "clientes" ADD COLUMN "sedeId" TEXT;

-- CreateIndex
CREATE INDEX "clientes_sedeId_idx" ON "clientes"("sedeId");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
