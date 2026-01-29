-- CreateEnum
CREATE TYPE "ScanFeedbackSource" AS ENUM ('UI_SINGLE', 'UI_BULK', 'API');

-- CreateTable
CREATE TABLE "document_scan_field_feedback" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sedeId" TEXT,
    "source" "ScanFeedbackSource" NOT NULL DEFAULT 'UI_SINGLE',
    "path" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT true,
    "previousValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_scan_field_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_scan_field_feedback_scanId_idx" ON "document_scan_field_feedback"("scanId");

-- CreateIndex
CREATE INDEX "document_scan_field_feedback_userId_idx" ON "document_scan_field_feedback"("userId");

-- CreateIndex
CREATE INDEX "document_scan_field_feedback_sedeId_idx" ON "document_scan_field_feedback"("sedeId");

-- CreateIndex
CREATE INDEX "document_scan_field_feedback_path_idx" ON "document_scan_field_feedback"("path");

-- AddForeignKey
ALTER TABLE "document_scan_field_feedback" ADD CONSTRAINT "document_scan_field_feedback_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "document_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_scan_field_feedback" ADD CONSTRAINT "document_scan_field_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_scan_field_feedback" ADD CONSTRAINT "document_scan_field_feedback_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
