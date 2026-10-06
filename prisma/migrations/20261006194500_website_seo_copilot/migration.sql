ALTER TABLE "crm_seo_keywords"
ADD COLUMN "searchIntent" TEXT NOT NULL DEFAULT 'COMMERCIAL',
ADD COLUMN "serviceType" TEXT,
ADD COLUMN "locationCode" INTEGER,
ADD COLUMN "locationName" TEXT;

CREATE TABLE "crm_seo_serp_tasks" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerTaskId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "costUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "requestJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_seo_serp_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_seo_serp_tasks_providerTaskId_key" ON "crm_seo_serp_tasks"("providerTaskId");
CREATE INDEX "crm_seo_serp_tasks_empresaId_status_requestedAt_idx" ON "crm_seo_serp_tasks"("empresaId", "status", "requestedAt");
CREATE INDEX "crm_seo_serp_tasks_keywordId_requestedAt_idx" ON "crm_seo_serp_tasks"("keywordId", "requestedAt");

ALTER TABLE "crm_seo_serp_tasks" ADD CONSTRAINT "crm_seo_serp_tasks_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_seo_serp_tasks" ADD CONSTRAINT "crm_seo_serp_tasks_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "crm_seo_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "website_seo_audits" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "finalUrl" TEXT NOT NULL,
    "statusCode" INTEGER,
    "healthScore" INTEGER NOT NULL,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "checksJson" JSONB NOT NULL DEFAULT '{}',
    "recommendationsJson" JSONB NOT NULL DEFAULT '[]',
    "metricsJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_seo_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "website_seo_audits_empresaId_createdAt_idx" ON "website_seo_audits"("empresaId", "createdAt");
CREATE INDEX "website_seo_audits_websiteProjectId_createdAt_idx" ON "website_seo_audits"("websiteProjectId", "createdAt");

ALTER TABLE "website_seo_audits" ADD CONSTRAINT "website_seo_audits_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "website_seo_audits" ADD CONSTRAINT "website_seo_audits_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "website_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;