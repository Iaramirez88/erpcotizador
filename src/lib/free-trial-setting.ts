import { prisma } from '@/lib/prisma'

/** Duración por defecto del trial gratuito (días calendario). */
export const DEFAULT_FREE_TRIAL_DAYS = 15

/** Clave única del registro de configuración. */
export const FREE_TRIAL_SETTING_KEY = 'freeTrialDays'

/** Días restantes que disparan el recordatorio "te quedan 7 días". */
export const TRIAL_REMINDER_7_DAYS = 7
/** Días restantes que disparan el recordatorio "te queda 1 día". */
export const TRIAL_REMINDER_1_DAY = 1

export type TrialMilestone = 'welcome' | 'sevenDaysLeft' | 'oneDayLeft'

/**
 * Clave guardada en `UiPreference.tutorial.seen` para cada aviso del trial.
 * El aviso de bienvenida conserva la clave histórica `dashboardWelcomeTrial15d`
 * para no volver a mostrar el modal a quienes ya lo vieron.
 */
export const TRIAL_MILESTONE_SEEN_KEYS: Record<TrialMilestone, string> = {
  welcome: 'dashboardWelcomeTrial15d',
  sevenDaysLeft: 'dashboardTrialReminder7d',
  oneDayLeft: 'dashboardTrialReminder1d',
}

export async function getFreeTrialDays(): Promise<number> {
  try {
    const row = await prisma.freeTrialSetting.findUnique({
      where: { key: FREE_TRIAL_SETTING_KEY },
      select: { value: true },
    })
    if (row && Number.isFinite(row.value) && row.value > 0) return row.value
  } catch {
    // Si la tabla aún no está migrada se usa el valor por defecto.
  }
  return DEFAULT_FREE_TRIAL_DAYS
}

export async function setFreeTrialDays(days: number): Promise<number> {
  const value = Math.max(1, Math.min(365, Math.trunc(days)))
  const row = await prisma.freeTrialSetting.upsert({
    where: { key: FREE_TRIAL_SETTING_KEY },
    create: { key: FREE_TRIAL_SETTING_KEY, value },
    update: { value },
    select: { value: true },
  })
  return row.value
}
