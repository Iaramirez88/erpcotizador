import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true' || v === '1' || v === 'si' || v === 'sí') return true
    if (v === 'false' || v === '0' || v === 'no') return false
  }
  return fallback
}

function asNumber(value: unknown, fallback: number) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? num : fallback
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
  if (!access.ok) return access.response

  const sede = await prisma.sede.findUnique({
    where: { id: access.sedeId },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      cotizacionesPricesIncludeIva: true,
      cotizacionesIvaPct: true,
    },
  })

  if (!sede) {
    return NextResponse.json({ ok: false, error: 'Sede no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    data: {
      sedeId: sede.id,
      sedeNombre: sede.nombre,
      sedeCodigo: sede.codigo,
      pricesIncludeIva: sede.cotizacionesPricesIncludeIva,
      ivaPct: sede.cotizacionesIvaPct,
    },
  })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const pricesIncludeIva = asBoolean(body.pricesIncludeIva, true)
  const ivaPctRaw = asNumber(body.ivaPct, 19)
  const ivaPct = Math.min(100, Math.max(0, ivaPctRaw))

  const sede = await prisma.sede.update({
    where: { id: access.sedeId },
    data: {
      cotizacionesPricesIncludeIva: pricesIncludeIva,
      cotizacionesIvaPct: ivaPct,
    },
    select: {
      id: true,
      nombre: true,
      codigo: true,
      cotizacionesPricesIncludeIva: true,
      cotizacionesIvaPct: true,
    },
  })

  return NextResponse.json({
    ok: true,
    data: {
      sedeId: sede.id,
      sedeNombre: sede.nombre,
      sedeCodigo: sede.codigo,
      pricesIncludeIva: sede.cotizacionesPricesIncludeIva,
      ivaPct: sede.cotizacionesIvaPct,
    },
  })
}
