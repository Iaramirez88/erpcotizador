import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

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
    const details =
      process.env.NODE_ENV !== 'production'
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined
    return NextResponse.json(
      { success: false, error: 'Error al obtener cotización', ...(details ? { details } : {}) },
      { status: 500 }
    )
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
    const details =
      process.env.NODE_ENV !== 'production'
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined
    return NextResponse.json(
      { success: false, error: 'Error al eliminar', ...(details ? { details } : {}) },
      { status: 500 }
    )
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
    const auditNote = typeof rec.auditNote === 'string' ? rec.auditNote.trim() : ''

    if (!clienteId || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Cliente e items son requeridos' }, { status: 400 })
    }

    const existing = await prisma.cotizacion.findUnique({
      where: { id },
      select: {
        id: true,
        sedeId: true,
        estado: true,
        subtotal: true,
        descuento: true,
        iva: true,
        total: true,
        editCount: true,
        postApprovalEditCount: true,
        ventaRealizadaAt: true,
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            materialId: true,
            descripcion: true,
            unidad: true,
            cantidad: true,
            precioUnitario: true,
            subtotal: true,
            observaciones: true,
            costoMaterial: true,
            costoImpresion: true,
            costoAcabados: true,
            costoInstalacion: true,
          },
        },
        orden: { select: { id: true } },
      },
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

    const isPostApprovalEdit = String(existing.estado) === 'APROBADA'

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

      const beforeSnapshot = {
        estado: existing.estado,
        subtotal: existing.subtotal,
        descuento: existing.descuento,
        iva: existing.iva,
        total: existing.total,
        editCount: existing.editCount,
        postApprovalEditCount: existing.postApprovalEditCount,
        ventaRealizadaAt: existing.ventaRealizadaAt,
        items: (existing.items ?? []).map((it) => ({
          materialId: it.materialId,
          descripcion: it.descripcion,
          unidad: it.unidad,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          subtotal: it.subtotal,
          observaciones: it.observaciones,
          costoMaterial: it.costoMaterial,
          costoImpresion: it.costoImpresion,
          costoAcabados: it.costoAcabados,
          costoInstalacion: it.costoInstalacion,
        })),
      }

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
          editCount: { increment: 1 },
          ...(isPostApprovalEdit ? { postApprovalEditCount: { increment: 1 } } : {}),
          items: {
            create: items.map((item: unknown) => {
              const it = asRecord(item)
              const terminadosRaw = it.terminados
              const terminados = Array.isArray(terminadosRaw) ? terminadosRaw : []

              const qty = toFloatOrNaN(it.cantidad)
              const costoMaterialUnit = toFloatOrNaN(it.costoMaterial)
              const costoImpresionUnit = toFloatOrNaN(it.costoImpresion)
              const costoAcabadosTotal = toFloatOrNaN(it.costoAcabados)
              const costoInstalacionTotal = toFloatOrNaN(it.costoInstalacion)

              return {
                descripcion: typeof it.descripcion === 'string' ? it.descripcion.trim() : '',
                observaciones:
                  typeof it.observaciones === 'string' ? it.observaciones.trim() || null : null,
                material: it.materialId ? { connect: { id: String(it.materialId) } } : undefined,
                cantidad: qty,
                unidad: typeof it.unidad === 'string' && it.unidad.trim() ? it.unidad.trim() : 'unidad',
                ancho: toFloatOrNaN(it.ancho) || null,
                alto: toFloatOrNaN(it.alto) || null,
                area: toFloatOrNaN(it.m2) || null,
                desperdicioPct: toFloatOrNaN(it.desperdicioPct) || 0,
                laminado: Boolean(it.laminado),
                troquelado: Boolean(it.troquelado),
                instalacion: Boolean(it.instalacion),
                // Costos: compatibilidad
                // - Si vienen costos explícitos, se respetan.
                // - Si no, se asume costoMaterial ~= precioUnitario (margen 0 por defecto).
                costoMaterial: Number.isFinite(costoMaterialUnit)
                  ? costoMaterialUnit
                  : (toFloatOrNaN(it.precioUnitario) || 0),
                costoImpresion: Number.isFinite(costoImpresionUnit) ? costoImpresionUnit : 0,
                costoAcabados: Number.isFinite(costoAcabadosTotal)
                  ? costoAcabadosTotal
                  : (toFloatOrNaN(it.costoLaminado) || 0) + (toFloatOrNaN(it.costoTroquelado) || 0),
                costoInstalacion: Number.isFinite(costoInstalacionTotal)
                  ? costoInstalacionTotal
                  : (toFloatOrNaN(it.costoInstalacion) || 0),
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

      const afterSnapshot = {
        estado: updated.estado,
        subtotal: updated.subtotal,
        descuento: updated.descuento,
        iva: updated.iva,
        total: updated.total,
        editCount: updated.editCount,
        postApprovalEditCount: updated.postApprovalEditCount,
        ventaRealizadaAt: updated.ventaRealizadaAt,
        items: (updated.items ?? []).map((it) => ({
          materialId: it.materialId,
          descripcion: it.descripcion,
          unidad: it.unidad,
          cantidad: it.cantidad,
          precioUnitario: it.precioUnitario,
          subtotal: it.subtotal,
          observaciones: it.observaciones,
          costoMaterial: it.costoMaterial,
          costoImpresion: it.costoImpresion,
          costoAcabados: it.costoAcabados,
          costoInstalacion: it.costoInstalacion,
        })),
      }

      const deltaTotal = (afterSnapshot.total ?? 0) - (beforeSnapshot.total ?? 0)
      const effect = deltaTotal > 0.000001 ? 'DEBIT' : deltaTotal < -0.000001 ? 'CREDIT' : 'NONE'

      await tx.cotizacionAuditEvent.create({
        data: {
          cotizacionId: updated.id,
          action: 'UPDATED',
          effect,
          note: auditNote || null,
          performedById: access.userId,
          requestedById: access.userId,
          before: beforeSnapshot,
          after: afterSnapshot,
        },
      })

      return updated
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error al actualizar cotización:', error)
    const details =
      process.env.NODE_ENV !== 'production'
        ? error instanceof Error
          ? error.message
          : String(error)
        : undefined
    return NextResponse.json(
      { success: false, error: 'Error al actualizar cotización', ...(details ? { details } : {}) },
      { status: 500 }
    )
  }
}
