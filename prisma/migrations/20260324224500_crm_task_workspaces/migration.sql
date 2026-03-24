CREATE TYPE "CrmTaskWorkspaceScope" AS ENUM ('SEDE', 'USER');
CREATE TYPE "CrmTaskWorkspaceMemberRole" AS ENUM ('VIEWER', 'EDITOR', 'MANAGER');
CREATE TYPE "CrmTaskHistoryType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'DUE_DATE_CHANGED', 'ASSIGNEES_CHANGED', 'NOTE_ADDED', 'ARCHIVED', 'RESTORED');

CREATE TABLE "crm_task_workspaces" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT,
    "scope" "CrmTaskWorkspaceScope" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_task_workspaces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_task_workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CrmTaskWorkspaceMemberRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_task_workspace_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_task_assignments" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_task_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_task_history" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "CrmTaskHistoryType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_task_history_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "crm_tasks" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "crm_tasks" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "crm_task_workspaces_empresaId_scope_createdAt_idx" ON "crm_task_workspaces"("empresaId", "scope", "createdAt");
CREATE INDEX "crm_task_workspaces_sedeId_createdAt_idx" ON "crm_task_workspaces"("sedeId", "createdAt");
CREATE INDEX "crm_task_workspaces_ownerUserId_createdAt_idx" ON "crm_task_workspaces"("ownerUserId", "createdAt");

CREATE UNIQUE INDEX "crm_task_workspace_members_workspaceId_userId_key" ON "crm_task_workspace_members"("workspaceId", "userId");
CREATE INDEX "crm_task_workspace_members_userId_role_idx" ON "crm_task_workspace_members"("userId", "role");

CREATE UNIQUE INDEX "crm_task_assignments_taskId_userId_key" ON "crm_task_assignments"("taskId", "userId");
CREATE INDEX "crm_task_assignments_empresaId_createdAt_idx" ON "crm_task_assignments"("empresaId", "createdAt");
CREATE INDEX "crm_task_assignments_userId_createdAt_idx" ON "crm_task_assignments"("userId", "createdAt");

CREATE INDEX "crm_task_history_empresaId_createdAt_idx" ON "crm_task_history"("empresaId", "createdAt");
CREATE INDEX "crm_task_history_taskId_createdAt_idx" ON "crm_task_history"("taskId", "createdAt");
CREATE INDEX "crm_task_history_actorUserId_createdAt_idx" ON "crm_task_history"("actorUserId", "createdAt");

CREATE INDEX "crm_tasks_workspaceId_status_dueAt_idx" ON "crm_tasks"("workspaceId", "status", "dueAt");

ALTER TABLE "crm_task_workspaces" ADD CONSTRAINT "crm_task_workspaces_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_task_workspaces" ADD CONSTRAINT "crm_task_workspaces_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_task_workspaces" ADD CONSTRAINT "crm_task_workspaces_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_task_workspaces" ADD CONSTRAINT "crm_task_workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_task_workspace_members" ADD CONSTRAINT "crm_task_workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_task_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_task_workspace_members" ADD CONSTRAINT "crm_task_workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_task_assignments" ADD CONSTRAINT "crm_task_assignments_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_task_assignments" ADD CONSTRAINT "crm_task_assignments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "crm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_task_assignments" ADD CONSTRAINT "crm_task_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_task_history" ADD CONSTRAINT "crm_task_history_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_task_history" ADD CONSTRAINT "crm_task_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "crm_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_task_history" ADD CONSTRAINT "crm_task_history_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "crm_tasks" ADD CONSTRAINT "crm_tasks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "crm_task_workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;