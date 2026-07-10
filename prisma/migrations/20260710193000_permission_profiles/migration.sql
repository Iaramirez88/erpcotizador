CREATE TABLE "permission_profiles" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sedeRole" "SedeRole" NOT NULL DEFAULT 'READER',
  "globalAccessLevel" "AccessLevel" NOT NULL DEFAULT 'NONE',
  "moduleLevels" JSONB NOT NULL DEFAULT '{}',
  "capabilityLevels" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "permission_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permission_profiles_empresaId_sedeId_name_key" ON "permission_profiles"("empresaId", "sedeId", "name");
CREATE INDEX "permission_profiles_empresaId_sedeId_createdAt_idx" ON "permission_profiles"("empresaId", "sedeId", "createdAt");

ALTER TABLE "permission_profiles"
  ADD CONSTRAINT "permission_profiles_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permission_profiles"
  ADD CONSTRAINT "permission_profiles_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permission_profiles"
  ADD CONSTRAINT "permission_profiles_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;