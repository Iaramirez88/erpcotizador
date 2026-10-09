ALTER TABLE "crm_ad_campaign_daily_metrics"
ADD COLUMN "dailyBudget" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE "crm_ad_entity_daily_metrics" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityStatus" TEXT,
    "campaignId" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "adGroupId" TEXT,
    "adGroupName" TEXT,
    "keywordText" TEXT,
    "matchType" TEXT,
    "currencyCode" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "crmLeads" INTEGER NOT NULL DEFAULT 0,
    "qualifiedLeads" INTEGER NOT NULL DEFAULT 0,
    "opportunities" INTEGER NOT NULL DEFAULT 0,
    "sales" INTEGER NOT NULL DEFAULT 0,
    "crmRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rawJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_ad_entity_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_ad_entity_daily_metrics_connectionId_metricDate_entityType_entityId_key"
ON "crm_ad_entity_daily_metrics"("connectionId", "metricDate", "entityType", "entityId");
CREATE INDEX "crm_ad_entity_daily_metrics_empresaId_metricDate_entityType_idx"
ON "crm_ad_entity_daily_metrics"("empresaId", "metricDate", "entityType");
CREATE INDEX "crm_ad_entity_daily_metrics_empresaId_campaignId_metricDate_idx"
ON "crm_ad_entity_daily_metrics"("empresaId", "campaignId", "metricDate");

ALTER TABLE "crm_ad_entity_daily_metrics"
ADD CONSTRAINT "crm_ad_entity_daily_metrics_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_ad_entity_daily_metrics"
ADD CONSTRAINT "crm_ad_entity_daily_metrics_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "crm_marketing_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;