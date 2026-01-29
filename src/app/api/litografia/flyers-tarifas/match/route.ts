import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, Prisma } from '@prisma/client'

export const runtime = 'nodejs'

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const { searchParams } = new URL(request.url)

  const formatoKey = (searchParams.get('formatoKey') || '').trim()
  const tintas = Number(searchParams.get('tintas') || '0')
  const cantidad = Number(searchParams.get('cantidad') || '0')
  const paperRateId = (searchParams.get('paperRateId') || '').trim() || null
  const finishOptionId = (searchParams.get('finishOptionId') || '').trim() || null

  if (!formatoKey) return NextResponse.json({ ok: false, error: 'formatoKey es requerido' }, { status: 400 })
  if (![1, 2, 4].includes(tintas)) return NextResponse.json({ ok: false, error: 'tintas inválidas' }, { status: 400 })
  if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ ok: false, error: 'cantidad inválida' }, { status: 400 })
  if (!paperRateId) return NextResponse.json({ ok: false, error: 'paperRateId es requerido' }, { status: 400 })

  const qty = Math.trunc(cantidad)

  const andClauses: Prisma.LitografiaFlyerRateWhereInput[] = [
    { paperRateId },
    finishOptionId ? { finishOptionId } : { finishOptionId: null },
  ]

  const tarifa = await prisma.litografiaFlyerRate.findFirst({
    where: {
      empresaId,
      activo: true,
      formatoKey,
      tintas,
      tirajeMin: { lte: qty },
      tirajeMax: { gte: qty },
      AND: andClauses,
    },
    orderBy: [{ tirajeMin: 'desc' }],
    select: {
      id: true,
      formatoKey: true,
      tintas: true,
      tirajeMin: true,
      tirajeMax: true,
      paperRateId: true,
      finishOptionId: true,
      precioTotal: true,
      activo: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: tarifa })
}
