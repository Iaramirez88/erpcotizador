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

    if (body.nombre !== undefined) {
      const nombre = asString(body.nombre)
      if (!nombre) return NextResponse.json({ ok: false, error: 'nombre es requerido' }, { status: 400 })
      patch.nombre = nombre
    }

    if (body.descripcion !== undefined) {
      const descripcion = body.descripcion == null ? null : asString(body.descripcion)
      patch.descripcion = descripcion || null
    }

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

    if (body.paperRateId !== undefined) {
      const paperRateId = asString(body.paperRateId)
      if (!paperRateId) {
        return NextResponse.json({ ok: false, error: 'paperRateId es requerido (selecciona un papel)' }, { status: 400 })
      }
      const paperOk = await prisma.litografiaPaperRate.findFirst({ where: { id: paperRateId, empresaId }, select: { id: true } })
      if (!paperOk) return NextResponse.json({ ok: false, error: 'paperRateId inválido' }, { status: 400 })
      patch.paperRateId = paperRateId
    }

    if (body.finishOptionId !== undefined) {
      const finishOptionId = asNullableId(body.finishOptionId)
      if (finishOptionId) {
        const finishOk = await prisma.litografiaFinishOption.findFirst({ where: { id: finishOptionId, empresaId }, select: { id: true } })
        if (!finishOk) return NextResponse.json({ ok: false, error: 'finishOptionId inválido' }, { status: 400 })
      }
      patch.finishOptionId = finishOptionId
    }

    if (body.activo !== undefined) patch.activo = Boolean(body.activo)

    const updated = await prisma.litografiaProducto.update({
      where: { id, empresaId },
      data: patch,
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

    return NextResponse.json({ ok: true, data: updated })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            ok: false,
            error: 'Esta actualización genera un duplicado (nombre o combinación de producto).',
          },
          { status: 409 }
        )
      }
      if (error.code === 'P2025') {
        return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
      }
    }

    console.error('[litografia][productos][PATCH] Error al actualizar producto', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al actualizar producto de litografía') },
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

    await prisma.litografiaProducto.delete({ where: { id, empresaId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'Producto no encontrado' }, { status: 404 })
    }

    console.error('[litografia][productos][DELETE] Error al eliminar producto', error)
    return NextResponse.json(
      { ok: false, error: errorToMessage(error, 'Error al eliminar producto de litografía') },
      { status: 500 }
    )
  }
}
