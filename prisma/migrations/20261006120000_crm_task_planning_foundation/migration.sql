-- AlterTable
ALTER TABLE "crm_tasks"
ADD COLUMN "startAt" TIMESTAMP(3),
ADD COLUMN "isMilestone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "parentTaskId" TEXT;

-- CreateTable
CREATE TABLE "crm_task_dependencies" (
    "id" TEXT NOT NULL,
    "predecessorTaskId" TEXT NOT NULL,
    "successorTaskId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_task_dependencies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_task_dependencies_no_self_reference" CHECK ("predecessorTaskId" <> "successorTaskId")
);

-- CreateIndex
CREATE INDEX "crm_tasks_parentTaskId_status_dueAt_idx" ON "crm_tasks"("parentTaskId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "crm_tasks_empresaId_startAt_dueAt_idx" ON "crm_tasks"("empresaId", "startAt", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "crm_task_dependencies_predecessorTaskId_successorTaskId_key" ON "crm_task_dependencies"("predecessorTaskId", "successorTaskId");

-- CreateIndex
CREATE INDEX "crm_task_dependencies_successorTaskId_idx" ON "crm_task_dependencies"("successorTaskId");

-- AddCheckConstraint
ALTER TABLE "crm_tasks"
ADD CONSTRAINT "crm_tasks_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100);

-- AddForeignKey
ALTER TABLE "crm_tasks"
ADD CONSTRAINT "crm_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "crm_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task_dependencies"
ADD CONSTRAINT "crm_task_dependencies_predecessorTaskId_fkey" FOREIGN KEY ("predecessorTaskId") REFERENCES "crm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task_dependencies"
ADD CONSTRAINT "crm_task_dependencies_successorTaskId_fkey" FOREIGN KEY ("successorTaskId") REFERENCES "crm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "crm_gantt_plans" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colorHex" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_gantt_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_gantt_items" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "linkedTaskId" TEXT,
    "parentItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "colorHex" TEXT,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CrmTaskPriority" NOT NULL DEFAULT 'NORMAL',
    "startAt" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_gantt_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_gantt_items_progress_range" CHECK ("progress" >= 0 AND "progress" <= 100),
    CONSTRAINT "crm_gantt_items_date_range" CHECK ("dueAt" >= "startAt")
);

-- CreateTable
CREATE TABLE "crm_gantt_dependencies" (
    "id" TEXT NOT NULL,
    "predecessorItemId" TEXT NOT NULL,
    "successorItemId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_gantt_dependencies_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "crm_gantt_dependencies_no_self_reference" CHECK ("predecessorItemId" <> "successorItemId")
);

-- CreateIndex
CREATE INDEX "crm_gantt_plans_empresaId_archivedAt_createdAt_idx" ON "crm_gantt_plans"("empresaId", "archivedAt", "createdAt");
CREATE INDEX "crm_gantt_plans_workspaceId_createdAt_idx" ON "crm_gantt_plans"("workspaceId", "createdAt");
CREATE INDEX "crm_gantt_plans_projectId_createdAt_idx" ON "crm_gantt_plans"("projectId", "createdAt");
CREATE INDEX "crm_gantt_items_planId_sortOrder_idx" ON "crm_gantt_items"("planId", "sortOrder");
CREATE INDEX "crm_gantt_items_parentItemId_sortOrder_idx" ON "crm_gantt_items"("parentItemId", "sortOrder");
CREATE INDEX "crm_gantt_items_linkedTaskId_idx" ON "crm_gantt_items"("linkedTaskId");
CREATE INDEX "crm_gantt_items_startAt_dueAt_idx" ON "crm_gantt_items"("startAt", "dueAt");
CREATE UNIQUE INDEX "crm_gantt_dependencies_predecessorItemId_successorItemId_key" ON "crm_gantt_dependencies"("predecessorItemId", "successorItemId");
CREATE INDEX "crm_gantt_dependencies_successorItemId_idx" ON "crm_gantt_dependencies"("successorItemId");

-- AddForeignKey
ALTER TABLE "crm_gantt_plans" ADD CONSTRAINT "crm_gantt_plans_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_plans" ADD CONSTRAINT "crm_gantt_plans_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_task_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_plans" ADD CONSTRAINT "crm_gantt_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "crm_task_workspace_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_plans" ADD CONSTRAINT "crm_gantt_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_items" ADD CONSTRAINT "crm_gantt_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "crm_gantt_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_items" ADD CONSTRAINT "crm_gantt_items_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "crm_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_items" ADD CONSTRAINT "crm_gantt_items_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "crm_gantt_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_dependencies" ADD CONSTRAINT "crm_gantt_dependencies_predecessorItemId_fkey" FOREIGN KEY ("predecessorItemId") REFERENCES "crm_gantt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_gantt_dependencies" ADD CONSTRAINT "crm_gantt_dependencies_successorItemId_fkey" FOREIGN KEY ("successorItemId") REFERENCES "crm_gantt_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
