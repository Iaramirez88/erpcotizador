import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { executeWorkflowRun } from '@/lib/workflows'

export const runtime = 'nodejs'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'WORKFLOWS',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const workflow = await prisma.workflow.findFirst({ where: { id, empresaId: access.empresaId } })
    if (!workflow) return NextResponse.json({ error: 'Workflow no encontrado' }, { status: 404 })

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const result = await executeWorkflowRun({ workflow, triggerKind: 'MANUAL', triggerPayload: body ?? {} })

    return NextResponse.json({ success: result.ok, data: result }, { status: result.ok ? 200 : 422 })
  } catch (error) {
    console.error('Error ejecutando workflow:', error)
    return NextResponse.json({ error: 'Error ejecutando workflow' }, { status: 500 })
  }
}
