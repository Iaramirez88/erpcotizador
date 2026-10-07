ALTER TABLE "crm_gantt_items"
ADD COLUMN "attachmentsJson" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "crm_gantt_plan_members" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'COMMENTER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_gantt_plan_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_gantt_item_assignments" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_gantt_item_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_gantt_item_comments" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_gantt_item_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_gantt_item_reads" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_gantt_item_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_gantt_plan_members_planId_userId_key" ON "crm_gantt_plan_members"("planId", "userId");
CREATE INDEX "crm_gantt_plan_members_empresaId_userId_idx" ON "crm_gantt_plan_members"("empresaId", "userId");
CREATE UNIQUE INDEX "crm_gantt_item_assignments_itemId_userId_key" ON "crm_gantt_item_assignments"("itemId", "userId");
CREATE INDEX "crm_gantt_item_assignments_userId_createdAt_idx" ON "crm_gantt_item_assignments"("userId", "createdAt");
CREATE INDEX "crm_gantt_item_comments_itemId_createdAt_idx" ON "crm_gantt_item_comments"("itemId", "createdAt");
CREATE INDEX "crm_gantt_item_comments_authorUserId_createdAt_idx" ON "crm_gantt_item_comments"("authorUserId", "createdAt");
CREATE UNIQUE INDEX "crm_gantt_item_reads_itemId_userId_key" ON "crm_gantt_item_reads"("itemId", "userId");
CREATE INDEX "crm_gantt_item_reads_userId_lastReadAt_idx" ON "crm_gantt_item_reads"("userId", "lastReadAt");

ALTER TABLE "crm_gantt_plan_members" ADD CONSTRAINT "crm_gantt_plan_members_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_plan_members" ADD CONSTRAINT "crm_gantt_plan_members_planId_fkey" FOREIGN KEY ("planId") REFERENCES "crm_gantt_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_plan_members" ADD CONSTRAINT "crm_gantt_plan_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_item_assignments" ADD CONSTRAINT "crm_gantt_item_assignments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "crm_gantt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_item_assignments" ADD CONSTRAINT "crm_gantt_item_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_item_comments" ADD CONSTRAINT "crm_gantt_item_comments_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "crm_gantt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_item_comments" ADD CONSTRAINT "crm_gantt_item_comments_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_item_reads" ADD CONSTRAINT "crm_gantt_item_reads_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "crm_gantt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_item_reads" ADD CONSTRAINT "crm_gantt_item_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;