import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { executeWorkflowRun } from '@/lib/workflows'

export const runtime = 'nodejs'

/**
 * Trigger público de workflows por webhook.
 *
 * La URL es /api/workflows/webhook/:token y no requiere sesión: el token del
 * workflow actúa como secreto de entrada. El workflow debe estar ACTIVE.
 */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    const workflow = await prisma.workflow.findUnique({ where: { webhookToken: token } })
    if (!workflow || workflow.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Workflow no disponible' }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const result = await executeWorkflowRun({ workflow, triggerKind: 'WEBHOOK', triggerPayload: body ?? {} })

    return NextResponse.json(
      { success: result.ok, runId: result.runId, error: result.ok ? undefined : result.error },
      { status: result.ok ? 200 : 422 },
    )
  } catch (error) {
    console.error('Error en webhook de workflow:', error)
    return NextResponse.json({ error: 'Error en webhook de workflow' }, { status: 500 })
  }
}
