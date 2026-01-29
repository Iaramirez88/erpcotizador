import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asNumber(value: unknown, fallback: number) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(num) ? num : fallback
}

function clampPct(value: number) {
  return Math.min(100, Math.max(0, value))
}

type ApiResponse =
  | {
      ok: true
      data: {
        sedeId: string
        sedeNombre: string
        defaultPct: number
        materials: Array<{
          id: string
          nombre: string
          overridePct: number | null
          effectivePct: number
        }>
      }
    }
  | { ok?: false; error?: string }

export async function GET() {
  const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
  if (!access.ok) return access.response

  const sede = await prisma.sede.findUnique({
    where: { id: access.sedeId },
    select: {
      id: true,
      nombre: true,
      empresaId: true,
      desperdicioPctDefault: true,
    },
  })

  if (!sede) {
    return NextResponse.json({ ok: false, error: 'Sede no encontrada' } satisfies ApiResponse, { status: 404 })
  }

  const [materials, overrides] = await Promise.all([
    prisma.material.findMany({
      where: { empresaId: sede.empresaId, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.sedeMaterialWaste.findMany({
      where: { sedeId: sede.id },
      select: { materialId: true, desperdicioPct: true },
    }),
  ])

  const overrideMap = new Map(overrides.map((o) => [o.materialId, o.desperdicioPct]))
  const defaultPct = sede.desperdicioPctDefault ?? 0

  return NextResponse.json({
    ok: true,
    data: {
      sedeId: sede.id,
      sedeNombre: sede.nombre,
      defaultPct,
      materials: materials.map((m) => {
        const overridePct = overrideMap.has(m.id) ? (overrideMap.get(m.id) ?? 0) : null
        const effectivePct = overridePct ?? defaultPct
        return { id: m.id, nombre: m.nombre, overridePct, effectivePct }
      }),
    },
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const defaultPct = clampPct(asNumber(body.defaultPct, 0))
  const overridesRaw = Array.isArray(body.overrides) ? body.overrides : []
  const overrides = overridesRaw
    .map((o) => (o && typeof o === 'object' ? (o as Record<string, unknown>) : null))
    .filter(Boolean)
    .map((o) => ({
      materialId: String(o!.materialId ?? ''),
      desperdicioPct: clampPct(asNumber(o!.desperdicioPct, 0)),
    }))
    .filter((o) => o.materialId)

  await prisma.$transaction(async (tx) => {
    await tx.sede.update({
      where: { id: access.sedeId },
      data: { desperdicioPctDefault: defaultPct },
      select: { id: true },
    })

    const keepMaterialIds = overrides.map((o) => o.materialId)

    await tx.sedeMaterialWaste.deleteMany({
      where: {
        sedeId: access.sedeId,
        ...(keepMaterialIds.length ? { materialId: { notIn: keepMaterialIds } } : {}),
      },
    })

    for (const o of overrides) {
      await tx.sedeMaterialWaste.upsert({
        where: { sedeId_materialId: { sedeId: access.sedeId, materialId: o.materialId } },
        update: { desperdicioPct: o.desperdicioPct },
        create: { sedeId: access.sedeId, materialId: o.materialId, desperdicioPct: o.desperdicioPct },
        select: { materialId: true },
      })
    }
  })

  return GET()
}
