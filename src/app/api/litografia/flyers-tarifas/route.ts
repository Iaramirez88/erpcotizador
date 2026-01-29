import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'No se pudo inicializar Prisma (revisa la conexión a la base de datos).'
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') return 'La tabla de tarifas no existe en la base de datos (ejecuta migraciones).'
    if (error.code === 'P1001') return 'No se pudo conectar a la base de datos.'
    return `${fallback} (Prisma ${error.code})`
  }
  if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`
  }
  return fallback
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asNumber(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? num : fallback
}

function asInt(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? Math.trunc(num) : fallback
}

function asNullableId(value: unknown) {
  const s = String(value ?? '').trim()
  return s ? s : null
}

function isValidTintas(tintas: number) {
  return tintas === 1 || tintas === 2 || tintas === 4
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

    const tarifas = await prisma.litografiaFlyerRate.findMany({
      where: { empresaId },
      orderBy: [{ activo: 'desc' }, { formatoKey: 'asc' }, { tintas: 'asc' }, { tirajeMin: 'asc' }],
      select: {
        id: true,
        productoId: true,
        producto: { select: { id: true, nombre: true } },
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

    return NextResponse.json({ ok: true, data: tarifas })
  } catch (error) {
    console.error('[flyers-tarifas][GET] Error al listar tarifas', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al cargar tarifas de flyers') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const formatoKey = asString(body.formatoKey)
    const tintas = asInt(body.tintas, 0)
    const tirajeMin = asInt(body.tirajeMin, 0)
    const tirajeMax = asInt(body.tirajeMax, 0)
    const paperRateId = asNullableId(body.paperRateId)
    const finishOptionId = asNullableId(body.finishOptionId)
    const productoId = asNullableId(body.productoId)
    const precioTotal = Math.max(0, asNumber(body.precioTotal, 0))
    const activo = body.activo === undefined ? true : Boolean(body.activo)

    if (!formatoKey) return NextResponse.json({ ok: false, error: 'formatoKey es requerido' }, { status: 400 })
    if (!isValidTintas(tintas)) return NextResponse.json({ ok: false, error: 'tintas inválidas (solo 1, 2, 4)' }, { status: 400 })
    if (tirajeMin <= 0 || tirajeMax <= 0) {
      return NextResponse.json({ ok: false, error: 'tirajeMin y tirajeMax deben ser > 0' }, { status: 400 })
    }
    if (tirajeMin > tirajeMax) {
      return NextResponse.json({ ok: false, error: 'tirajeMin no puede ser mayor que tirajeMax' }, { status: 400 })
    }
    if (!paperRateId) {
      return NextResponse.json({ ok: false, error: 'paperRateId es requerido (selecciona un papel)' }, { status: 400 })
    }

    if (productoId) {
      const productOk = await prisma.litografiaProducto.findFirst({ where: { id: productoId, empresaId }, select: { id: true } })
      if (!productOk) {
        return NextResponse.json({ ok: false, error: 'productoId inválido' }, { status: 400 })
      }
    }

    const created = await prisma.litografiaFlyerRate.create({
      data: {
        empresaId,
        productoId,
        formatoKey,
        tintas,
        tirajeMin,
        tirajeMax,
        paperRateId,
        finishOptionId,
        precioTotal,
        activo,
      },
      select: {
        id: true,
        productoId: true,
        producto: { select: { id: true, nombre: true } },
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

    return NextResponse.json({ ok: true, data: created })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Ya existe una tarifa con el mismo formato, tintas y rango de tiraje. Edita la existente o usa un rango diferente.',
          },
          { status: 409 }
        )
      }
    }

    console.error('[flyers-tarifas][POST] Error al crear tarifa', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al crear tarifa de flyers') },
      { status: 500 }
    )
  }
}
