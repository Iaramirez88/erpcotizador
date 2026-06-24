-- CreateTable
CREATE TABLE "crm_task_workspace_projects" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_task_workspace_projects_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "crm_tasks"
ADD COLUMN "projectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "crm_task_workspace_projects_workspaceId_name_key" ON "crm_task_workspace_projects"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "crm_task_workspace_projects_empresaId_workspaceId_createdA_idx" ON "crm_task_workspace_projects"("empresaId", "workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_task_workspace_projects_createdById_createdAt_idx" ON "crm_task_workspace_projects"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "crm_tasks_projectId_status_dueAt_idx" ON "crm_tasks"("projectId", "status", "dueAt");

-- AddForeignKey
ALTER TABLE "crm_task_workspace_projects"
ADD CONSTRAINT "crm_task_workspace_projects_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task_workspace_projects"
ADD CONSTRAINT "crm_task_workspace_projects_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "crm_task_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task_workspace_projects"
ADD CONSTRAINT "crm_task_workspace_projects_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tasks"
ADD CONSTRAINT "crm_tasks_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "crm_task_workspace_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
