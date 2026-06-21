CREATE TABLE IF NOT EXISTS "payroll_recruitment_candidates" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "openingTitle" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "locationLabel" TEXT,
  "candidateName" TEXT NOT NULL,
  "candidateEmail" TEXT,
  "candidatePhone" TEXT,
  "source" TEXT NOT NULL DEFAULT 'REFERIDO',
  "stage" TEXT NOT NULL DEFAULT 'SCREENING',
  "status" TEXT NOT NULL DEFAULT 'ACTIVO',
  "score" INTEGER NOT NULL DEFAULT 0,
  "salaryExpectation" DOUBLE PRECISION,
  "expectedStartDate" TIMESTAMP(3),
  "interviewerNotes" TEXT,
  "decisionSummary" TEXT,
  "resumeUrl" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_recruitment_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "payroll_recruitment_candidates_empresaId_status_idx" ON "payroll_recruitment_candidates"("empresaId", "status");
CREATE INDEX IF NOT EXISTS "payroll_recruitment_candidates_ownerUserId_idx" ON "payroll_recruitment_candidates"("ownerUserId");
CREATE INDEX IF NOT EXISTS "payroll_recruitment_candidates_openingTitle_idx" ON "payroll_recruitment_candidates"("openingTitle");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_recruitment_candidates_empresaId_fkey') THEN
    ALTER TABLE "payroll_recruitment_candidates" ADD CONSTRAINT "payroll_recruitment_candidates_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payroll_recruitment_candidates_ownerUserId_fkey') THEN
    ALTER TABLE "payroll_recruitment_candidates" ADD CONSTRAINT "payroll_recruitment_candidates_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;