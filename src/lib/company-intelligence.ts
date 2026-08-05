import { prisma } from '@/lib/prisma'
import type { DashboardConfig } from '@/lib/company-onboarding'

export type CompanyIntelligenceSettings = {
  enabled: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function parseCompanyIntelligenceSettings(dashboardConfig: unknown): CompanyIntelligenceSettings {
  if (!isRecord(dashboardConfig) || !isRecord(dashboardConfig.intelligence)) {
    return { enabled: false }
  }

  return {
    enabled: dashboardConfig.intelligence.enabled === true,
  }
}

export function isCompanyIntelligenceEnabled(dashboardConfig: unknown): boolean {
  return parseCompanyIntelligenceSettings(dashboardConfig).enabled
}

export function mergeCompanyIntelligenceSettings(
  dashboardConfig: unknown,
  settings: CompanyIntelligenceSettings,
): Record<string, unknown> {
  const current = isRecord(dashboardConfig) ? { ...dashboardConfig } : {}
  const currentIntelligence = isRecord(current.intelligence) ? current.intelligence : {}

  return {
    ...current,
    intelligence: {
      ...currentIntelligence,
      enabled: settings.enabled,
    },
  }
}

export function removeIntelligenceHrefFromDashboardConfig(config: DashboardConfig | null): DashboardConfig | null {
  if (!config) return config

  return {
    ...config,
    prioritizedHrefs: config.prioritizedHrefs.filter((href) => href !== '/dashboard/inteligencia'),
    allowedHrefs: config.allowedHrefs.filter((href) => href !== '/dashboard/inteligencia'),
  }
}

export async function isCompanyIntelligenceEnabledForEmpresa(empresaId: string): Promise<boolean> {
  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { dashboardConfig: true },
  })

  return isCompanyIntelligenceEnabled(empresa?.dashboardConfig)
}