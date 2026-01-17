/**
 * API Route: Materiales
 * GET /api/materiales - Lista todos los materiales
 * POST /api/materiales - Crea un nuevo material
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

// GET - Listar todos los materiales
export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const tipo = searchParams.get('tipo')
    const activo = searchParams.get('activo')

    // Construir filtros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { categoria: { contains: search, mode: 'insensitive' as const } },
        { proveedor: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (tipo) {
      where.tipo = tipo
    }

    if (activo !== null && activo !== undefined) {
      where.activo = activo === 'true'
    }

    const materiales = await prisma.material.findMany({
      where,
      include: {
        quantityDiscounts: {
          orderBy: { minQty: 'asc' }
        }
      },
      orderBy: {
        nombre: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: materiales
    })

  } catch (error) {
    console.error("Error al obtener materiales:", error)
    return NextResponse.json(
      { error: "Error al obtener materiales" },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo material
export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json()
    const {
      nombre,
      tipo,
      categoria,
      ancho,
      largo,
      espesor,
      color,
      precioM2,
      precioMetro,
      precioUnidad,
      precioCompra,
      stockActual,
      stockMinimo,
      unidadMedida,
      proveedor,
      observaciones,
      activo
    } = body

    const quantityDiscounts = Array.isArray(body.quantityDiscounts) ? body.quantityDiscounts : []

    const quantityDiscountData = quantityDiscounts
      .map((d: { minQty?: unknown; discountPct?: unknown }) => ({
        minQty: Number(d.minQty),
        discountPct: Number(d.discountPct),
      }))
      .filter((d: { minQty: number; discountPct: number }) =>
        Number.isFinite(d.minQty) &&
        d.minQty > 0 &&
        Number.isFinite(d.discountPct) &&
        d.discountPct >= 0 &&
        d.discountPct <= 100
      )

    // Validar campos requeridos
    if (!nombre || !tipo || !unidadMedida) {
      return NextResponse.json(
        { error: "Nombre, tipo y unidad de medida son requeridos" },
        { status: 400 }
      )
    }

    // Obtener o crear empresa
    let empresa = await prisma.empresa.findFirst()
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: "SGDigital",
          nit: "900000000-1"
        }
      })
    }

    // Crear material
    const material = await prisma.material.create({
      data: {
        nombre,
        tipo,
        categoria,
        ancho: ancho ? parseFloat(ancho) : null,
        largo: largo ? parseFloat(largo) : null,
        espesor: espesor ? parseFloat(espesor) : null,
        color,
        precioM2: precioM2 ? parseFloat(precioM2) : null,
        precioMetro: precioMetro ? parseFloat(precioMetro) : null,
        precioUnidad: precioUnidad ? parseFloat(precioUnidad) : null,
        precioCompra: precioCompra ? parseFloat(precioCompra) : null,
        stockActual: stockActual ? parseFloat(stockActual) : 0,
        stockMinimo: stockMinimo ? parseFloat(stockMinimo) : 0,
        unidadMedida,
        proveedor,
        observaciones,
        activo: activo !== false,
        empresaId: empresa.id,
        ...(quantityDiscountData.length > 0
          ? {
              quantityDiscounts: {
                createMany: { data: quantityDiscountData }
              }
            }
          : {})
      },
      include: {
        quantityDiscounts: { orderBy: { minQty: 'asc' } }
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: "Material creado exitosamente",
        data: material
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Error al crear material:", error)
    return NextResponse.json(
      { error: "Error al crear material" },
      { status: 500 }
    )
  }
}
