CREATE TABLE "permission_profile_assignments" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "appliedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "permission_profile_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permission_profile_assignments_sedeId_userId_key" ON "permission_profile_assignments"("sedeId", "userId");
CREATE INDEX "permission_profile_assignments_profileId_sedeId_idx" ON "permission_profile_assignments"("profileId", "sedeId");
CREATE INDEX "permission_profile_assignments_empresaId_sedeId_idx" ON "permission_profile_assignments"("empresaId", "sedeId");

ALTER TABLE "permission_profile_assignments"
  ADD CONSTRAINT "permission_profile_assignments_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "permission_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permission_profile_assignments"
  ADD CONSTRAINT "permission_profile_assignments_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permission_profile_assignments"
  ADD CONSTRAINT "permission_profile_assignments_sedeId_fkey"
  FOREIGN KEY ("sedeId") REFERENCES "sedes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permission_profile_assignments"
  ADD CONSTRAINT "permission_profile_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "permission_profile_assignments"
  ADD CONSTRAINT "permission_profile_assignments_appliedByUserId_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;