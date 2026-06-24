import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { canUserAccessWorkspace, getAccessibleTaskWorkspace } from '@/lib/crm-task-workspaces'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ workspaceId: string; projectId: string }>
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

    const { workspaceId, projectId } = await context.params
    const workspace = await getAccessibleTaskWorkspace(prisma, {
      workspaceId,
      empresaId: access.empresaId,
      userId: access.userId,
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })
    }

    if (!canUserAccessWorkspace(workspace, access.userId, 'manage')) {
      return NextResponse.json({ error: 'No tienes permisos para editar proyectos en este espacio.' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const name = normalizeString(body?.name)
    const description = normalizeString(body?.description)

    const current = await prisma.crmTaskWorkspaceProject.findFirst({
      where: {
        id: projectId,
        workspaceId: workspace.id,
        empresaId: access.empresaId,
      },
      select: { id: true, name: true },
    })

    if (!current) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }

    const duplicate = await prisma.crmTaskWorkspaceProject.findFirst({
      where: {
        empresaId: access.empresaId,
        workspaceId: workspace.id,
        name,
        id: { not: current.id },
      },
      select: { id: true },
    })

    if (duplicate) {
      return NextResponse.json({ error: 'Ya existe un proyecto con ese nombre en este espacio.' }, { status: 400 })
    }

    const project = await prisma.crmTaskWorkspaceProject.update({
      where: { id: current.id },
      data: {
        name,
        description: description || null,
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

    return NextResponse.json({ success: true, data: project })
  } catch (error) {
    console.error('Error actualizando proyecto del espacio:', error)
    return NextResponse.json({ error: 'Error actualizando proyecto del espacio' }, { status: 500 })
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'OPERACIONES',
      subdomain: 'TASK_WORKSPACES',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { workspaceId, projectId } = await context.params
    const workspace = await getAccessibleTaskWorkspace(prisma, {
      workspaceId,
      empresaId: access.empresaId,
      userId: access.userId,
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })
    }

    if (!canUserAccessWorkspace(workspace, access.userId, 'manage')) {
      return NextResponse.json({ error: 'No tienes permisos para eliminar proyectos en este espacio.' }, { status: 403 })
    }

    const project = await prisma.crmTaskWorkspaceProject.findFirst({
      where: {
        id: projectId,
        workspaceId: workspace.id,
        empresaId: access.empresaId,
      },
      select: { id: true, _count: { select: { tasks: true } } },
    })

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    if (project._count.tasks > 0) {
      return NextResponse.json({ error: 'El proyecto todavía tiene tareas asociadas. Muévelas o elimínalas antes.' }, { status: 400 })
    }

    await prisma.crmTaskWorkspaceProject.delete({ where: { id: project.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando proyecto del espacio:', error)
    return NextResponse.json({ error: 'Error eliminando proyecto del espacio' }, { status: 500 })
  }
}
