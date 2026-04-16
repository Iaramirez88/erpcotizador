import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asNumber(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? num : fallback
}

function asInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return null
  return Math.trunc(num)
}

function normalizePaperName(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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

  const papeles = await prisma.litografiaPaperRate.findMany({
    where: { empresaId },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      tipo: true,
      gramaje: true,
      pliegoWidthCm: true,
      pliegoHeightCm: true,
      costoPliego: true,
      activo: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: papeles })
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const me = await prisma.user.findUnique({
    where: { id: access.userId },
    select: { role: true },
  })

  if (me?.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Solo los administradores pueden agregar papeles directamente.' }, { status: 403 })
  }

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const nombre = asString(body.nombre)
  if (!nombre) return NextResponse.json({ ok: false, error: 'Nombre es requerido' }, { status: 400 })

  const tipo = body.tipo === undefined ? null : asString(body.tipo) || null
  const gramajeRaw = body.gramaje === undefined ? null : asInt(body.gramaje)
  if (body.gramaje !== undefined && gramajeRaw !== null && gramajeRaw <= 0) {
    return NextResponse.json({ ok: false, error: 'El gramaje debe ser mayor a 0.' }, { status: 400 })
  }
  const gramaje = gramajeRaw !== null && gramajeRaw > 0 ? gramajeRaw : null

  const pliegoWidthCm = Math.max(0, asNumber(body.pliegoWidthCm, 70))
  const pliegoHeightCm = Math.max(0, asNumber(body.pliegoHeightCm, 100))
  const costoPliego = Math.max(0, asNumber(body.costoPliego, 0))
  const activo = body.activo === undefined ? true : Boolean(body.activo)

  if (pliegoWidthCm <= 0 || pliegoHeightCm <= 0) {
    return NextResponse.json({ ok: false, error: 'El pliego base debe tener ancho y alto mayores a 0.' }, { status: 400 })
  }

  const existingPapers = await prisma.litografiaPaperRate.findMany({
    where: { empresaId },
    select: { id: true, nombre: true },
  })
  const nombreNormalizado = normalizePaperName(nombre)
  const duplicateByName = existingPapers.find((paper) => normalizePaperName(paper.nombre) === nombreNormalizado) ?? null

  if (duplicateByName) {
    return NextResponse.json({ ok: false, error: `Ya existe un papel con el nombre "${duplicateByName.nombre}".` }, { status: 409 })
  }

  try {
    const created = await prisma.litografiaPaperRate.create({
      data: {
        empresaId,
        nombre,
        tipo,
        gramaje,
        pliegoWidthCm,
        pliegoHeightCm,
        costoPliego,
        activo,
      },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        gramaje: true,
        pliegoWidthCm: true,
        pliegoHeightCm: true,
        costoPliego: true,
        activo: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ ok: true, data: created })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: `Ya existe un papel con el nombre "${nombre}".` }, { status: 409 })
    }
    return NextResponse.json({ ok: false, error: 'Error al crear papel' }, { status: 500 })
  }
}
