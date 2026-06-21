CREATE TABLE "payroll_survey_campaigns" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BORRADOR',
  "anonymous" BOOLEAN NOT NULL DEFAULT true,
  "audience" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'PORTAL',
  "questionsCount" INTEGER NOT NULL DEFAULT 0,
  "invitedCount" INTEGER NOT NULL DEFAULT 0,
  "responsesCount" INTEGER NOT NULL DEFAULT 0,
  "averageScore" DOUBLE PRECISION,
  "opensAt" TIMESTAMP(3),
  "closesAt" TIMESTAMP(3),
  "summary" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_survey_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_survey_campaigns_empresaId_status_idx" ON "payroll_survey_campaigns"("empresaId", "status");
CREATE INDEX "payroll_survey_campaigns_ownerUserId_idx" ON "payroll_survey_campaigns"("ownerUserId");
CREATE INDEX "payroll_survey_campaigns_category_idx" ON "payroll_survey_campaigns"("category");

ALTER TABLE "payroll_survey_campaigns" ADD CONSTRAINT "payroll_survey_campaigns_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_survey_campaigns" ADD CONSTRAINT "payroll_survey_campaigns_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;