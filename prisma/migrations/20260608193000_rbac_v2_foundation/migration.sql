CREATE TYPE "RbacScopeType" AS ENUM (
  'GLOBAL_PLATFORM',
  'EMPRESA',
  'SEDE',
  'TEAM',
  'OWN',
  'ASSIGNED',
  'VERTICAL'
);

CREATE TYPE "RbacGrantSource" AS ENUM (
  'DIRECT',
  'ROLE_TEMPLATE',
  'MIGRATION',
  'SYSTEM'
);

CREATE TABLE "domain_entitlements" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "domain_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "capability_entitlements" (
  "id" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "subdomain" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "capability_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_capability_grants" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "subdomain" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "scopeType" "RbacScopeType" NOT NULL,
  "scopeValue" TEXT,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "source" "RbacGrantSource" NOT NULL DEFAULT 'DIRECT',
  "grantedByUserId" TEXT,
  "notes" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_capability_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_entitlements_empresaId_domain_key" ON "domain_entitlements"("empresaId", "domain");
CREATE INDEX "domain_entitlements_empresaId_idx" ON "domain_entitlements"("empresaId");

CREATE UNIQUE INDEX "capability_entitlements_empresaId_domain_subdomain_action_key" ON "capability_entitlements"("empresaId", "domain", "subdomain", "action");
CREATE INDEX "capability_entitlements_empresaId_domain_idx" ON "capability_entitlements"("empresaId", "domain");

CREATE INDEX "user_capability_grants_userId_empresaId_idx" ON "user_capability_grants"("userId", "empresaId");
CREATE INDEX "user_capability_grants_empresaId_domain_subdomain_action_idx" ON "user_capability_grants"("empresaId", "domain", "subdomain", "action");
CREATE INDEX "user_capability_grants_scopeType_scopeValue_idx" ON "user_capability_grants"("scopeType", "scopeValue");

ALTER TABLE "domain_entitlements"
  ADD CONSTRAINT "domain_entitlements_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "capability_entitlements"
  ADD CONSTRAINT "capability_entitlements_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_capability_grants"
  ADD CONSTRAINT "user_capability_grants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_capability_grants"
  ADD CONSTRAINT "user_capability_grants_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "empresas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_capability_grants"
  ADD CONSTRAINT "user_capability_grants_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;