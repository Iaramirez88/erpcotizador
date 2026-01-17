/**
 * API Routes para Cotizaciones
 * GET /api/cotizaciones - Listar cotizaciones con filtros
 * POST /api/cotizaciones - Crear nueva cotización
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

// GET - Listar cotizaciones
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? searchParams.get('busqueda')
    const clienteId = searchParams.get('clienteId')
    const estado = searchParams.get('estado')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Construir filtros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { sedeId: access.sedeId }

    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
        { cliente: { empresa: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    if (estado) {
      where.estado = estado
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

    const cotizaciones = await prisma.cotizacion.findMany({
      where,
      include: {
        cliente: true,
        items: {
          include: {
            material: true
          }
        },
        orden: {
          select: {
            id: true
          }
        },
        vendedor: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
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
      subtotal,
      descuento,
      iva,
      total,
      validezDias,
      tiempoEntrega,
      observaciones
    } = body

    // Validaciones
    if (!clienteId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cliente e items son requeridos' },
        { status: 400 }
      )
    }

    // Generar número de cotización
    const ultimaCotizacion = await prisma.cotizacion.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    let numeroSecuencial = 1
    if (ultimaCotizacion?.numero) {
      const match = ultimaCotizacion.numero.match(/COT-(\d+)/)
      if (match) {
        numeroSecuencial = parseInt(match[1]) + 1
      }
    }

    const numero = `COT-${numeroSecuencial.toString().padStart(5, '0')}`

    // Preparar observaciones combinadas
    const observacionesCompletas = [
      descripcion,
      tiempoEntrega ? `Tiempo de entrega: ${tiempoEntrega}` : null,
      observaciones
    ].filter(Boolean).join('\n\n')

    // Crear cotización con items
    const cotizacion = await prisma.cotizacion.create({
      data: {
        numero,
        sedeId: access.sedeId,
        clienteId,
        vendedorId: access.userId,
        subtotal: parseFloat(subtotal) || 0,
        descuento: parseFloat(descuento) || 0,
        iva: parseFloat(iva) || 0,
        total: parseFloat(total) || 0,
        validezDias: parseInt(validezDias) || 15,
        estado: 'BORRADOR',
        observaciones: observacionesCompletas || null,
        items: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: items.map((item: any) => ({
            descripcion: item.descripcion,
            material: item.materialId ? { connect: { id: item.materialId } } : undefined,
            cantidad: parseFloat(item.cantidad),
            unidad: 'unidad',
            ancho: parseFloat(item.ancho) || null,
            alto: parseFloat(item.alto) || null,
            area: parseFloat(item.m2) || null,
            laminado: item.laminado || false,
            troquelado: item.troquelado || false,
            instalacion: item.instalacion || false,
            costoMaterial: parseFloat(item.precioUnitario) || 0,
            costoImpresion: 0,
            costoAcabados: (parseFloat(item.costoLaminado) || 0) + (parseFloat(item.costoTroquelado) || 0),
            costoInstalacion: parseFloat(item.costoInstalacion) || 0,
            precioUnitario: parseFloat(item.precioUnitario) || 0,
            subtotal: parseFloat(item.subtotal) || 0,
          }))
        }
      },
      include: {
        cliente: true,
        items: {
          include: {
            material: true
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

    return NextResponse.json({ success: true, data: cotizacion }, { status: 201 })
  } catch (error) {
    console.error('Error al crear cotización:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear cotización' },
      { status: 500 }
    )
  }
}
