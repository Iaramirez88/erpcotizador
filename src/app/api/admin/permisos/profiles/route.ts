import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireEmpresaIdForUser } from '@/lib/rbac'

export const runtime = 'nodejs'

const ACCESS_LEVELS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']
const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']
const MODULE_KEYS = new Set<string>(Object.values(ModuleKey))

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeModuleLevels(value: unknown) {
  if (!isPlainObject(value)) return {} as Record<string, AccessLevel>
  const next: Record<string, AccessLevel> = {}
  for (const [key, rawLevel] of Object.entries(value)) {
    if (!MODULE_KEYS.has(key)) continue
    if (typeof rawLevel !== 'string' || !ACCESS_LEVELS.includes(rawLevel as AccessLevel)) continue
    next[key] = rawLevel as AccessLevel
  }
  return next
}

function normalizeCapabilityLevels(value: unknown) {
  if (!isPlainObject(value)) return {} as Record<string, { domain: string; subdomain: string; level: AccessLevel; label: string | null }>
  const next: Record<string, { domain: string; subdomain: string; level: AccessLevel; label: string | null }> = {}
  for (const [key, rawItem] of Object.entries(value)) {
    if (!isPlainObject(rawItem)) continue
    const domain = typeof rawItem.domain === 'string' ? rawItem.domain.trim() : ''
    const subdomain = typeof rawItem.subdomain === 'string' ? rawItem.subdomain.trim() : ''
    const label = typeof rawItem.label === 'string' ? rawItem.label.trim() : null
    const rawLevel = typeof rawItem.level === 'string' ? rawItem.level.trim() : ''
    if (!domain || !subdomain || !ACCESS_LEVELS.includes(rawLevel as AccessLevel)) continue
    next[key] = { domain, subdomain, level: rawLevel as AccessLevel, label }
  }
  return next
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!isPlainObject(body)) {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const sedeId = typeof body.sedeId === 'string' ? body.sedeId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const sedeRole = typeof body.sedeRole === 'string' ? body.sedeRole.trim() as SedeRole : null
  const globalAccessLevel = typeof body.globalAccessLevel === 'string' ? body.globalAccessLevel.trim() as AccessLevel : null

  if (!sedeId || !name || !sedeRole || !globalAccessLevel || !SEDE_ROLES.includes(sedeRole) || !ACCESS_LEVELS.includes(globalAccessLevel)) {
    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 })
  }

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
  if (!sede || sede.empresaId !== empresaId) {
    return NextResponse.json({ success: false, error: 'Sede inválida' }, { status: 400 })
  }

  const requesterMembership = await prisma.sedeMembership.findUnique({
    where: { sedeId_userId: { sedeId, userId: session.user.id } },
    select: { role: true },
  })

  const isAllowed = session.user.role === 'ADMIN' || requesterMembership?.role === 'ADMIN'
  if (!isAllowed) {
    return NextResponse.json({ success: false, error: 'Solo los administradores pueden crear reglas de permisos.' }, { status: 403 })
  }

  const moduleLevels = normalizeModuleLevels(body.moduleLevels)
  const capabilityLevels = normalizeCapabilityLevels(body.capabilityLevels)

  try {
    const created = await prisma.permissionProfile.create({
      data: {
        empresaId,
        sedeId,
        createdByUserId: session.user.id,
        name,
        description: description || null,
        sedeRole,
        globalAccessLevel,
        moduleLevels,
        capabilityLevels,
      },
      select: { id: true, name: true },
    })

    return NextResponse.json({ success: true, data: created })
  } catch {
    return NextResponse.json({ success: false, error: 'No fue posible guardar la regla de permisos.' }, { status: 400 })
  }
}