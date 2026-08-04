CREATE TYPE "EmpresaBackupFormat" AS ENUM ('SQL', 'XLSX');

CREATE TYPE "EmpresaBackupTriggerSource" AS ENUM ('AUTO', 'MANUAL', 'IMPORT');

CREATE TABLE "backup_access_grants" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "allowImport" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "backup_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "empresa_backups" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "importedByUserId" TEXT,
  "triggerSource" "EmpresaBackupTriggerSource" NOT NULL DEFAULT 'MANUAL',
  "format" "EmpresaBackupFormat" NOT NULL,
  "fileName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL DEFAULT 0,
  "rowsCount" INTEGER NOT NULL DEFAULT 0,
  "checksum" TEXT,
  "manifestVersion" INTEGER NOT NULL DEFAULT 1,
  "modulesJson" JSONB NOT NULL DEFAULT '[]',
  "filtersJson" JSONB NOT NULL DEFAULT '{}',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "importedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "empresa_backups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "backup_access_grants_empresaId_userId_key" ON "backup_access_grants"("empresaId", "userId");
CREATE INDEX "backup_access_grants_empresaId_idx" ON "backup_access_grants"("empresaId");
CREATE INDEX "backup_access_grants_userId_idx" ON "backup_access_grants"("userId");

CREATE INDEX "empresa_backups_empresaId_createdAt_idx" ON "empresa_backups"("empresaId", "createdAt");
CREATE INDEX "empresa_backups_empresaId_triggerSource_createdAt_idx" ON "empresa_backups"("empresaId", "triggerSource", "createdAt");
CREATE INDEX "empresa_backups_createdByUserId_createdAt_idx" ON "empresa_backups"("createdByUserId", "createdAt");
CREATE INDEX "empresa_backups_importedByUserId_importedAt_idx" ON "empresa_backups"("importedByUserId", "importedAt");

ALTER TABLE "backup_access_grants"
ADD CONSTRAINT "backup_access_grants_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "backup_access_grants"
ADD CONSTRAINT "backup_access_grants_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "empresa_backups"
ADD CONSTRAINT "empresa_backups_empresaId_fkey"
FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "empresa_backups"
ADD CONSTRAINT "empresa_backups_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "empresa_backups"
ADD CONSTRAINT "empresa_backups_importedByUserId_fkey"
FOREIGN KEY ("importedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;