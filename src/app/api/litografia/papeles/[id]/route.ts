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

function asInt(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return null
  return Math.trunc(num)
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await ctx.params
  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const patch: Record<string, unknown> = {}

  if (body.nombre !== undefined) {
    const nombre = asString(body.nombre)
    if (!nombre) return NextResponse.json({ ok: false, error: 'Nombre es requerido' }, { status: 400 })
    patch.nombre = nombre
  }
  if (body.tipo !== undefined) patch.tipo = asString(body.tipo) || null
  if (body.gramaje !== undefined) {
    const gramajeRaw = asInt(body.gramaje)
    patch.gramaje = gramajeRaw !== null && gramajeRaw > 0 ? gramajeRaw : null
  }
  if (body.pliegoWidthCm !== undefined) patch.pliegoWidthCm = Math.max(0, asNumber(body.pliegoWidthCm, 70))
  if (body.pliegoHeightCm !== undefined) patch.pliegoHeightCm = Math.max(0, asNumber(body.pliegoHeightCm, 100))
  if (body.costoPliego !== undefined) patch.costoPliego = Math.max(0, asNumber(body.costoPliego, 0))
  if (body.activo !== undefined) patch.activo = Boolean(body.activo)

  try {
    const updated = await prisma.litografiaPaperRate.update({
      where: { id, empresaId },
      data: patch,
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

    return NextResponse.json({ ok: true, data: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al actualizar papel' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await ctx.params
  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  try {
    await prisma.litografiaPaperRate.delete({ where: { id, empresaId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al eliminar papel' }, { status: 500 })
  }
}
