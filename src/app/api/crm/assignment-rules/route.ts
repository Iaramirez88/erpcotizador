import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { parseCrmAssignmentMatchJson, validateCrmAssignmentTarget } from '@/lib/crm-assignment'

export const runtime = 'nodejs'

function parseAssignmentMatchInput(value: unknown) {
  return parseCrmAssignmentMatchJson(value)
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ASSIGNMENT_RULES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const rules = await prisma.crmAssignmentRule.findMany({
      where: { empresaId: access.empresaId },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })

    const userIds = Array.from(new Set(rules.map((rule) => rule.assigneeUserId).filter((id): id is string => Boolean(id))))
    const teamIds = Array.from(new Set(rules.map((rule) => rule.teamId).filter((id): id is string => Boolean(id))))

    const [users, teams] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
        : Promise.resolve([]),
      teamIds.length
        ? prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, nombre: true } })
        : Promise.resolve([]),
    ])

    const userMap = new Map(users.map((user) => [user.id, user]))
    const teamMap = new Map(teams.map((team) => [team.id, team]))

    return NextResponse.json({
      success: true,
      data: rules.map((rule) => ({
        ...rule,
        match: parseCrmAssignmentMatchJson(rule.matchJson),
        assigneeUser: rule.assigneeUserId ? userMap.get(rule.assigneeUserId) ?? null : null,
        team: rule.teamId ? teamMap.get(rule.teamId) ?? null : null,
      })),
    })
  } catch (error) {
    console.error('Error listando reglas de asignación:', error)
    return NextResponse.json({ error: 'Error listando reglas de asignación' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'ASSIGNMENT_RULES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const assigneeUserId = normalizeString(body?.assigneeUserId)
    const teamId = normalizeString(body?.teamId)
    const priorityRaw = Number(body?.priority)
    const stopOnMatch = body?.stopOnMatch !== false
    const active = body?.active !== false
    const match = parseAssignmentMatchInput(body?.matchJson ?? body?.match)

    if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })

    const targetError = await validateCrmAssignmentTarget({
      client: prisma,
      empresaId: access.empresaId,
      assigneeUserId,
      teamId,
    })
    if (targetError) return NextResponse.json({ error: targetError }, { status: 400 })

    const created = await prisma.crmAssignmentRule.create({
      data: {
        empresaId: access.empresaId,
        name,
        priority: Number.isFinite(priorityRaw) ? Math.trunc(priorityRaw) : 100,
        active,
        stopOnMatch,
        matchJson: match as Prisma.InputJsonValue,
        assigneeUserId: assigneeUserId || null,
        teamId: teamId || null,
        createdById: access.userId,
      },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creando regla de asignación:', error)
    return NextResponse.json({ error: 'Error creando regla de asignación' }, { status: 500 })
  }
}
