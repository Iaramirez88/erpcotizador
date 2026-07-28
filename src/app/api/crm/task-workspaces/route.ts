import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { crmTaskWorkspaceInclude, getAccessibleTaskWorkspaceIds, mapWorkspaceForUser, normalizeUserIdList, normalizeWorkspaceSedeIdList } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const workspaceIds = await getAccessibleTaskWorkspaceIds(prisma, {
      empresaId: access.empresaId,
      userId: access.userId,
    })

    const rows = await prisma.crmTaskWorkspace.findMany({
      where: {
        empresaId: access.empresaId,
        id: { in: workspaceIds.length ? workspaceIds : ['__none__'] },
      },
      include: crmTaskWorkspaceInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ success: true, data: rows.map((row) => mapWorkspaceForUser(row, access.userId)) })
  } catch (error) {
    console.error('Error listando espacios de trabajo CRM:', error)
    return NextResponse.json({ error: 'Error listando espacios de trabajo CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const scope = typeof body?.scope === 'string' ? body.scope.trim().toUpperCase() : ''
    const sedeId = normalizeString(body?.sedeId)
    const sedeIds = normalizeWorkspaceSedeIdList(body?.sedeIds)
    const ownerUserId = normalizeString(body?.ownerUserId)
    const memberUserIds = normalizeUserIdList(body?.memberUserIds)
    const normalizedSedeIds = scope === 'SEDE' ? Array.from(new Set([sedeId, ...sedeIds].filter(Boolean))) : []

    if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    if (scope !== 'SEDE' && scope !== 'USER') {
      return NextResponse.json({ error: 'scope inválido' }, { status: 400 })
    }
    if (scope === 'SEDE' && !normalizedSedeIds.length) {
      return NextResponse.json({ error: 'sedeId es requerido para espacios por sede' }, { status: 400 })
    }
    if (scope === 'USER' && !ownerUserId) {
      return NextResponse.json({ error: 'ownerUserId es requerido para espacios por usuario' }, { status: 400 })
    }

    if (normalizedSedeIds.length) {
      const sedeRows = await prisma.sede.findMany({
        where: { id: { in: normalizedSedeIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (sedeRows.length !== normalizedSedeIds.length) {
        return NextResponse.json({ error: 'Hay sedes inválidas en el espacio de trabajo' }, { status: 400 })
      }
    }

    if (ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    const allMemberIds = Array.from(new Set([access.userId, ...(ownerUserId ? [ownerUserId] : []), ...memberUserIds]))
    if (allMemberIds.length) {
      const users = await prisma.user.findMany({
        where: { id: { in: allMemberIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (users.length !== allMemberIds.length) {
        return NextResponse.json({ error: 'Hay usuarios invitados inválidos' }, { status: 400 })
      }
    }

    const row = await prisma.crmTaskWorkspace.create({
      data: {
        empresaId: access.empresaId,
        scope: scope as 'SEDE' | 'USER',
        name,
        description: description || null,
        sedeId: normalizedSedeIds[0] || null,
        ownerUserId: ownerUserId || null,
        createdById: access.userId,
        workspaceSedes: normalizedSedeIds.length
          ? {
              create: normalizedSedeIds.map((currentSedeId) => ({
                sedeId: currentSedeId,
              })),
            }
          : undefined,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === access.userId || userId === ownerUserId ? 'MANAGER' : 'VIEWER',
          })),
        },
      },
      include: crmTaskWorkspaceInclude,
    })

    return NextResponse.json({ success: true, data: mapWorkspaceForUser(row, access.userId) }, { status: 201 })
  } catch (error) {
    console.error('Error creando espacio de trabajo CRM:', error)
    return NextResponse.json({ error: 'Error creando espacio de trabajo CRM' }, { status: 500 })
  }
}