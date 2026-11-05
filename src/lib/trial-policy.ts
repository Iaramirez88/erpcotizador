import type { PlanTier, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { PERSONAL_TRIAL_BUSINESS_DAYS, addBusinessDays } from '@/lib/retention-policy'

/**
 * Reglas del trial gratuito del espacio personal.
 *
 * El trial es **por persona**, no por empresa: si alguien ya lo consumió, ningún espacio
 * personal nuevo (por ejemplo al salir de una empresa o al reingresar) puede volver a
 * otorgar los 7 días hábiles gratis. Esto evita el abuso detectado al "volver a entrar" o
 * al cambiar de espacio de trabajo.
 *
 * La duración y la política de retención viven en `@/lib/retention-policy` para que la UI
 * y los correos usen exactamente los mismos números.
 */

export const PERSONAL_TRIAL_DAYS = PERSONAL_TRIAL_BUSINESS_DAYS
export const PERSONAL_TRIAL_TIER: PlanTier = 'INTERMEDIO'

const PERSONAL_NIT_PREFIX = 'PERS-'

/**
 * Ventana del trial: 7 días **hábiles** (lun–vie) desde el inicio, conservando la hora.
 */
export function addTrialWindow(startedAt: Date, days = PERSONAL_TRIAL_DAYS): Date {
  return addBusinessDays(startedAt, days)
}

export function buildPersonalNit(userId: string): string {
  return `${PERSONAL_NIT_PREFIX}${userId}`
}

export function isPersonalNit(nit: string | null | undefined): boolean {
  return (nit ?? '').trim().toUpperCase().startsWith(PERSONAL_NIT_PREFIX)
}

export function normalizeAccountEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export type PersonalEmpresaLookup = {
  id: string
  nombre: string
  nit: string
  trialTier: PlanTier | null
  trialStartedAt: Date | null
  trialValidUntil: Date | null
}

const PERSONAL_EMPRESA_SELECT = {
  id: true,
  nombre: true,
  nit: true,
  trialTier: true,
  trialStartedAt: true,
  trialValidUntil: true,
} as const

/**
 * Busca el espacio personal que la persona ya tenía para reutilizar su historial en lugar
 * de crear uno nuevo: por `PERS-<userId>`, por propiedad (`planOwnerUserId`) o por email.
 */
export async function findExistingPersonalEmpresa(args: {
  userId: string
  email?: string | null
}): Promise<PersonalEmpresaLookup | null> {
  const email = normalizeAccountEmail(args.email)
  const or: Prisma.EmpresaWhereInput[] = [
    { nit: buildPersonalNit(args.userId) },
    { planOwnerUserId: args.userId, nit: { startsWith: PERSONAL_NIT_PREFIX } },
  ]
  if (email) or.push({ email, nit: { startsWith: PERSONAL_NIT_PREFIX } })

  return prisma.empresa.findFirst({
    where: { OR: or },
    orderBy: { createdAt: 'asc' },
    select: PERSONAL_EMPRESA_SELECT,
  })
}

/**
 * `true` si la persona ya consumió el trial gratuito en cualquier espacio personal
 * (por id, por propiedad o por email).
 */
export async function hasConsumedPersonalTrial(args: {
  userId?: string | null
  email?: string | null
  excludeEmpresaId?: string | null
}): Promise<boolean> {
  const or: Prisma.EmpresaWhereInput[] = []
  if (args.userId) {
    or.push({ planOwnerUserId: args.userId }, { nit: buildPersonalNit(args.userId) })
  }
  const email = normalizeAccountEmail(args.email)
  if (email) or.push({ email })

  if (!or.length) return false

  const where: Prisma.EmpresaWhereInput = {
    trialStartedAt: { not: null },
    nit: { startsWith: PERSONAL_NIT_PREFIX },
    OR: or,
  }
  if (args.excludeEmpresaId) where.id = { not: args.excludeEmpresaId }

  const count = await prisma.empresa.count({ where })
  return count > 0
}

export type PersonalTrialFields = {
  trialTier: PlanTier | null
  trialStartedAt: Date | null
  trialValidUntil: Date | null
}

/**
 * Campos de trial para un espacio personal nuevo. Solo la primera vez por persona;
 * en reingresos devuelve `null` en los tres campos (sin trial nuevo).
 */
export async function resolvePersonalTrialFields(args: {
  userId?: string | null
  email?: string | null
  excludeEmpresaId?: string | null
  now?: Date
}): Promise<PersonalTrialFields> {
  const consumed = await hasConsumedPersonalTrial({
    userId: args.userId,
    email: args.email,
    excludeEmpresaId: args.excludeEmpresaId,
  })

  if (consumed) {
    return { trialTier: null, trialStartedAt: null, trialValidUntil: null }
  }

  const now = args.now ?? new Date()
  return {
    trialTier: PERSONAL_TRIAL_TIER,
    trialStartedAt: now,
    trialValidUntil: addTrialWindow(now),
  }
}
