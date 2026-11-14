import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { runDueSequenceSteps, type CrmSequenceRunSummary } from '@/lib/crm-sequences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ejecutor programado de secuencias de nutrición.
 *
 * - `Authorization: Bearer $CRON_SECRET` (cron externo) o Super Admin autenticado.
 * - Procesa hasta `limit` enrolamientos vencidos por empresa y un paso por corrida.
 * - `dryRun=1` (default) calcula sin enviar nada; `dryRun=0` ejecuta.
 *
 * Variables de entorno: `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`.
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

async function handle(request: Request) {
  const authResult = await authorize(request)
  if (!authResult.ok) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const empresaId = (searchParams.get('empresaId') ?? '').trim()
  const dryRun = searchParams.get('dryRun') !== '0'
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 25
  const now = new Date()

  try {
    let empresaIds: string[] = []
    if (empresaId) {
      empresaIds = [empresaId]
    } else {
      const companies = await prisma.crmSequenceEnrollment.findMany({
        where: { status: 'ACTIVE', nextRunAt: { lte: now } },
        select: { empresaId: true },
        distinct: ['empresaId'],
        take: 50,
      })
      empresaIds = companies.map((row) => row.empresaId)
    }

    const runs: Array<{ empresaId: string; summary: CrmSequenceRunSummary }> = []

    for (const id of empresaIds) {
      const summary = await runDueSequenceSteps({
        client: prisma,
        empresaId: id,
        limit,
        now,
        dryRun,
      })
      runs.push({ empresaId: id, summary })
    }

    const totals = runs.reduce(
      (acc, run) => ({
        processed: acc.processed + run.summary.processed,
        sent: acc.sent + run.summary.sent,
        failed: acc.failed + run.summary.failed,
        skipped: acc.skipped + run.summary.skipped,
        completed: acc.completed + run.summary.completed,
        stopped: acc.stopped + run.summary.stopped,
      }),
      { processed: 0, sent: 0, failed: 0, skipped: 0, completed: 0, stopped: 0 }
    )

    return NextResponse.json({
      success: true,
      data: { dryRun, via: authResult.via, limit, companies: runs.length, totals, runs },
    })
  } catch (error) {
    console.error('Error ejecutando secuencias CRM:', error)
    return NextResponse.json({ error: 'Error ejecutando secuencias CRM' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
