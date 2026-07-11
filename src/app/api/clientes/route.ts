/**
 * API Route: Clientes
 * GET /api/clientes - Lista todos los clientes
 * POST /api/clientes - Crea un nuevo cliente
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCapabilityAccess } from "@/lib/api-rbac"
import { checkPlanLimit } from "@/lib/plan-limits"
import { AccessLevel, ModuleKey } from "@prisma/client"
import { requireSedeAccess } from "@/lib/rbac"

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

function parseCreatedAtRange(searchParams: URLSearchParams): { gte: Date; lt: Date } | null {
  const day = searchParams.get('createdAtDay')
  const month = searchParams.get('createdAtMonth')
  const year = searchParams.get('createdAtYear')

  if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const gte = new Date(`${day}T00:00:00`)
    const lt = new Date(gte)
    lt.setDate(lt.getDate() + 1)
    return { gte, lt }
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const gte = new Date(`${month}-01T00:00:00`)
    const lt = new Date(gte)
    lt.setMonth(lt.getMonth() + 1)
    return { gte, lt }
  }

  if (year && /^\d{4}$/.test(year)) {
    const gte = new Date(`${year}-01-01T00:00:00`)
    const lt = new Date(gte)
    lt.setFullYear(lt.getFullYear() + 1)
    return { gte, lt }
  }

  return null
}

function parseActivityRange(searchParams: URLSearchParams): { gte?: Date; lt?: Date } | null {
  const from = searchParams.get('activityFrom')
  const to = searchParams.get('activityTo')

  const out: { gte?: Date; lt?: Date } = {}

  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    out.gte = new Date(`${from}T00:00:00`)
  }

  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const lt = new Date(`${to}T00:00:00`)
    lt.setDate(lt.getDate() + 1)
    out.lt = lt
  }

  if (!out.gte && !out.lt) return null
  return out
}

function parseNumberParam(searchParams: URLSearchParams, key: string): number | null {
  const raw = searchParams.get(key)
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  const cleaned = s.replace(/\$/g, '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// GET - Listar todos los clientes
export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'VENTAS',
      subdomain: 'CUSTOMERS',
      action: 'READ',
      scope: 'EMPRESA',
    })
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const isAdmin = access.session.user.role === 'ADMIN'

    // Obtener parámetros de búsqueda (opcional)
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const segmento = searchParams.get('segmento')
    const requestedSedeId = searchParams.get('sedeId')
    const tipoDocumento = searchParams.get('tipoDocumento')
    const ciudad = searchParams.get('ciudad')
    const createdAtRange = parseCreatedAtRange(searchParams)
    const activityRange = parseActivityRange(searchParams)
    const invoiceTotalMin = parseNumberParam(searchParams, 'invoiceTotalMin')
    const invoiceTotalMax = parseNumberParam(searchParams, 'invoiceTotalMax')

    const sedeId = isAdmin ? requestedSedeId : access.sedeId

    if (requestedSedeId && isAdmin) {
      const sede = await prisma.sede.findUnique({ where: { id: requestedSedeId }, select: { id: true, empresaId: true } })
      if (!sede || sede.empresaId !== empresaId) {
        return NextResponse.json({ error: 'sedeId inválido' }, { status: 400 })
      }
      try {
        await requireSedeAccess({ userId: access.userId, sedeId: sede.id, module: ModuleKey.CLIENTES, minLevel: AccessLevel.READ })
      } catch (error) {
        if (error instanceof Error && error.message === 'FORBIDDEN') {
          return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
        }
        throw error
      }
    }

    // Construir query
    const where = {
      empresaId,
      ...(sedeId ? { sedeId } : {}),
      ...(createdAtRange ? { createdAt: createdAtRange } : {}),
      ...(tipoDocumento ? { tipoDocumento: String(tipoDocumento).trim() } : {}),
      ...(ciudad
        ? {
            ciudad: {
              contains: String(ciudad).trim(),
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' as const } },
              { documento: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    }

    // Obtener clientes de la base de datos
    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        sede: { select: { id: true, nombre: true } },
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

    const documentos = Array.from(
      new Set(
        clientes
          .map((c) => (c.documento ?? '').trim())
          .filter((d): d is string => Boolean(d))
      )
    )

    const cotizacionesAgg = await prisma.cotizacion.groupBy({
      by: ['clienteId'],
      where: {
        clienteId: { in: clienteIds },
        cliente: { empresaId },
        ...(sedeId ? { sedeId } : {}),
        ...(activityRange ? { createdAt: activityRange } : {}),
      },
      _count: { _all: true },
      _sum: { total: true },
    })

    const cotAggByCliente = new Map<string, { count: number; total: number }>()
    for (const row of cotizacionesAgg) {
      cotAggByCliente.set(row.clienteId, {
        count: row._count?._all ?? 0,
        total: row._sum?.total ?? 0,
      })
    }

    const invoices = documentos.length
      ? await prisma.posInvoice.findMany({
          where: {
            empresaId,
            status: 'PAID',
            ...(sedeId ? { sedeId } : {}),
            ...(activityRange ? { createdAt: activityRange } : {}),
            clienteDocumento: { in: documentos },
          },
          select: {
            clienteDocumento: true,
            total: true,
            items: {
              select: {
                quantity: true,
                material: { select: { precioCompra: true } },
              },
            },
          },
        })
      : []

    const invoiceAgg = new Map<string, { count: number; total: number; cost: number }>()
    for (const inv of invoices) {
      const key = (inv.clienteDocumento ?? '').trim()
      if (!key) continue

      const current = invoiceAgg.get(key) ?? { count: 0, total: 0, cost: 0 }
      current.count += 1
      current.total += inv.total ?? 0

      for (const item of inv.items) {
        const precioCompra = item.material?.precioCompra
        if (typeof precioCompra === 'number') {
          current.cost += precioCompra * (item.quantity ?? 0)
        }
      }

      invoiceAgg.set(key, current)
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

        const inv = invoiceAgg.get(c.documento.trim()) ?? { count: 0, total: 0, cost: 0 }
        const cotAgg = cotAggByCliente.get(c.id) ?? { count: 0, total: 0 }

        return {
          ...c,
          segmento: segmentoFinal,
          ultimaActividadAt,
          cotizacionesRangeCount: cotAgg.count,
          cotizacionesRangeTotal: cotAgg.total,
          invoiceCount: inv.count,
          invoiceTotal: inv.total,
          invoiceCost: inv.cost,
        }
      })
      .filter((c) => {
        if (!segmento) return true
        const s = String(segmento).trim().toUpperCase()
        return c.segmento === s
      })
      .filter((c) => {
        if (invoiceTotalMin == null && invoiceTotalMax == null) return true
        const total = typeof c.invoiceTotal === 'number' ? c.invoiceTotal : 0
        if (invoiceTotalMin != null && total < invoiceTotalMin) return false
        if (invoiceTotalMax != null && total > invoiceTotalMax) return false
        return true
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
    const access = await requireCapabilityAccess({
      domain: 'VENTAS',
      subdomain: 'CUSTOMERS',
      action: 'CREATE',
      scope: 'EMPRESA',
    })
    if (!access.ok) return access.response

    const empresaId = access.empresaId
    const limit = await checkPlanLimit(empresaId, 'CLIENTES_MAX')
    if (!limit.ok) {
      return NextResponse.json(limit, { status: 402 })
    }

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
        empresaId,
        sedeId: access.sedeId,
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
