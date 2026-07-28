-- CreateTable
CREATE TABLE "crm_task_workspace_sedes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_task_workspace_sedes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_task_workspace_sedes_workspaceId_sedeId_key" ON "crm_task_workspace_sedes"("workspaceId", "sedeId");

-- CreateIndex
CREATE INDEX "crm_task_workspace_sedes_sedeId_createdAt_idx" ON "crm_task_workspace_sedes"("sedeId", "createdAt");

-- AddForeignKey
ALTER TABLE "crm_task_workspace_sedes"
ADD CONSTRAINT "crm_task_workspace_sedes_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "crm_task_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_task_workspace_sedes"
ADD CONSTRAINT "crm_task_workspace_sedes_sedeId_fkey"
FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing workspace/sede links from the legacy direct relation.
INSERT INTO "crm_task_workspace_sedes" ("id", "workspaceId", "sedeId", "createdAt")
SELECT
    'wss-' || md5("id" || '-' || "sedeId"),
    "id",
    "sedeId",
    CURRENT_TIMESTAMP
FROM "crm_task_workspaces"
WHERE "sedeId" IS NOT NULL
ON CONFLICT ("workspaceId", "sedeId") DO NOTHING;