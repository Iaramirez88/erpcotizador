CREATE TYPE "CrmTaskWorkspaceVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'HIDDEN');

ALTER TABLE "crm_task_workspaces"
ADD COLUMN "visibility" "CrmTaskWorkspaceVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE INDEX "crm_task_workspaces_empresaId_visibility_createdAt_idx"
ON "crm_task_workspaces"("empresaId", "visibility", "createdAt");