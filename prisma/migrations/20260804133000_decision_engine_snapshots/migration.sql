CREATE TABLE IF NOT EXISTS "decision_engine_snapshots" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT,
  "scope" VARCHAR(16) NOT NULL,
  "from" TIMESTAMP(3) NOT NULL,
  "to" TIMESTAMP(3) NOT NULL,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'es-CO',
  "engineVersion" VARCHAR(32) NOT NULL DEFAULT 'v1',
  "capturedByUserId" TEXT,
  "companyHealthScore" DOUBLE PRECISION NOT NULL,
  "companyHealthStatus" VARCHAR(16) NOT NULL,
  "executiveSummary" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "decision_engine_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "decision_engine_snapshots_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "decision_engine_snapshots_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "decision_engine_snapshots_empresaId_createdAt_idx"
ON "decision_engine_snapshots"("empresaId", "createdAt");

CREATE INDEX IF NOT EXISTS "decision_engine_snapshots_empresaId_scope_createdAt_idx"
ON "decision_engine_snapshots"("empresaId", "scope", "createdAt");

CREATE INDEX IF NOT EXISTS "decision_engine_snapshots_sedeId_createdAt_idx"
ON "decision_engine_snapshots"("sedeId", "createdAt");