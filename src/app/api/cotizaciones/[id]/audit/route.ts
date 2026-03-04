import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function toNum(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return fallback
    const n = Number.parseFloat(trimmed)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

type NormalizedItem = {
  materialId: string | null
  descripcion: string
  unidad: string
  cantidad: number
  precioUnitario: number
  subtotal: number
}

function normalizeItem(x: unknown): NormalizedItem {
  const it = asRecord(x)
  return {
    materialId: typeof it.materialId === 'string' ? it.materialId : null,
    descripcion: String(it.descripcion || '').trim(),
    unidad: String(it.unidad || 'unidad').trim() || 'unidad',
    cantidad: toNum(it.cantidad, 0),
    precioUnitario: toNum(it.precioUnitario, 0),
    subtotal: toNum(it.subtotal, 0),
  }
}

function keyOf(it: NormalizedItem): string {
  return `${it.materialId ?? ''}::${it.descripcion}::${it.unidad}`
}

function summarizeUpdatedEvent(before: unknown, after: unknown): string[] {
  const b = asRecord(before)
  const a = asRecord(after)

  const money = (() => {
    try {
      return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
    } catch {
      return null
    }
  })()
  const fmtMoney = (n: number) => (money ? money.format(n) : String(n))

  const bItemsRaw = Array.isArray(b.items) ? (b.items as unknown[]) : []
  const aItemsRaw = Array.isArray(a.items) ? (a.items as unknown[]) : []

  const bItems = bItemsRaw.map(normalizeItem)
  const aItems = aItemsRaw.map(normalizeItem)

  const group = (items: NormalizedItem[]) => {
    const map = new Map<string, NormalizedItem[]>()
    for (const it of items) {
      const k = keyOf(it)
      const arr = map.get(k)
      if (arr) arr.push(it)
      else map.set(k, [it])
    }
    return map
  }

  const bMap = group(bItems)
  const aMap = group(aItems)
  const allKeys = new Set<string>([...Array.from(bMap.keys()), ...Array.from(aMap.keys())])

  const lines: string[] = []

  for (const k of allKeys) {
    const bArr = bMap.get(k) ?? []
    const aArr = aMap.get(k) ?? []
    const maxLen = Math.max(bArr.length, aArr.length)

    for (let i = 0; i < maxLen; i++) {
      const bi = bArr[i]
      const ai = aArr[i]

      const label = (bi ?? ai)?.descripcion || 'Ítem'

      if (!bi && ai) {
        lines.push(
          `Agregó ítem "${label}" (cant. ${ai.cantidad} • precio ${fmtMoney(ai.precioUnitario)})`
        )
        continue
      }

      if (bi && !ai) {
        lines.push(
          `Eliminó ítem "${label}" (cant. ${bi.cantidad} • precio ${fmtMoney(bi.precioUnitario)})`
        )
        continue
      }

      if (!bi || !ai) continue

      if (bi.cantidad !== ai.cantidad) {
        lines.push(`Cambió cantidad en "${label}" de ${bi.cantidad} a ${ai.cantidad}`)
      }
      if (bi.precioUnitario !== ai.precioUnitario) {
        lines.push(
          `Cambió precio unitario en "${label}" de ${fmtMoney(bi.precioUnitario)} a ${fmtMoney(ai.precioUnitario)}`
        )
      }
      if (bi.subtotal !== ai.subtotal) {
        lines.push(`Cambió subtotal en "${label}" de ${fmtMoney(bi.subtotal)} a ${fmtMoney(ai.subtotal)}`)
      }
    }
  }

  const beforeTotal = toNum(b.total, Number.NaN)
  const afterTotal = toNum(a.total, Number.NaN)
  if (Number.isFinite(beforeTotal) && Number.isFinite(afterTotal) && beforeTotal !== afterTotal) {
    lines.unshift(`Cambió total de ${fmtMoney(beforeTotal)} a ${fmtMoney(afterTotal)}`)
  }

  return lines.slice(0, 50)
}

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ')
    if (!access.ok) return access.response

    const { id } = await ctx.params

    const cot = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, sedeId: true },
    })

    if (!cot) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cot.sedeId && cot.sedeId !== access.sedeId) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    const events = await prisma.cotizacionAuditEvent.findMany({
      where: { cotizacionId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        action: true,
        effect: true,
        note: true,
        before: true,
        after: true,
        createdAt: true,
        performedBy: { select: { id: true, name: true, email: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    })

    const enriched = events.map((e) => {
      const autoSummary =
        e.action === 'UPDATED' && e.before && e.after ? summarizeUpdatedEvent(e.before, e.after) : []
      return { ...e, autoSummary }
    })

    return NextResponse.json({ success: true, data: { events: enriched } })
  } catch (error) {
    console.error('Error al obtener auditoría de cotización:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener auditoría de cotización' },
      { status: 500 }
    )
  }
}
