import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, Prisma } from '@prisma/client'

export const runtime = 'nodejs'

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'No se pudo inicializar Prisma (revisa la conexión a la base de datos).'
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') return 'La tabla de productos no existe en la base de datos (ejecuta migraciones).'
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

    const productos = await prisma.litografiaProducto.findMany({
      where: { empresaId },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        formatoKey: true,
        tintas: true,
        paperRateId: true,
        finishOptionId: true,
        activo: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ ok: true, data: productos })
  } catch (error) {
    console.error('[litografia][productos][GET] Error al listar productos', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al cargar productos de litografía') },
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

    const nombre = asString(body.nombre)
    const descripcion = body.descripcion == null ? null : asString(body.descripcion)
    const formatoKey = asString(body.formatoKey)
    const tintas = asInt(body.tintas, 0)
    const paperRateId = asString(body.paperRateId)
    const finishOptionId = asNullableId(body.finishOptionId)
    const activo = body.activo === undefined ? true : Boolean(body.activo)

    if (!nombre) return NextResponse.json({ ok: false, error: 'nombre es requerido' }, { status: 400 })
    if (!formatoKey) return NextResponse.json({ ok: false, error: 'formatoKey es requerido' }, { status: 400 })
    if (!isValidTintas(tintas)) {
      return NextResponse.json({ ok: false, error: 'tintas inválidas (solo 1, 2, 4)' }, { status: 400 })
    }
    if (!paperRateId) {
      return NextResponse.json({ ok: false, error: 'paperRateId es requerido (selecciona un papel)' }, { status: 400 })
    }

    const paperOk = await prisma.litografiaPaperRate.findFirst({ where: { id: paperRateId, empresaId }, select: { id: true } })
    if (!paperOk) return NextResponse.json({ ok: false, error: 'paperRateId inválido' }, { status: 400 })

    if (finishOptionId) {
      const finishOk = await prisma.litografiaFinishOption.findFirst({ where: { id: finishOptionId, empresaId }, select: { id: true } })
      if (!finishOk) return NextResponse.json({ ok: false, error: 'finishOptionId inválido' }, { status: 400 })
    }

    const created = await prisma.litografiaProducto.create({
      data: {
        empresaId,
        nombre,
        descripcion: descripcion || null,
        formatoKey,
        tintas,
        paperRateId,
        finishOptionId,
        activo,
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        formatoKey: true,
        tintas: true,
        paperRateId: true,
        finishOptionId: true,
        activo: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ ok: true, data: created })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Ya existe un producto con ese nombre o con la misma combinación (papel + tamaño + tintas + acabado).',
        },
        { status: 409 }
      )
    }

    console.error('[litografia][productos][POST] Error al crear producto', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al crear producto de litografía') },
      { status: 500 }
    )
  }
}
