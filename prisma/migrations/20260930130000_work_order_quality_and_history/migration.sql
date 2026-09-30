CREATE TYPE "WorkOrderQualityResult" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPROVED_WITH_OBSERVATIONS');

ALTER TABLE "ordenes_trabajo"
ADD COLUMN "qualityChecklist" JSONB,
ADD COLUMN "qualityResult" "WorkOrderQualityResult" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "qualityNotes" TEXT,
ADD COLUMN "qualityReviewedAt" TIMESTAMP(3),
ADD COLUMN "qualityReviewedById" TEXT;

CREATE TABLE "work_order_events" (
  "id" TEXT NOT NULL,
  "ordenId" TEXT NOT NULL,
  "type" VARCHAR(40) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "details" JSONB,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "work_order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ordenes_trabajo_qualityReviewedById_idx" ON "ordenes_trabajo"("qualityReviewedById");
CREATE INDEX "idx_work_order_events_order_created" ON "work_order_events"("ordenId", "createdAt");
CREATE INDEX "work_order_events_createdById_idx" ON "work_order_events"("createdById");

ALTER TABLE "ordenes_trabajo"
ADD CONSTRAINT "ordenes_trabajo_qualityReviewedById_fkey"
FOREIGN KEY ("qualityReviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_events"
ADD CONSTRAINT "work_order_events_ordenId_fkey"
FOREIGN KEY ("ordenId") REFERENCES "ordenes_trabajo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_order_events"
ADD CONSTRAINT "work_order_events_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;