/**
 * API Route: Clientes
 * GET /api/clientes - Lista todos los clientes
 * POST /api/clientes - Crea un nuevo cliente
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

type ClienteSegmento = "POTENCIAL" | "OCASIONAL" | "FRECUENTE"

function normalizeSegmento(value: unknown): ClienteSegmento | null {
  if (value == null || value === "") return null
  const s = String(value).trim().toUpperCase()
  if (s === "POTENCIAL" || s === "OCASIONAL" || s === "FRECUENTE") return s
  return null
}

function computeSegment(opts: { cotizaciones: number; ordenes: number }): ClienteSegmento {
  const cot = Math.max(0, opts.cotizaciones || 0)
  const ord = Math.max(0, opts.ordenes || 0)
  if (cot === 0 && ord === 0) return "POTENCIAL"
  if (ord >= 3 || cot >= 5) return "FRECUENTE"
  return "OCASIONAL"
}

// GET - Listar todos los clientes
export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'READ')
    if (!access.ok) return access.response

    // Obtener parámetros de búsqueda (opcional)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const segmento = searchParams.get('segmento')

    // Construir query
    const where = search
      ? {
          OR: [
            { nombre: { contains: search, mode: 'insensitive' as const } },
            { documento: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    // Obtener clientes de la base de datos
    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: {
            cotizaciones: true,
            ordenes: true,
          }
        }
      }
    })

    const clienteIds = clientes.map((c) => c.id)

    const [cotAgg, ordAgg] = await Promise.all([
      clienteIds.length
        ? prisma.cotizacion.groupBy({
            by: ["clienteId"],
            where: { clienteId: { in: clienteIds } },
            _max: { createdAt: true },
          })
        : Promise.resolve([]),
      clienteIds.length
        ? prisma.ordenTrabajo.groupBy({
            by: ["clienteId"],
            where: { clienteId: { in: clienteIds } },
            _max: { createdAt: true },
          })
        : Promise.resolve([]),
    ])

    const lastCotByCliente = new Map<string, Date>()
    for (const row of cotAgg) {
      if (row._max.createdAt) lastCotByCliente.set(row.clienteId, row._max.createdAt)
    }
    const lastOrdByCliente = new Map<string, Date>()
    for (const row of ordAgg) {
      if (row._max.createdAt) lastOrdByCliente.set(row.clienteId, row._max.createdAt)
    }

    const enhanced = clientes
      .map((c) => {
        const cotizaciones = c._count?.cotizaciones ?? 0
        const ordenes = c._count?.ordenes ?? 0
        const segmentoCalc = computeSegment({ cotizaciones, ordenes })
        const segmentoFinal = (c as { segmento?: ClienteSegmento | null }).segmento ?? segmentoCalc
        const lastCot = lastCotByCliente.get(c.id) ?? null
        const lastOrd = lastOrdByCliente.get(c.id) ?? null
        const ultimaActividadAt = lastCot && lastOrd
          ? (lastCot > lastOrd ? lastCot : lastOrd)
          : (lastCot ?? lastOrd)

        return {
          ...c,
          segmento: segmentoFinal,
          ultimaActividadAt,
        }
      })
      .filter((c) => {
        if (!segmento) return true
        const s = String(segmento).trim().toUpperCase()
        return c.segmento === s
      })

    return NextResponse.json({
      success: true,
      data: enhanced
    })

  } catch (error) {
    console.error("Error al obtener clientes:", error)
    return NextResponse.json(
      { error: "Error al obtener clientes" },
      { status: 500 }
    )
  }
}

// POST - Crear nuevo cliente
export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CLIENTES, 'WRITE')
    if (!access.ok) return access.response

    // Obtener datos del body
    const body = await request.json()
    const {
      nombre,
      tipoDocumento,
      documento,
      email,
      telefono,
      celular,
      direccion,
      ciudad,
      departamento,
      segmento,
    } = body

    const segmentoManual = normalizeSegmento(segmento)

    // Validar campos requeridos
    if (!nombre || !tipoDocumento || !documento) {
      return NextResponse.json(
        { error: "Nombre, tipo de documento y documento son requeridos" },
        { status: 400 }
      )
    }

    // Verificar si el documento ya existe
    const existingCliente = await prisma.cliente.findUnique({
      where: { documento }
    })

    if (existingCliente) {
      return NextResponse.json(
        { error: "Ya existe un cliente con este documento" },
        { status: 400 }
      )
    }

    // Obtener o crear empresa por defecto
    let empresa = await prisma.empresa.findFirst()
    
    if (!empresa) {
      empresa = await prisma.empresa.create({
        data: {
          nombre: "SGDigital",
          nit: "900000000-1"
        }
      })
    }
    
    const empresaId = empresa.id

    // Crear cliente
    const cliente = await prisma.cliente.create({
      data: {
        nombre,
        tipoDocumento,
        documento,
        email,
        telefono,
        celular,
        direccion,
        ciudad,
        departamento,
        ...(segmentoManual ? { segmento: segmentoManual } : {}),
        empresaId
      }
    })

    return NextResponse.json(
      {
        success: true,
        message: "Cliente creado exitosamente",
        data: cliente
      },
      { status: 201 }
    )

  } catch (error) {
    console.error("Error al crear cliente:", error)
    return NextResponse.json(
      { error: "Error al crear cliente" },
      { status: 500 }
    )
  }
}
