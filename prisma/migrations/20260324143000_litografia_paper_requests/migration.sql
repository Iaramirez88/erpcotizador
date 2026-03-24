CREATE TYPE "LitografiaPaperRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "litografia_paper_requests" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "status" "LitografiaPaperRequestStatus" NOT NULL DEFAULT 'PENDING',
  "decisionNote" TEXT,
  "nombre" TEXT NOT NULL,
  "tipo" TEXT,
  "gramaje" INTEGER,
  "pliegoWidthCm" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "pliegoHeightCm" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "costoPliego" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paperRateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "litografia_paper_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "litografia_paper_requests_empresaId_status_idx" ON "litografia_paper_requests"("empresaId", "status");
CREATE INDEX "litografia_paper_requests_empresaId_sedeId_status_idx" ON "litografia_paper_requests"("empresaId", "sedeId", "status");
CREATE INDEX "litografia_paper_requests_empresaId_createdAt_idx" ON "litografia_paper_requests"("empresaId", "createdAt");

ALTER TABLE "litografia_paper_requests"
  ADD CONSTRAINT "litografia_paper_requests_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "litografia_paper_requests"
  ADD CONSTRAINT "litografia_paper_requests_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "litografia_paper_requests"
  ADD CONSTRAINT "litografia_paper_requests_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "litografia_paper_requests"
  ADD CONSTRAINT "litografia_paper_requests_paperRateId_fkey"
  FOREIGN KEY ("paperRateId") REFERENCES "litografia_paper_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;