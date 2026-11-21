-- Control de consumo y cuotas de mensajería (cuotas comerciales ORDEx).

-- CreateTable
CREATE TABLE "messaging_quota_policies" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT,
    "channelConnectionId" TEXT,
    "provider" TEXT,
    "category" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'EMPRESA',
    "window" TEXT NOT NULL DEFAULT 'MONTHLY',
    "limitValue" INTEGER NOT NULL,
    "overagePolicy" TEXT NOT NULL DEFAULT 'BLOCK',
    "warningPct" INTEGER NOT NULL DEFAULT 70,
    "criticalPct" INTEGER NOT NULL DEFAULT 85,
    "blockPct" INTEGER NOT NULL DEFAULT 100,
    "timezone" TEXT NOT NULL DEFAULT 'America/Bogota',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "messaging_quota_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messaging_usage_counters" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "messaging_usage_counters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messaging_usage_events" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "category" TEXT,
    "countryCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "estimatedCost" DOUBLE PRECISION,
    "providerMessageId" TEXT,
    "messageId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messaging_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messaging_quota_policies_empresaId_scope_window_idx" ON "messaging_quota_policies"("empresaId", "scope", "window");
CREATE INDEX "messaging_quota_policies_channelConnectionId_idx" ON "messaging_quota_policies"("channelConnectionId");
CREATE INDEX "messaging_quota_policies_provider_category_idx" ON "messaging_quota_policies"("provider", "category");
CREATE INDEX "messaging_quota_policies_enabled_idx" ON "messaging_quota_policies"("enabled");

CREATE UNIQUE INDEX "usage_counter_period_key" ON "messaging_usage_counters"("empresaId", "channelConnectionId", "provider", "window", "periodKey");
CREATE INDEX "messaging_usage_counters_empresaId_window_periodKey_idx" ON "messaging_usage_counters"("empresaId", "window", "periodKey");

CREATE UNIQUE INDEX "messaging_usage_events_providerMessageId_key" ON "messaging_usage_events"("providerMessageId");
CREATE INDEX "messaging_usage_events_empresaId_occurredAt_idx" ON "messaging_usage_events"("empresaId", "occurredAt");
CREATE INDEX "messaging_usage_events_channelConnectionId_occurredAt_idx" ON "messaging_usage_events"("channelConnectionId", "occurredAt");
CREATE INDEX "messaging_usage_events_empresaId_provider_occurredAt_idx" ON "messaging_usage_events"("empresaId", "provider", "occurredAt");
CREATE INDEX "messaging_usage_events_empresaId_status_occurredAt_idx" ON "messaging_usage_events"("empresaId", "status", "occurredAt");
