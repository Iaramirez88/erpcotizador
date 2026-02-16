import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function toFloatOrNaN(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value)
  return Number.NaN
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ')
    if (!access.ok) return access.response

    const { id } = await params

    const cotizacion = await prisma.cotizacion.findFirst({
      where: {
        id,
        AND: [{ OR: [{ sedeId: access.sedeId }, { sedeId: null }] }],
      },
      include: {
        cliente: true,
        items: { include: { material: true }, orderBy: { createdAt: 'asc' } },
        vendedor: true
      }
    })

    if (!cotizacion) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: cotizacion })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener cotización' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await params

    const cotizacion = await prisma.cotizacion.findFirst({ 
      where: {
        id,
        AND: [{ OR: [{ sedeId: access.sedeId }, { sedeId: null }] }],
      },
      include: { orden: true }
    })

    if (!cotizacion) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (cotizacion.orden) {
      return NextResponse.json({ success: false, error: 'No se puede eliminar: tiene una orden asociada' }, { status: 400 })
    }

    await prisma.itemCotizacion.deleteMany({ where: { cotizacionId: id } })
    await prisma.cotizacion.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Cotización eliminada' })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ success: false, error: 'Error al eliminar' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const rec = asRecord(body)

    const clienteId = String(rec.clienteId || '').trim()
    const descripcion = typeof rec.descripcion === 'string' ? rec.descripcion : ''
    const items = Array.isArray(rec.items) ? (rec.items as unknown[]) : []
    const descuento = rec.descuento
    const descuentoPct = rec.descuentoPct
    const validezDias = rec.validezDias
    const tiempoEntrega = typeof rec.tiempoEntrega === 'string' ? rec.tiempoEntrega : ''
    const observaciones = typeof rec.observaciones === 'string' ? rec.observaciones : ''
    const garantia = typeof rec.garantia === 'string' ? rec.garantia : null
    const paymentMethods = rec.paymentMethods
    const boldCheckoutUrl = typeof rec.boldCheckoutUrl === 'string' ? rec.boldCheckoutUrl : null

    if (!clienteId || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Cliente e items son requeridos' }, { status: 400 })
    }

    const existing = await prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, sedeId: true, estado: true, orden: { select: { id: true } } },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (existing.sedeId && existing.sedeId !== access.sedeId) {
      return NextResponse.json({ success: false, error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (existing.orden) {
      return NextResponse.json({ success: false, error: 'No se puede editar: tiene una orden asociada' }, { status: 400 })
    }

    if (String(existing.estado) !== 'BORRADOR') {
      return NextResponse.json({ success: false, error: 'Solo se pueden editar cotizaciones en BORRADOR' }, { status: 400 })
    }

    // Recalcular totales en servidor (fuente de verdad)
    const itemsTotal = items.reduce((acc: number, it: unknown) => {
      const itRec = asRecord(it)
      const st = toFloatOrNaN(itRec.subtotal)
      return acc + (Number.isFinite(st) ? st : 0)
    }, 0)

    const pct = Number.parseFloat(String(descuentoPct ?? ''))

    // Compatibilidad:
    // - Si viene `descuentoPct`, se interpreta como % del total de items.
    // - Si no viene, `descuento` se interpreta como valor absoluto.
    let desc = Number.parseFloat(String(descuento ?? '')) || 0
    if (Number.isFinite(pct) && pct > 0) {
      const clampedPct = Math.min(100, Math.max(0, pct))
      desc = itemsTotal * (clampedPct / 100)
    }

    const grossAfterDiscount = Math.max(0, itemsTotal - Math.max(0, desc))

    const result = await prisma.$transaction(async (tx) => {
      const sede = await tx.sede.findUnique({
        where: { id: access.sedeId },
        select: {
          cotizacionesPricesIncludeIva: true,
          cotizacionesIvaPct: true,
        },
      })

      const pricesIncludeIva = sede?.cotizacionesPricesIncludeIva ?? true
      const ivaPct = Math.min(100, Math.max(0, sede?.cotizacionesIvaPct ?? 19))

      let subtotalCalc = 0
      let ivaCalc = 0
      let totalCalc = 0

      if (pricesIncludeIva) {
        const denom = 1 + ivaPct / 100
        const base = denom > 0 ? grossAfterDiscount / denom : grossAfterDiscount
        subtotalCalc = base
        ivaCalc = grossAfterDiscount - base
        totalCalc = grossAfterDiscount
      } else {
        subtotalCalc = grossAfterDiscount
        ivaCalc = grossAfterDiscount * (ivaPct / 100)
        totalCalc = grossAfterDiscount + ivaCalc
      }

      const observacionesCompletas = [
        descripcion,
        tiempoEntrega ? `Tiempo de entrega: ${tiempoEntrega}` : null,
        observaciones,
      ]
        .filter(Boolean)
        .join('\n\n')

      await tx.itemCotizacion.deleteMany({ where: { cotizacionId: id } })

      const updated = await tx.cotizacion.update({
        where: { id },
        data: {
          sedeId: existing.sedeId ?? access.sedeId,
          clienteId,
          subtotal: subtotalCalc,
          descuento: Math.max(0, desc),
          iva: ivaCalc,
          total: totalCalc,
          validezDias: Number.parseInt(String(validezDias)) || 15,
          observaciones: observacionesCompletas || null,
          garantia: garantia ? String(garantia).trim() || null : null,
          paymentMethods: Array.isArray(paymentMethods)
            ? paymentMethods.map((x: unknown) => String(x || '').trim()).filter(Boolean)
            : [],
          boldCheckoutUrl: boldCheckoutUrl ? String(boldCheckoutUrl).trim() || null : null,
          items: {
            create: items.map((item: unknown) => {
              const it = asRecord(item)
              const terminadosRaw = it.terminados
              const terminados = Array.isArray(terminadosRaw) ? terminadosRaw : []

              return {
                descripcion: typeof it.descripcion === 'string' ? it.descripcion.trim() : '',
                material: it.materialId ? { connect: { id: String(it.materialId) } } : undefined,
                cantidad: toFloatOrNaN(it.cantidad),
                unidad: typeof it.unidad === 'string' && it.unidad.trim() ? it.unidad.trim() : 'unidad',
                ancho: toFloatOrNaN(it.ancho) || null,
                alto: toFloatOrNaN(it.alto) || null,
                area: toFloatOrNaN(it.m2) || null,
                desperdicioPct: toFloatOrNaN(it.desperdicioPct) || 0,
                laminado: Boolean(it.laminado),
                troquelado: Boolean(it.troquelado),
                instalacion: Boolean(it.instalacion),
                costoMaterial: toFloatOrNaN(it.precioUnitario) || 0,
                costoImpresion: 0,
                costoAcabados: (toFloatOrNaN(it.costoLaminado) || 0) + (toFloatOrNaN(it.costoTroquelado) || 0),
                costoInstalacion: toFloatOrNaN(it.costoInstalacion) || 0,
                precioUnitario: toFloatOrNaN(it.precioUnitario) || 0,
                subtotal: toFloatOrNaN(it.subtotal) || 0,
                terminados:
                  terminados.length > 0
                    ? {
                        create: terminados
                          .map(asRecord)
                          .filter((t) => Boolean(t.terminadoId))
                          .map((t) => ({
                            terminado: { connect: { id: String(t.terminadoId) } },
                            unidadAplicacion:
                              typeof t.unidadAplicacion === 'string' ? t.unidadAplicacion : 'unidad',
                            baseCantidad: Number(t.baseCantidad) || 0,
                            precioUnitario: Number(t.precioUnitario) || 0,
                            costoTotal: Number(t.costoTotal) || 0,
                          })),
                      }
                    : undefined,
              }
            }),
          },
        },
        include: {
          cliente: true,
          items: { include: { material: true, terminados: { include: { terminado: true } } } },
          vendedor: { select: { name: true, email: true } },
        },
      })

      return updated
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error al actualizar cotización:', error)
    return NextResponse.json({ success: false, error: 'Error al actualizar cotización' }, { status: 500 })
  }
}
