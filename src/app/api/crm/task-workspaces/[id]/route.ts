import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import {
  canUserAccessWorkspace,
  crmTaskWorkspaceInclude,
  getAccessibleTaskWorkspace,
  mapWorkspaceForUser,
  normalizeUserIdList,
  type WorkspaceMemberRole,
} from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function normalizeMemberRoles(value: unknown): Array<{ userId: string; role: WorkspaceMemberRole }> {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((item) => {
      const row = item as Record<string, unknown>
      const userId = typeof row?.userId === 'string' ? row.userId.trim() : ''
      const roleRaw = typeof row?.role === 'string' ? row.role.trim().toUpperCase() : ''
      const role = roleRaw === 'VIEWER' || roleRaw === 'EDITOR' || roleRaw === 'MANAGER' ? roleRaw : ''
      return userId && role ? { userId, role: role as WorkspaceMemberRole } : null
    })
    .filter(Boolean) as Array<{ userId: string; role: WorkspaceMemberRole }>

  const deduped = new Map<string, WorkspaceMemberRole>()
  for (const row of normalized) deduped.set(row.userId, row.role)
  return Array.from(deduped.entries()).map(([userId, role]) => ({ userId, role }))
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const workspace = await getAccessibleTaskWorkspace(prisma, {
      workspaceId: id,
      empresaId: access.empresaId,
      userId: access.userId,
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: mapWorkspaceForUser(workspace, access.userId) })
  } catch (error) {
    console.error('Error obteniendo espacio de trabajo:', error)
    return NextResponse.json({ error: 'Error obteniendo espacio de trabajo' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await getAccessibleTaskWorkspace(prisma, {
      workspaceId: id,
      empresaId: access.empresaId,
      userId: access.userId,
    })

    if (!current) {
      return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })
    }

    if (!canUserAccessWorkspace(current, access.userId, 'manage')) {
      return NextResponse.json({ error: 'No tienes permisos para administrar este espacio.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)
    const ownerUserId = normalizeString(body?.ownerUserId)
    const memberRoles = normalizeMemberRoles(body?.members)

    if (Object.prototype.hasOwnProperty.call(body ?? {}, 'ownerUserId') && ownerUserId) {
      const owner = await prisma.user.findUnique({ where: { id: ownerUserId }, select: { id: true, empresaId: true } })
      if (!owner || owner.empresaId !== access.empresaId) {
        return NextResponse.json({ error: 'ownerUserId inválido' }, { status: 400 })
      }
    }

    if (memberRoles.length) {
      const userIds = normalizeUserIdList(memberRoles.map((item) => item.userId))
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, empresaId: access.empresaId },
        select: { id: true },
      })
      if (users.length !== userIds.length) {
        return NextResponse.json({ error: 'Hay miembros inválidos en la actualización.' }, { status: 400 })
      }
    }

    const nextMembersMap = new Map(memberRoles.map((item) => [item.userId, item.role]))
    nextMembersMap.set(current.createdById, 'MANAGER')
    if ((ownerUserId || current.ownerUserId)) {
      nextMembersMap.set((ownerUserId || current.ownerUserId) as string, 'MANAGER')
    }
    if (!nextMembersMap.has(access.userId)) {
      nextMembersMap.set(access.userId, 'MANAGER')
    }

    const managerCount = Array.from(nextMembersMap.values()).filter((role) => role === 'MANAGER').length
    if (!managerCount) {
      return NextResponse.json({ error: 'Debe existir al menos un manager en el espacio.' }, { status: 400 })
    }

    const nextMembers = Array.from(nextMembersMap.entries()).map(([userId, role]) => ({ userId, role }))

    const updated = await prisma.$transaction(async (tx) => {
      await tx.crmTaskWorkspace.update({
        where: { id: current.id },
        data: {
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'name') ? { name: name || current.name } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'description') ? { description: description || null } : {}),
          ...(Object.prototype.hasOwnProperty.call(body ?? {}, 'ownerUserId') ? { ownerUserId: ownerUserId || null } : {}),
        },
      })

      if (Object.prototype.hasOwnProperty.call(body ?? {}, 'members')) {
        await tx.crmTaskWorkspaceMember.deleteMany({
          where: {
            workspaceId: current.id,
            userId: { notIn: nextMembers.map((item) => item.userId) },
          },
        })

        for (const member of nextMembers) {
          await tx.crmTaskWorkspaceMember.upsert({
            where: {
              workspaceId_userId: {
                workspaceId: current.id,
                userId: member.userId,
              },
            },
            update: { role: member.role },
            create: {
              workspaceId: current.id,
              userId: member.userId,
              role: member.role,
            },
          })
        }
      }

      return tx.crmTaskWorkspace.findUniqueOrThrow({
        where: { id: current.id },
        include: crmTaskWorkspaceInclude,
      })
    })

    return NextResponse.json({ success: true, data: mapWorkspaceForUser(updated, access.userId) })
  } catch (error) {
    console.error('Error actualizando espacio de trabajo:', error)
    return NextResponse.json({ error: 'Error actualizando espacio de trabajo' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await getAccessibleTaskWorkspace(prisma, {
      workspaceId: id,
      empresaId: access.empresaId,
      userId: access.userId,
    })

    if (!current) {
      return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })
    }

    if (!canUserAccessWorkspace(current, access.userId, 'manage')) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar este espacio.' }, { status: 403 })
    }

    const [taskCount, projectCount] = await Promise.all([
      prisma.crmTask.count({ where: { workspaceId: current.id, empresaId: access.empresaId } }),
      prisma.crmTaskWorkspaceProject.count({ where: { workspaceId: current.id, empresaId: access.empresaId } }),
    ])

    if (taskCount > 0 || projectCount > 0) {
      return NextResponse.json({
        error: 'El espacio todavía tiene proyectos o tareas. Elimínalos o reasígnalos antes de borrar el espacio.',
      }, { status: 400 })
    }

    await prisma.crmTaskWorkspace.delete({ where: { id: current.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando espacio de trabajo:', error)
    return NextResponse.json({ error: 'Error eliminando espacio de trabajo' }, { status: 500 })
  }
}