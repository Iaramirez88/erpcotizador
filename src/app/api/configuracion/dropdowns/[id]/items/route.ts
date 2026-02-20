import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

type ConfigDropdownDelegateCompat = {
  findUnique: (args: unknown) => Promise<{ id: string; empresaId: string } | null>
}

type ConfigDropdownItemDelegateCompat = {
  create: (args: unknown) => Promise<unknown>
}

const prismaCompat = prisma as unknown as {
  configDropdown: ConfigDropdownDelegateCompat
  configDropdownItem: ConfigDropdownItemDelegateCompat
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asInt(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return fallback
  return Math.trunc(num)
}

function toValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const { id: dropdownId } = await ctx.params
  if (!dropdownId) return NextResponse.json({ ok: false, error: 'dropdownId requerido' }, { status: 400 })

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const dropdown = await prismaCompat.configDropdown.findUnique({
    where: { id: dropdownId },
    select: { id: true, empresaId: true },
  })
  if (!dropdown || dropdown.empresaId !== empresaId) {
    return NextResponse.json({ ok: false, error: 'Dropdown no encontrado' }, { status: 404 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const label = asString(body.label)
  const value = asString(body.value) || toValue(label)
  const sortOrder = asInt(body.sortOrder, 0)
  const activo = body.activo === undefined ? true : Boolean(body.activo)
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : undefined

  if (!label) return NextResponse.json({ ok: false, error: 'label es requerido' }, { status: 400 })
  if (!value) return NextResponse.json({ ok: false, error: 'value es requerido' }, { status: 400 })

  try {
    const created = await prismaCompat.configDropdownItem.create({
      data: { dropdownId, label, value, meta, sortOrder, activo },
      select: { id: true, dropdownId: true, label: true, value: true, meta: true, sortOrder: true, activo: true, updatedAt: true },
    })

    return NextResponse.json({ ok: true, data: created })
  } catch {
    return NextResponse.json({ ok: false, error: 'Error al crear opción' }, { status: 500 })
  }
}
