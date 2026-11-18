-- Historial de versiones de settingsJson de canales CRM.
-- Se guarda un snapshot del settingsJson previo antes de cada PATCH para poder
-- restaurar una configuración anterior. Migración 100% aditiva.

-- CreateTable
CREATE TABLE "crm_channel_settings_versions" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "settingsJson" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_channel_settings_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_channel_settings_versions_channelConnectionId_versionNumber_key" ON "crm_channel_settings_versions"("channelConnectionId", "versionNumber");

-- CreateIndex
CREATE INDEX "crm_channel_settings_versions_channelConnectionId_createdAt_idx" ON "crm_channel_settings_versions"("channelConnectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "crm_channel_settings_versions" ADD CONSTRAINT "crm_channel_settings_versions_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "crm_channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_channel_settings_versions" ADD CONSTRAINT "crm_channel_settings_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
