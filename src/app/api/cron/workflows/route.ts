import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { executeWorkflowRun, matchesCronExpression, parseWorkflowTriggerJson } from '@/lib/workflows'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ejecutor programado de workflows con trigger CRON.
 *
 * - `Authorization: Bearer $CRON_SECRET` (cron externo) o Super Admin autenticado.
 * - `dryRun=1` (default) calcula sin ejecutar; `dryRun=0` ejecuta.
 * - `limit` (default 50, máx 100) limita cuántos workflows activos se revisan.
 *
 * Nota: el scheduler externo define la frecuencia (p. ej. cada 15 min). La
 * interpretación granular de la expresión cron por workflow queda como fase
 * posterior.
 */
async function authorize(request: Request) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get('authorization') ?? ''
  if (secret && header === `Bearer ${secret}`) {
    return { ok: true as const, via: 'cron' as const }
  }

  const session = await auth()
  if (session?.user?.email && isSuperAdminEmail(session.user.email)) {
    return { ok: true as const, via: 'super-admin' as const }
  }

  return { ok: false as const, via: null }
}

export async function GET(request: Request) {
  const authResult = await authorize(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') !== '0'
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50

  const workflows = await prisma.workflow.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  })

  const runs: Array<{ workflowId: string; name: string; ok: boolean; runId?: string; error?: string; dryRun?: boolean }> = []

  for (const workflow of workflows) {
    const trigger = parseWorkflowTriggerJson(workflow.triggerJson)
    if (trigger.kind !== 'CRON') continue

    const expression = (trigger.cronExpression ?? '').trim()
    const now = new Date()
    const due = expression ? matchesCronExpression(expression, now) : false
    const lastRunAt = workflow.lastRunAt?.getTime() ?? 0
    if (!due || now.getTime() - lastRunAt < 60_000) continue

    if (dryRun) {
      runs.push({ workflowId: workflow.id, name: workflow.name, ok: true, dryRun: true })
      continue
    }

    const result = await executeWorkflowRun({ workflow, triggerKind: 'CRON', triggerPayload: {} })
    await prisma.workflow.update({ where: { id: workflow.id }, data: { lastRunAt: new Date() } })
    runs.push({ workflowId: workflow.id, name: workflow.name, ok: result.ok, runId: result.runId, error: result.ok ? undefined : result.error })
  }

  const executed = runs.filter((item) => !item.dryRun)

  return NextResponse.json({
    success: true,
    dryRun,
    total: runs.length,
    executed: executed.length,
    succeeded: executed.filter((item) => item.ok).length,
    failed: executed.filter((item) => !item.ok).length,
    runs,
  })
}
