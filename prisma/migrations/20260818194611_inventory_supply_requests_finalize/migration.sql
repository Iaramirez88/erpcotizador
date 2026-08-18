-- AlterTable
ALTER TABLE "plan_commercial_price_settings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "web_push_subscriptions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "crm_task_workspace_projects_empresaId_workspaceId_createdA_idx" RENAME TO "crm_task_workspace_projects_empresaId_workspaceId_createdAt_idx";

-- RenameIndex
ALTER INDEX "payroll_employee_documents_signatureStatus_signatureRequired_id" RENAME TO "payroll_employee_documents_signatureStatus_signatureRequire_idx";
