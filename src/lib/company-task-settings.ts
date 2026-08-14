function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export type CompanyTaskSettings = {
  requireTaskCancellationReason: boolean
}

export function parseCompanyTaskSettings(dashboardConfig: unknown): CompanyTaskSettings {
  if (!isRecord(dashboardConfig) || !isRecord(dashboardConfig.tasks)) {
    return { requireTaskCancellationReason: false }
  }

  return {
    requireTaskCancellationReason: dashboardConfig.tasks.requireTaskCancellationReason === true,
  }
}

export function mergeCompanyTaskSettings(
  dashboardConfig: unknown,
  settings: Partial<CompanyTaskSettings>,
) {
  const current = isRecord(dashboardConfig) ? { ...dashboardConfig } : {}
  const currentTasks = isRecord(current.tasks) ? { ...current.tasks } : {}

  if (typeof settings.requireTaskCancellationReason === 'boolean') {
    currentTasks.requireTaskCancellationReason = settings.requireTaskCancellationReason
  }

  current.tasks = currentTasks
  return current
}