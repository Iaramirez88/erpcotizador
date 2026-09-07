function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type CompanyLithographySettings = {
  quoteToolsEnabled: boolean
}

export type UserLithographySettings = {
  quoteToolsEnabled: boolean
}

export function parseCompanyLithographySettings(dashboardConfig: unknown): CompanyLithographySettings {
  if (!isRecord(dashboardConfig) || !isRecord(dashboardConfig.lithography)) {
    return { quoteToolsEnabled: false }
  }

  return {
    quoteToolsEnabled: dashboardConfig.lithography.quoteToolsEnabled === true,
  }
}

export function mergeCompanyLithographySettings(
  dashboardConfig: unknown,
  settings: Partial<CompanyLithographySettings>,
): Record<string, unknown> {
  const current = isRecord(dashboardConfig) ? { ...dashboardConfig } : {}
  const currentLithography = isRecord(current.lithography) ? { ...current.lithography } : {}

  if (typeof settings.quoteToolsEnabled === 'boolean') {
    currentLithography.quoteToolsEnabled = settings.quoteToolsEnabled
  }

  current.lithography = currentLithography
  return current
}

export function parseUserLithographySettings(tutorialConfig: unknown): UserLithographySettings {
  if (!isRecord(tutorialConfig) || !isRecord(tutorialConfig.lithography)) {
    return { quoteToolsEnabled: false }
  }

  return {
    quoteToolsEnabled: tutorialConfig.lithography.quoteToolsEnabled === true,
  }
}

export function mergeUserLithographySettings(
  tutorialConfig: unknown,
  settings: Partial<UserLithographySettings>,
): Record<string, unknown> {
  const current = isRecord(tutorialConfig) ? { ...tutorialConfig } : {}
  const currentLithography = isRecord(current.lithography) ? { ...current.lithography } : {}

  if (typeof settings.quoteToolsEnabled === 'boolean') {
    currentLithography.quoteToolsEnabled = settings.quoteToolsEnabled
  }

  current.lithography = currentLithography
  return current
}

export function resolveLithographyQuoteToolsEnabled(args: {
  businessType?: string | null
  companyDashboardConfig?: unknown
  userTutorialConfig?: unknown
}) {
  if (args.businessType === 'LITOGRAFIA') return true
  if (parseCompanyLithographySettings(args.companyDashboardConfig).quoteToolsEnabled) return true
  if (parseUserLithographySettings(args.userTutorialConfig).quoteToolsEnabled) return true
  return false
}