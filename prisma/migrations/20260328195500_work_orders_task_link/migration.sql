ALTER TABLE "crm_tasks"
ADD COLUMN "ordenTrabajoId" TEXT;

CREATE UNIQUE INDEX "crm_tasks_ordenTrabajoId_key" ON "crm_tasks"("ordenTrabajoId");
CREATE INDEX "crm_tasks_ordenTrabajoId_idx" ON "crm_tasks"("ordenTrabajoId");

ALTER TABLE "crm_tasks"
ADD CONSTRAINT "crm_tasks_ordenTrabajoId_fkey"
FOREIGN KEY ("ordenTrabajoId") REFERENCES "ordenes_trabajo"("id")
ON DELETE SET NULL ON UPDATE CASCADE;