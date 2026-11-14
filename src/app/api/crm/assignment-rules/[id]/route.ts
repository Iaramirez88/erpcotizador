import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { parseCrmAssignmentMatchJson, validateCrmAssignmentTarget } from '@/lib/crm-assignment'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

async function loadRule(id: string, empresaId: string) {
  const rule = await prisma.crmAssignmentRule.findUnique({ where: { id } })
  if (!rule || rule.empresaId !== empresaId) return null
  return rule
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ASSIGNMENT_RULES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const rule = await loadRule(id, access.empresaId)
    if (!rule) return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const assigneeUserId = Object.prototype.hasOwnProperty.call(body ?? {}, 'assigneeUserId')
      ? normalizeString(body?.assigneeUserId)
      : normalizeString(rule.assigneeUserId)
    const teamId = Object.prototype.hasOwnProperty.call(body ?? {}, 'teamId')
      ? normalizeString(body?.teamId)
      : normalizeString(rule.teamId)
    const priorityRaw = Number(body?.priority)

    if (
      Object.prototype.hasOwnProperty.call(body ?? {}, 'assigneeUserId') ||
      Object.prototype.hasOwnProperty.call(body ?? {}, 'teamId')
    ) {
      const targetError = await validateCrmAssignmentTarget({
        client: prisma,
        empresaId: access.empresaId,
        assigneeUserId,
        teamId,
      })
      if (targetError) return NextResponse.json({ error: targetError }, { status: 400 })
    }

    const updated = await prisma.crmAssignmentRule.update({
      where: { id: rule.id },
      data: {
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'name') && name ? { name } : {}),
        ...(Number.isFinite(priorityRaw) ? { priority: Math.trunc(priorityRaw) } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'active') ? { active: Boolean(body?.active) } : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'stopOnMatch')
          ? { stopOnMatch: Boolean(body?.stopOnMatch) }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'matchJson') ||
        Object.prototype.hasOwnProperty.call(body ?? {}, 'match')
          ? {
              matchJson: parseCrmAssignmentMatchJson(
                body?.matchJson ?? body?.match
              ) as Prisma.InputJsonValue,
            }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'assigneeUserId')
          ? { assigneeUserId: assigneeUserId || null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'teamId') ? { teamId: teamId || null } : {}),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error actualizando regla de asignación:', error)
    return NextResponse.json({ error: 'Error actualizando regla de asignación' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ASSIGNMENT_RULES',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const rule = await loadRule(id, access.empresaId)
    if (!rule) return NextResponse.json({ error: 'Regla no encontrada' }, { status: 404 })

    await prisma.crmAssignmentRule.delete({ where: { id: rule.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando regla de asignación:', error)
    return NextResponse.json({ error: 'Error eliminando regla de asignación' }, { status: 500 })
  }
}
