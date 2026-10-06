-- AlterTable
ALTER TABLE "crm_lead_captures" ADD COLUMN "gclid" TEXT;

-- CreateTable
CREATE TABLE "crm_marketing_connections" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Google Marketing',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "googleEmail" TEXT,
    "googleAccountId" TEXT,
    "googleAdsCustomerId" TEXT,
    "googleAnalyticsPropertyId" TEXT,
    "searchConsoleSiteUrl" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "settingsJson" JSONB NOT NULL DEFAULT '{}',
    "createdById" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_marketing_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_ad_campaign_daily_metrics" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "campaignStatus" TEXT,
    "currencyCode" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crmLeads" INTEGER NOT NULL DEFAULT 0,
    "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
    "opportunities" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "crmRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crmGrossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rawJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_ad_campaign_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_seo_keywords" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "websiteProjectId" TEXT,
    "domain" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'COL',
    "language" TEXT NOT NULL DEFAULT 'es',
    "device" TEXT NOT NULL DEFAULT 'DESKTOP',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "latestPosition" DOUBLE PRECISION,
    "previousPosition" DOUBLE PRECISION,
    "latestUrl" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_seo_keywords_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_seo_keyword_positions" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "position" DOUBLE PRECISION,
    "resultUrl" TEXT,
    "clicks" INTEGER,
    "impressions" INTEGER,
    "ctr" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'SEARCH_CONSOLE',
    "rawJson" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "crm_seo_keyword_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_content_briefs" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "websiteProjectId" TEXT,
    "title" TEXT NOT NULL,
    "seedIdea" TEXT NOT NULL,
    "targetKeyword" TEXT,
    "competitorUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "contentType" TEXT NOT NULL DEFAULT 'BLOG_POST',
    "generatedContentJson" JSONB NOT NULL DEFAULT '{}',
    "generatedText" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_content_briefs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_lead_captures_empresaId_gclid_idx" ON "crm_lead_captures"("empresaId", "gclid");
CREATE INDEX "crm_marketing_connections_empresaId_status_idx" ON "crm_marketing_connections"("empresaId", "status");
CREATE INDEX "crm_marketing_connections_createdById_idx" ON "crm_marketing_connections"("createdById");
CREATE UNIQUE INDEX "crm_ad_campaign_daily_metrics_connectionId_metricDate_campaignId_key" ON "crm_ad_campaign_daily_metrics"("connectionId", "metricDate", "campaignId");
CREATE INDEX "crm_ad_campaign_daily_metrics_empresaId_metricDate_idx" ON "crm_ad_campaign_daily_metrics"("empresaId", "metricDate");
CREATE INDEX "crm_ad_campaign_daily_metrics_empresaId_campaignId_metricDate_idx" ON "crm_ad_campaign_daily_metrics"("empresaId", "campaignId", "metricDate");
CREATE UNIQUE INDEX "crm_seo_keywords_empresaId_domain_keyword_country_device_key" ON "crm_seo_keywords"("empresaId", "domain", "keyword", "country", "device");
CREATE INDEX "crm_seo_keywords_empresaId_active_updatedAt_idx" ON "crm_seo_keywords"("empresaId", "active", "updatedAt");
CREATE INDEX "crm_seo_keywords_websiteProjectId_idx" ON "crm_seo_keywords"("websiteProjectId");
CREATE INDEX "crm_seo_keyword_positions_empresaId_checkedAt_idx" ON "crm_seo_keyword_positions"("empresaId", "checkedAt");
CREATE INDEX "crm_seo_keyword_positions_keywordId_checkedAt_idx" ON "crm_seo_keyword_positions"("keywordId", "checkedAt");
CREATE INDEX "crm_content_briefs_empresaId_status_updatedAt_idx" ON "crm_content_briefs"("empresaId", "status", "updatedAt");
CREATE INDEX "crm_content_briefs_websiteProjectId_idx" ON "crm_content_briefs"("websiteProjectId");
CREATE INDEX "crm_content_briefs_createdById_idx" ON "crm_content_briefs"("createdById");

ALTER TABLE "crm_marketing_connections" ADD CONSTRAINT "crm_marketing_connections_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_marketing_connections" ADD CONSTRAINT "crm_marketing_connections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_ad_campaign_daily_metrics" ADD CONSTRAINT "crm_ad_campaign_daily_metrics_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_ad_campaign_daily_metrics" ADD CONSTRAINT "crm_ad_campaign_daily_metrics_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "crm_marketing_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_seo_keywords" ADD CONSTRAINT "crm_seo_keywords_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_seo_keywords" ADD CONSTRAINT "crm_seo_keywords_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "website_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_seo_keyword_positions" ADD CONSTRAINT "crm_seo_keyword_positions_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_seo_keyword_positions" ADD CONSTRAINT "crm_seo_keyword_positions_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "crm_seo_keywords"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_content_briefs" ADD CONSTRAINT "crm_content_briefs_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_content_briefs" ADD CONSTRAINT "crm_content_briefs_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "website_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_content_briefs" ADD CONSTRAINT "crm_content_briefs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
