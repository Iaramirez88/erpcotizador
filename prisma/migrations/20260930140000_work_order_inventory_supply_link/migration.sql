ALTER TABLE "inventory_supply_requests"
ADD COLUMN "ordenTrabajoId" TEXT;

CREATE INDEX "inventory_supply_requests_ordenTrabajoId_createdAt_idx"
ON "inventory_supply_requests"("ordenTrabajoId", "createdAt");

ALTER TABLE "inventory_supply_requests"
ADD CONSTRAINT "inventory_supply_requests_ordenTrabajoId_fkey"
FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id") ON DELETE SET NULL ON UPDATE CASCADE;