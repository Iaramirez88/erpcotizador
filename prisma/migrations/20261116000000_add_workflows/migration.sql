-- Módulo Workflows: automatizaciones por API/webhook (esqueleto).
-- Migración 100% aditiva.

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowTriggerKind" AS ENUM ('WEBHOOK', 'CRON', 'MANUAL', 'EVENT');

-- CreateEnum
CREATE TYPE "WorkflowRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowNodeKind" AS ENUM ('TRIGGER', 'HTTP_REQUEST', 'CONDITION', 'DELAY', 'NOTE', 'ACTION');

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerJson" JSONB NOT NULL DEFAULT '{}',
    "definitionJson" JSONB NOT NULL DEFAULT '{}',
    "webhookToken" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" "WorkflowRunStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerKind" "WorkflowTriggerKind" NOT NULL,
    "triggerPayloadJson" JSONB NOT NULL DEFAULT '{}',
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_run_steps" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeKind" "WorkflowNodeKind" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCEEDED',
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "workflow_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflows_empresaId_status_idx" ON "workflows"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_webhookToken_key" ON "workflows"("webhookToken");

-- CreateIndex
CREATE INDEX "workflow_runs_empresaId_startedAt_idx" ON "workflow_runs"("empresaId", "startedAt");

-- CreateIndex
CREATE INDEX "workflow_runs_workflowId_startedAt_idx" ON "workflow_runs"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "workflow_run_steps_runId_idx" ON "workflow_run_steps"("runId");

-- CreateIndex
CREATE INDEX "workflow_run_steps_empresaId_startedAt_idx" ON "workflow_run_steps"("empresaId", "startedAt");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_run_steps" ADD CONSTRAINT "workflow_run_steps_runId_fkey" FOREIGN KEY ("runId") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
