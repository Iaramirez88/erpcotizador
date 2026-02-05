-- AlterTable
ALTER TABLE "cotizaciones" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToUserId" TEXT;

-- AlterTable
ALTER TABLE "remisiones" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedToUserId" TEXT;

-- CreateIndex
CREATE INDEX "cotizaciones_assignedToUserId_idx" ON "cotizaciones"("assignedToUserId");

-- CreateIndex
CREATE INDEX "remisiones_assignedToUserId_idx" ON "remisiones"("assignedToUserId");

-- AddForeignKey
ALTER TABLE "remisiones" ADD CONSTRAINT "remisiones_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
