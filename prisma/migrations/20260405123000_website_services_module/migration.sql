CREATE TABLE "website_services" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "nombre" TEXT NOT NULL,
  "descripcion" TEXT,
  "websiteUrl" TEXT,
  "domainName" TEXT,
  "hostedAt" TEXT,
  "startedAt" TIMESTAMP(3),
  "domainExpiresAt" TIMESTAMP(3),
  "hostingExpiresAt" TIMESTAMP(3),
  "soldAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isPaid" BOOLEAN NOT NULL DEFAULT false,
  "isCancelled" BOOLEAN NOT NULL DEFAULT false,
  "loginUsername" TEXT,
  "loginPasswordEncrypted" TEXT,
  "contactName" TEXT,
  "contactPhone" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "website_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "website_service_module_access" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "website_service_module_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "website_service_module_access_empresaId_userId_key" ON "website_service_module_access"("empresaId", "userId");
CREATE INDEX "website_services_empresaId_createdAt_idx" ON "website_services"("empresaId", "createdAt");
CREATE INDEX "website_services_empresaId_domainExpiresAt_idx" ON "website_services"("empresaId", "domainExpiresAt");
CREATE INDEX "website_services_empresaId_hostingExpiresAt_idx" ON "website_services"("empresaId", "hostingExpiresAt");
CREATE INDEX "website_services_empresaId_isCancelled_idx" ON "website_services"("empresaId", "isCancelled");
CREATE INDEX "website_service_module_access_empresaId_idx" ON "website_service_module_access"("empresaId");
CREATE INDEX "website_service_module_access_userId_idx" ON "website_service_module_access"("userId");

ALTER TABLE "website_services"
  ADD CONSTRAINT "website_services_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_services"
  ADD CONSTRAINT "website_services_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "website_services"
  ADD CONSTRAINT "website_services_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "website_service_module_access"
  ADD CONSTRAINT "website_service_module_access_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_service_module_access"
  ADD CONSTRAINT "website_service_module_access_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;