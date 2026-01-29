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

function asInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return null
  return Math.trunc(num)
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

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

    const patch: Record<string, unknown> = {}

    if (body.formatoKey !== undefined) {
      const formatoKey = asString(body.formatoKey)
      if (!formatoKey) return NextResponse.json({ ok: false, error: 'formatoKey es requerido' }, { status: 400 })
      patch.formatoKey = formatoKey
    }

    if (body.tintas !== undefined) {
      const tintas = asInt(body.tintas)
      if (tintas === null || !isValidTintas(tintas)) {
        return NextResponse.json({ ok: false, error: 'tintas inválidas (solo 1, 2, 4)' }, { status: 400 })
      }
      patch.tintas = tintas
    }

    if (body.tirajeMin !== undefined) {
      const v = asInt(body.tirajeMin)
      if (v === null || v <= 0) return NextResponse.json({ ok: false, error: 'tirajeMin inválido' }, { status: 400 })
      patch.tirajeMin = v
    }

    if (body.tirajeMax !== undefined) {
      const v = asInt(body.tirajeMax)
      if (v === null || v <= 0) return NextResponse.json({ ok: false, error: 'tirajeMax inválido' }, { status: 400 })
      patch.tirajeMax = v
    }

    if (patch.tirajeMin !== undefined && patch.tirajeMax !== undefined) {
      if (Number(patch.tirajeMin) > Number(patch.tirajeMax)) {
        return NextResponse.json({ ok: false, error: 'tirajeMin no puede ser mayor que tirajeMax' }, { status: 400 })
      }
    }

    if (body.precioTotal !== undefined) patch.precioTotal = Math.max(0, asNumber(body.precioTotal, 0))
    if (body.activo !== undefined) patch.activo = Boolean(body.activo)

    if (body.paperRateId !== undefined) patch.paperRateId = asNullableId(body.paperRateId)
    if (body.finishOptionId !== undefined) patch.finishOptionId = asNullableId(body.finishOptionId)

    if (body.productoId !== undefined) {
      const productoId = asNullableId(body.productoId)
      if (productoId) {
        const productOk = await prisma.litografiaProducto.findFirst({ where: { id: productoId, empresaId }, select: { id: true } })
        if (!productOk) return NextResponse.json({ ok: false, error: 'productoId inválido' }, { status: 400 })
      }
      patch.productoId = productoId
    }

    if (patch.paperRateId !== undefined && patch.paperRateId === null) {
      return NextResponse.json({ ok: false, error: 'paperRateId es requerido (selecciona un papel)' }, { status: 400 })
    }

    const updated = await prisma.litografiaFlyerRate.update({
      where: { id, empresaId },
      data: patch,
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

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Esta actualización genera un duplicado (formato+tintas+rango). Ajusta el rango o edita la tarifa correcta.',
          },
          { status: 409 }
        )
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ ok: false, error: 'Tarifa no encontrada' }, { status: 404 })
      }
    }

    console.error('[flyers-tarifas][PATCH] Error al actualizar tarifa', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al actualizar tarifa de flyers') },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await ctx.params
    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

    await prisma.litografiaFlyerRate.delete({ where: { id, empresaId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Tarifa no encontrada' }, { status: 404 })
    }

    console.error('[flyers-tarifas][DELETE] Error al eliminar tarifa', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al eliminar tarifa de flyers') },
      { status: 500 }
    )
  }
}
