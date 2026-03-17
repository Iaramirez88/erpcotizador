import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asNumber(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? num : fallback
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function GET() {
  const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const perfiles = await prisma.litografiaPrintProfile.findMany({
    where: { empresaId },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      costoPlanchaPorColor: true,
      costoTintaPorColor: true,
      anchoUtilCm: true,
      altoUtilCm: true,
      separacionPiezasCm: true,
      activo: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: perfiles })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const nombre = asString(body.nombre)
  if (!nombre) return NextResponse.json({ ok: false, error: 'Nombre es requerido' }, { status: 400 })

  const costoPlanchaPorColor = Math.max(0, asNumber(body.costoPlanchaPorColor, 0))
  const costoTintaPorColor = Math.max(0, asNumber(body.costoTintaPorColor, 0))
  const anchoUtilCm = Math.max(0.1, asNumber(body.anchoUtilCm, 70))
  const altoUtilCm = Math.max(0.1, asNumber(body.altoUtilCm, 100))
  const separacionPiezasCm = Math.max(0, asNumber(body.separacionPiezasCm, 0))
  const activo = body.activo === undefined ? true : Boolean(body.activo)

  try {
    const created = await prisma.litografiaPrintProfile.create({
      data: {
        empresaId,
        nombre,
        costoPlanchaPorColor,
        costoTintaPorColor,
        anchoUtilCm,
        altoUtilCm,
        separacionPiezasCm,
        activo,
      },
      select: {
        id: true,
        nombre: true,
        costoPlanchaPorColor: true,
        costoTintaPorColor: true,
        anchoUtilCm: true,
        altoUtilCm: true,
        separacionPiezasCm: true,
        activo: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ ok: true, data: created })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al crear perfil de impresión' }, { status: 500 })
  }
}
