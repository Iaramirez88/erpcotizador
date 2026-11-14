-- M8 · CRM captación: secuencias de nutrición (automatizaciones)
-- Migración 100% aditiva.

-- CreateEnum
CREATE TYPE "CrmSequenceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CrmSequenceStepKind" AS ENUM ('EMAIL', 'WHATSAPP', 'TASK', 'WAIT', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "CrmEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED_OPT_OUT', 'STOPPED_CONVERTED', 'STOPPED_REPLY', 'CANCELLED');

-- CreateTable
CREATE TABLE "crm_sequences" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmSequenceStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerJson" JSONB NOT NULL DEFAULT '{}',
    "stopOnOpportunity" BOOLEAN NOT NULL DEFAULT true,
    "stopOnReply" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sequence_steps" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "kind" "CrmSequenceStepKind" NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT,
    "bodyHtml" TEXT,
    "templateKey" TEXT,
    "taskTitle" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sequence_enrollments" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" "CrmEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStepOrder" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "stoppedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_sequence_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_sequence_sends" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_sequence_sends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_sequences_empresaId_status_idx" ON "crm_sequences"("empresaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_sequence_steps_sequenceId_order_key" ON "crm_sequence_steps"("sequenceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "crm_sequence_enrollments_sequenceId_contactId_key" ON "crm_sequence_enrollments"("sequenceId", "contactId");

-- CreateIndex
CREATE INDEX "crm_sequence_enrollments_empresaId_status_nextRunAt_idx" ON "crm_sequence_enrollments"("empresaId", "status", "nextRunAt");

-- CreateIndex
CREATE INDEX "crm_sequence_enrollments_contactId_status_idx" ON "crm_sequence_enrollments"("contactId", "status");

-- CreateIndex
CREATE INDEX "crm_sequence_enrollments_leadId_status_idx" ON "crm_sequence_enrollments"("leadId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_sequence_sends_enrollmentId_stepId_key" ON "crm_sequence_sends"("enrollmentId", "stepId");

-- CreateIndex
CREATE INDEX "crm_sequence_sends_empresaId_sentAt_idx" ON "crm_sequence_sends"("empresaId", "sentAt");

-- AddForeignKey
ALTER TABLE "crm_sequences" ADD CONSTRAINT "crm_sequences_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_steps" ADD CONSTRAINT "crm_sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "crm_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_enrollments" ADD CONSTRAINT "crm_sequence_enrollments_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_enrollments" ADD CONSTRAINT "crm_sequence_enrollments_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "crm_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_enrollments" ADD CONSTRAINT "crm_sequence_enrollments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_enrollments" ADD CONSTRAINT "crm_sequence_enrollments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_sends" ADD CONSTRAINT "crm_sequence_sends_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_sends" ADD CONSTRAINT "crm_sequence_sends_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "crm_sequence_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_sequence_sends" ADD CONSTRAINT "crm_sequence_sends_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "crm_sequence_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
