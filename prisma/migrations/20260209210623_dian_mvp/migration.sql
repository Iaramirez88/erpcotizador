-- CreateEnum
CREATE TYPE "DianDocumentDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "DianDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ELECTRONIC_INSTRUMENT');

-- CreateEnum
CREATE TYPE "DianDocumentStatus" AS ENUM ('GENERATED', 'TRANSMITTED', 'EXPEDITED', 'DELIVERED', 'RECEIVED', 'ERROR');

-- CreateEnum
CREATE TYPE "DianEventType" AS ENUM ('GENERATION', 'TRANSMISSION', 'EXPEDITION', 'DELIVERY', 'RECEPTION', 'ERROR', 'NOTE');

-- CreateTable
CREATE TABLE "dian_electronic_documents" (
    "id" TEXT NOT NULL,
    "direction" "DianDocumentDirection" NOT NULL DEFAULT 'OUTBOUND',
    "type" "DianDocumentType" NOT NULL,
    "status" "DianDocumentStatus" NOT NULL DEFAULT 'GENERATED',
    "empresaId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "posInvoiceId" TEXT,
    "posReturnId" TEXT,
    "numero" TEXT,
    "uuid" TEXT,
    "cufe" TEXT,
    "provider" TEXT,
    "providerRef" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "xml" TEXT,
    "lastError" TEXT,
    "transmittedAt" TIMESTAMP(3),
    "expeditedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dian_electronic_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dian_electronic_events" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "type" "DianEventType" NOT NULL,
    "message" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dian_electronic_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dian_electronic_documents_empresaId_createdAt_idx" ON "dian_electronic_documents"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "dian_electronic_documents_sedeId_createdAt_idx" ON "dian_electronic_documents"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "dian_electronic_documents_direction_status_createdAt_idx" ON "dian_electronic_documents"("direction", "status", "createdAt");

-- CreateIndex
CREATE INDEX "dian_electronic_documents_posInvoiceId_idx" ON "dian_electronic_documents"("posInvoiceId");

-- CreateIndex
CREATE INDEX "dian_electronic_documents_posReturnId_idx" ON "dian_electronic_documents"("posReturnId");

-- CreateIndex
CREATE INDEX "dian_electronic_events_documentId_createdAt_idx" ON "dian_electronic_events"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "dian_electronic_events_type_createdAt_idx" ON "dian_electronic_events"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "dian_electronic_documents" ADD CONSTRAINT "dian_electronic_documents_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dian_electronic_documents" ADD CONSTRAINT "dian_electronic_documents_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dian_electronic_documents" ADD CONSTRAINT "dian_electronic_documents_posInvoiceId_fkey" FOREIGN KEY ("posInvoiceId") REFERENCES "pos_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dian_electronic_documents" ADD CONSTRAINT "dian_electronic_documents_posReturnId_fkey" FOREIGN KEY ("posReturnId") REFERENCES "pos_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dian_electronic_documents" ADD CONSTRAINT "dian_electronic_documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dian_electronic_events" ADD CONSTRAINT "dian_electronic_events_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "dian_electronic_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "registration_invites_empresa_email_idx" RENAME TO "registration_invites_empresaId_email_idx";
