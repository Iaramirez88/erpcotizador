import { NextResponse } from 'next/server'
import { runAccountRetention } from '@/lib/account-retention'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Trabajo de retención de cuentas.
 *
 * - Con `Authorization: Bearer $CRON_SECRET` lo puede llamar un programador (cron externo).
 * - Un Super Admin autenticado también puede ejecutarlo desde la app.
 *
 * Parámetros:
 *  - `dryRun` (default `1`): `1` solo calcula; `0` envía correos y elimina cuentas.
 *  - `purge`  (default `1`): `0` envía avisos sin eliminar nada.
 *  - `limit`  (default 500, máx 2000): cantidad máxima de cuentas a revisar.
 *
 * Ejemplo para producción: `POST /api/cron/account-retention?dryRun=0&purge=1`.
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

function parseBooleanFlag(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'si', 'sí'].includes(normalized)) return true
  if (['0', 'false', 'no'].includes(normalized)) return false
  return fallback
}

async function handle(request: Request) {
  const authorization = await authorize(request)
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, error: 'No autorizado' }, { status: 401 })
  }

  const url = new URL(request.url)
  // Por defecto es una simulación: hay que pedir explícitamente `dryRun=0` para ejecutar.
  const dryRun = parseBooleanFlag(url.searchParams.get('dryRun'), true)
  const purge = parseBooleanFlag(url.searchParams.get('purge'), true)
  const limitRaw = Number(url.searchParams.get('limit') ?? '')
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined

  try {
    const summary = await runAccountRetention({ dryRun, purge, limit })
    return NextResponse.json({ ...summary, triggeredBy: authorization.via })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Error inesperado' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
