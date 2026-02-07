-- Registration invites (per-email access codes)
CREATE TABLE "registration_invites" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "registration_invites_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "registration_invites"
  ADD CONSTRAINT "registration_invites_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "registration_invites_email_idx" ON "registration_invites"("email");
CREATE INDEX "registration_invites_empresa_email_idx" ON "registration_invites"("empresaId", "email");
