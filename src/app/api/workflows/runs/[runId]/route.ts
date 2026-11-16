import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

export async function GET(_: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { runId } = await context.params
    const run = await prisma.workflowRun.findFirst({
      where: { id: runId, empresaId: access.empresaId },
      include: {
        workflow: { select: { name: true } },
        steps: { orderBy: { startedAt: 'asc' } },
      },
    })
    if (!run) return NextResponse.json({ error: 'Ejecución no encontrada' }, { status: 404 })

    return NextResponse.json({ success: true, data: run })
  } catch (error) {
    console.error('Error obteniendo ejecución:', error)
    return NextResponse.json({ error: 'Error obteniendo ejecución' }, { status: 500 })
  }
}
