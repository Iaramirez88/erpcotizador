/**
 * API Routes para Cotizaciones
 * GET /api/cotizaciones - Listar cotizaciones con filtros
 * POST /api/cotizaciones - Crear nueva cotización
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { EstadoCotizacion, ModuleKey, Prisma } from '@prisma/client'

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function toFloatOrNaN(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number.parseFloat(value)
  return Number.NaN
}

// GET - Listar cotizaciones
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? searchParams.get('busqueda')
    const clienteId = searchParams.get('clienteId')
    const estado = searchParams.get('estado')
    const sedeId = searchParams.get('sedeId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Math.min(200, Math.max(1, Number(limitParam))) : null

    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')
    const pageSize = pageSizeParam ? Math.min(200, Math.max(1, Number(pageSizeParam))) : null
    const page = pageParam ? Math.max(1, Number(pageParam)) : 1
    const usePagination = Boolean(pageSizeParam || pageParam)

    // Construir filtros
    // Nota: Cotizacion.sedeId es opcional por compatibilidad con registros antiguos.
    // Para que el historial no quede vacío, incluimos también los legacy (sedeId = null)
    // dentro del scope de la sede activa.
    const andFilters: Prisma.CotizacionWhereInput[] = [
      // Si se especifica un filtro de sede, usar ese; de lo contrario, usar el acceso del usuario
      sedeId 
        ? { sedeId: sedeId }
        : { OR: [{ sedeId: access.sedeId }, { sedeId: null }] },
    ]

    const where: Prisma.CotizacionWhereInput = { AND: andFilters }

    if (search) {
      andFilters.push({
        OR: [
          { numero: { contains: search, mode: 'insensitive' } },
          { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
          { cliente: { empresa: { is: { nombre: { contains: search, mode: 'insensitive' } } } } },
        ],
      })
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    if (estado) {
      const normalized = estado.trim().toUpperCase()
      const allowed: ReadonlySet<string> = new Set([
        'BORRADOR',
        'ENVIADA',
        'APROBADA',
        'RECHAZADA',
        'VENCIDA',
        'CONVERTIDA',
      ])

      if (allowed.has(normalized)) {
        where.estado = normalized as EstadoCotizacion
      }
    }

    if (from || to) {
      const createdAt: { gte?: Date; lt?: Date } = {}

      if (from) {
        const fromDate = new Date(`${from}T00:00:00`)
        if (!Number.isNaN(fromDate.getTime())) {
          createdAt.gte = fromDate
        }
      }

      if (to) {
        const toDate = new Date(`${to}T00:00:00`)
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setDate(toDate.getDate() + 1)
          createdAt.lt = toDate
        }
      }

      if (createdAt.gte || createdAt.lt) {
        where.createdAt = createdAt
      }
    }

    if (usePagination) {
      const take = pageSize ?? 20
      const skip = (page - 1) * take

      const [total, cotizaciones] = await prisma.$transaction([
        prisma.cotizacion.count({ where }),
        prisma.cotizacion.findMany({
          where,
          select: {
            id: true,
            numero: true,
            createdAt: true,
            estado: true,
            subtotal: true,
            iva: true,
            total: true,
            validezDias: true,
            emailSentCount: true,
            whatsappSentCount: true,
            lastEmailSentAt: true,
            lastWhatsappSentAt: true,
            cliente: {
              select: {
                nombre: true,
                email: true,
              },
            },
            items: {
              select: {
                id: true,
                materialId: true,
                descripcion: true,
                cantidad: true,
                unidad: true,
                material: {
                  select: {
                    nombre: true,
                  },
                },
              },
            },
            orden: {
              select: {
                id: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take,
        }),
      ])

      const totalPages = take > 0 ? Math.max(1, Math.ceil(total / take)) : 1
      return NextResponse.json({
        success: true,
        data: cotizaciones,
        meta: {
          page,
          pageSize: take,
          total,
          totalPages,
        },
      })
    }

    const cotizaciones = await prisma.cotizacion.findMany({
      where,
      select: {
        id: true,
        numero: true,
        createdAt: true,
        estado: true,
        subtotal: true,
        iva: true,
        total: true,
        validezDias: true,
        emailSentCount: true,
        whatsappSentCount: true,
        lastEmailSentAt: true,
        lastWhatsappSentAt: true,
        cliente: {
          select: {
            nombre: true,
            email: true,
          },
        },
        items: {
          select: {
            id: true,
            materialId: true,
            descripcion: true,
            cantidad: true,
            unidad: true,
            material: {
              select: {
                nombre: true,
              },
            },
          },
        },
        orden: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      ...(limit ? { take: limit } : {}),
    })

    return NextResponse.json({ success: true, data: cotizaciones })
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener cotizaciones' },
      { status: 500 }
    )
  }
}

// POST - Crear cotización
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json()
    const {
      clienteId,
      descripcion,
      items,
      descuento,
      descuentoPct,
      validezDias,
      tiempoEntrega,
      observaciones,
      garantia,
      paymentMethods,
      boldCheckoutUrl
    } = body

    // Validaciones
    if (!clienteId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente e items son requeridos' },
        { status: 400 }
      )
    }

    // Recalcular totales en servidor (fuente de verdad)
    const itemsTotal = Array.isArray(items)
      ? items.reduce((acc: number, it: unknown) => {
          const rec = asRecord(it)
          const subtotal = toFloatOrNaN(rec.subtotal)
          return acc + (Number.isFinite(subtotal) ? subtotal : 0)
        }, 0)
      : 0

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

    // La numeración y config (IVA/prefijo) se resuelven de forma atómica en transacción.
    const result = await prisma.$transaction(async (tx) => {
      const sede = await tx.sede.findUnique({
        where: { id: access.sedeId },
        select: {
          codigo: true,
          cotizacionesPricesIncludeIva: true,
          cotizacionesIvaPct: true,
        },
      })

      const sedeCodigo = (sede?.codigo || '').trim() || '00'
      const pricesIncludeIva = sede?.cotizacionesPricesIncludeIva ?? true
      const ivaPct = Math.min(100, Math.max(0, sede?.cotizacionesIvaPct ?? 19))

      const seq = await tx.cotizacionSequence.upsert({
        where: { sedeId: access.sedeId },
        update: { currentNumber: { increment: 1 } },
        create: { sedeId: access.sedeId, currentNumber: 1 },
        select: { currentNumber: true },
      })

      const numero = `COT-${sedeCodigo}-${String(seq.currentNumber).padStart(4, '0')}`

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

      // Preparar observaciones combinadas
      const observacionesCompletas = [
        descripcion,
        tiempoEntrega ? `Tiempo de entrega: ${tiempoEntrega}` : null,
        observaciones,
      ]
        .filter(Boolean)
        .join('\n\n')

      // Crear cotización con items
      const cotizacion = await tx.cotizacion.create({
      data: {
        numero,
        sedeId: access.sedeId,
        clienteId,
        vendedorId: access.userId,
        subtotal: subtotalCalc,
        descuento: Math.max(0, desc),
        iva: ivaCalc,
        total: totalCalc,
        validezDias: parseInt(validezDias) || 15,
        estado: 'BORRADOR',
        observaciones: observacionesCompletas || null,
        garantia: typeof garantia === 'string' ? garantia.trim() || null : null,
        paymentMethods: Array.isArray(paymentMethods)
          ? paymentMethods.map((x: unknown) => String(x || '').trim()).filter(Boolean)
          : [],
        boldCheckoutUrl: typeof boldCheckoutUrl === 'string' ? boldCheckoutUrl.trim() || null : null,
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
          })
        }
      },
      include: {
        cliente: true,
        items: {
          include: {
            material: true,
            terminados: {
              include: {
                terminado: true,
              },
            },
          }
        },
        vendedor: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

      return cotizacion
    })

    return NextResponse.json({ success: true, data: result }, { status: 201 })
  } catch (error) {
    console.error('Error al crear cotización:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear cotización' },
      { status: 500 }
    )
  }
}
