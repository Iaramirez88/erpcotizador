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
  if (body.costoPlanchaPorColor !== undefined) patch.costoPlanchaPorColor = Math.max(0, asNumber(body.costoPlanchaPorColor, 0))
  if (body.costoTintaPorColor !== undefined) patch.costoTintaPorColor = Math.max(0, asNumber(body.costoTintaPorColor, 0))
  if (body.activo !== undefined) patch.activo = Boolean(body.activo)

  try {
    const updated = await prisma.litografiaPrintProfile.update({
      where: { id, empresaId },
      data: patch,
      select: {
        id: true,
        nombre: true,
        costoPlanchaPorColor: true,
        costoTintaPorColor: true,
        activo: true,
        updatedAt: true,
      },
    })
    return NextResponse.json({ ok: true, data: updated })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al actualizar perfil de impresión' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await ctx.params
  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  try {
    await prisma.litografiaPrintProfile.delete({ where: { id, empresaId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al eliminar perfil de impresión' }, { status: 500 })
  }
}
