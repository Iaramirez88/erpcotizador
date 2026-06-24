import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'UPDATE',
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

    if (!canUserAccessWorkspace(workspace, access.userId, 'manage')) {
      return NextResponse.json({ error: 'No tienes permisos para crear proyectos en este espacio.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }

    const duplicate = await prisma.crmTaskWorkspaceProject.findFirst({
      where: {
        empresaId: access.empresaId,
        workspaceId: workspace.id,
        name,
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json({ error: 'Ya existe un proyecto con ese nombre en este espacio.' }, { status: 400 })
    }

    const project = await prisma.crmTaskWorkspaceProject.create({
      data: {
        empresaId: access.empresaId,
        workspaceId: workspace.id,
        name,
        description: description || null,
        createdById: access.userId,
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { tasks: true } },
      },
    })

    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error) {
    console.error('Error creando proyecto del espacio:', error)
    return NextResponse.json({ error: 'Error creando proyecto del espacio' }, { status: 500 })
  }
}
