-- Workspace access requests (approve/deny access by WS-...)

CREATE TYPE "WorkspaceAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "workspace_access_requests" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "workspaceCode" TEXT,
  "status" "WorkspaceAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "workspace_access_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workspace_access_requests"
  ADD CONSTRAINT "workspace_access_requests_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_access_requests"
  ADD CONSTRAINT "workspace_access_requests_requesterUserId_fkey"
  FOREIGN KEY ("requesterUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_access_requests"
  ADD CONSTRAINT "workspace_access_requests_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "workspace_access_requests_empresaId_status_createdAt_idx" ON "workspace_access_requests"("empresaId", "status", "createdAt");
CREATE INDEX "workspace_access_requests_requesterUserId_status_idx" ON "workspace_access_requests"("requesterUserId", "status");
