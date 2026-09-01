type KpiSettingsRecord = Record<string, unknown>
const CRM_KPI_CAMPAIGN_SCOPE_SEPARATOR = '::'

export type CrmKpiScopeType = 'COMPANY' | 'SEDE' | 'CHANNEL' | 'CAMPAIGN'

export type CrmKpiGoalSettings = {
  operationalTarget: number | null
  capturesTarget: number | null
  conversationsTarget: number | null
  conversionTargetPct: number | null
  minimumAcceptancePct: number | null
}

export type CompanyCrmKpiSettings = {
  company: CrmKpiGoalSettings
  bySede: Record<string, CrmKpiGoalSettings>
  byChannel: Record<string, CrmKpiGoalSettings>
  byCampaign: Record<string, CrmKpiGoalSettings>
}

export function buildCrmCampaignScopeId(channelId: string, campaignName: string): string {
  return `${channelId.trim()}${CRM_KPI_CAMPAIGN_SCOPE_SEPARATOR}${campaignName.trim()}`
}

export function parseCrmCampaignScopeId(scopeId: string): { channelId: string; campaignName: string } | null {
  const normalized = scopeId.trim()
  if (!normalized) return null

  const separatorIndex = normalized.indexOf(CRM_KPI_CAMPAIGN_SCOPE_SEPARATOR)
  if (separatorIndex <= 0) return null

  const channelId = normalized.slice(0, separatorIndex).trim()
  const campaignName = normalized.slice(separatorIndex + CRM_KPI_CAMPAIGN_SCOPE_SEPARATOR.length).trim()
  if (!channelId || !campaignName) return null

  return { channelId, campaignName }
}

function isRecord(value: unknown): value is KpiSettingsRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function getDefaultCrmKpiGoalSettings(): CrmKpiGoalSettings {
  return {
    operationalTarget: null,
    capturesTarget: null,
    conversationsTarget: null,
    conversionTargetPct: null,
    minimumAcceptancePct: null,
  }
}

function parseGoalSettings(value: unknown): CrmKpiGoalSettings {
  if (!isRecord(value)) return getDefaultCrmKpiGoalSettings()

  return {
    operationalTarget: normalizeNullableNumber(value.operationalTarget),
    capturesTarget: normalizeNullableNumber(value.capturesTarget),
    conversationsTarget: normalizeNullableNumber(value.conversationsTarget),
    conversionTargetPct: normalizeNullableNumber(value.conversionTargetPct),
    minimumAcceptancePct: normalizeNullableNumber(value.minimumAcceptancePct),
  }
}

function parseSettingsMap(value: unknown): Record<string, CrmKpiGoalSettings> {
  if (!isRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, item]) => [key, parseGoalSettings(item)]),
  )
}

export function parseCompanyCrmKpiSettings(dashboardConfig: unknown): CompanyCrmKpiSettings {
  if (!isRecord(dashboardConfig) || !isRecord(dashboardConfig.crmKpis)) {
    return {
      company: getDefaultCrmKpiGoalSettings(),
      bySede: {},
      byChannel: {},
      byCampaign: {},
    }
  }

  const section = dashboardConfig.crmKpis
  return {
    company: parseGoalSettings(section.company),
    bySede: parseSettingsMap(section.bySede),
    byChannel: parseSettingsMap(section.byChannel),
    byCampaign: parseSettingsMap(section.byCampaign),
  }
}

export function mergeCompanyCrmKpiSettings(
  dashboardConfig: unknown,
  args: { scopeType: CrmKpiScopeType; scopeId?: string | null; settings: Partial<CrmKpiGoalSettings> },
): Record<string, unknown> {
  const current = isRecord(dashboardConfig) ? { ...dashboardConfig } : {}
  const parsed = parseCompanyCrmKpiSettings(current)
  const mergedSettings: CrmKpiGoalSettings = {
    operationalTarget: args.settings.operationalTarget ?? null,
    capturesTarget: args.settings.capturesTarget ?? null,
    conversationsTarget: args.settings.conversationsTarget ?? null,
    conversionTargetPct: args.settings.conversionTargetPct ?? null,
    minimumAcceptancePct: args.settings.minimumAcceptancePct ?? null,
  }

  if (args.scopeType === 'COMPANY') {
    parsed.company = mergedSettings
  }

  if (args.scopeType === 'SEDE' && args.scopeId) {
    parsed.bySede = {
      ...parsed.bySede,
      [args.scopeId]: mergedSettings,
    }
  }

  if (args.scopeType === 'CHANNEL' && args.scopeId) {
    parsed.byChannel = {
      ...parsed.byChannel,
      [args.scopeId]: mergedSettings,
    }
  }

  if (args.scopeType === 'CAMPAIGN' && args.scopeId) {
    parsed.byCampaign = {
      ...parsed.byCampaign,
      [args.scopeId]: mergedSettings,
    }
  }

  current.crmKpis = parsed
  return current
}