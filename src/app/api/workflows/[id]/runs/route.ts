import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const workflow = await prisma.workflow.findFirst({ where: { id, empresaId: access.empresaId } })
    if (!workflow) return NextResponse.json({ error: 'Workflow no encontrado' }, { status: 404 })

    const runs = await prisma.workflowRun.findMany({
      where: { workflowId: id, empresaId: access.empresaId },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: { _count: { select: { steps: true } } },
    })

    return NextResponse.json({ success: true, data: runs })
  } catch (error) {
    console.error('Error listando ejecuciones:', error)
    return NextResponse.json({ error: 'Error listando ejecuciones' }, { status: 500 })
  }
}
