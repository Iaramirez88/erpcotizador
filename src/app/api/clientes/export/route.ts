import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { AccessLevel, ModuleKey } from '@prisma/client'
import { requireSedeAccess } from '@/lib/rbac'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

type ClienteSegmento = 'POTENCIAL' | 'OCASIONAL' | 'FRECUENTE'

function computeSegment(opts: { cotizaciones: number; ordenes: number }): ClienteSegmento {
  const cot = Math.max(0, opts.cotizaciones || 0)
  const ord = Math.max(0, opts.ordenes || 0)
  if (cot === 0 && ord === 0) return 'POTENCIAL'
  if (ord >= 3 || cot >= 5) return 'FRECUENTE'
  return 'OCASIONAL'
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

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'VENTAS',
      subdomain: 'CUSTOMERS',
      action: 'EXPORT',
      scope: 'EMPRESA',
    })
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const segmento = searchParams.get('segmento')
    const sedeId = searchParams.get('sedeId')
    const tipoDocumento = searchParams.get('tipoDocumento')
    const ciudad = searchParams.get('ciudad')
    const createdAtRange = parseCreatedAtRange(searchParams)
    const activityRange = parseActivityRange(searchParams)
    const invoiceTotalMin = parseNumberParam(searchParams, 'invoiceTotalMin')
    const invoiceTotalMax = parseNumberParam(searchParams, 'invoiceTotalMax')

    if (sedeId) {
      const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
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

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        sede: { select: { id: true, nombre: true } },
        _count: { select: { cotizaciones: true, ordenes: true } },
      },
    })

    const clienteIds = clientes.map((c) => c.id)

    const [cotAgg, ordAgg] = await Promise.all([
      clienteIds.length
        ? prisma.cotizacion.groupBy({ by: ['clienteId'], where: { clienteId: { in: clienteIds } }, _max: { createdAt: true } })
        : Promise.resolve([]),
      clienteIds.length
        ? prisma.ordenTrabajo.groupBy({ by: ['clienteId'], where: { clienteId: { in: clienteIds } }, _max: { createdAt: true } })
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
            items: { select: { quantity: true, material: { select: { precioCompra: true } } } },
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
        const ultimaActividadAt = lastCot && lastOrd ? (lastCot > lastOrd ? lastCot : lastOrd) : (lastCot ?? lastOrd)

        const inv = invoiceAgg.get(c.documento.trim()) ?? { count: 0, total: 0, cost: 0 }
        const cotAggRow = cotAggByCliente.get(c.id) ?? { count: 0, total: 0 }

        return {
          ...c,
          segmento: segmentoFinal,
          ultimaActividadAt,
          cotizacionesRangeCount: cotAggRow.count,
          cotizacionesRangeTotal: cotAggRow.total,
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

    const rows = enhanced.map((c) => ({
      ID: c.id,
      Nombre: c.nombre,
      TipoDocumento: c.tipoDocumento,
      Documento: c.documento,
      Email: c.email ?? '',
      Telefono: c.telefono ?? '',
      Celular: c.celular ?? '',
      Direccion: c.direccion ?? '',
      Ciudad: c.ciudad ?? '',
      Departamento: c.departamento ?? '',
      Sede: c.sede?.nombre ?? '',
      Segmento: c.segmento ?? '',
      Creado: c.createdAt,
      UltimaActividad: c.ultimaActividadAt ?? '',
      CotizacionesRangoCount: c.cotizacionesRangeCount ?? 0,
      CotizacionesRangoTotal: c.cotizacionesRangeTotal ?? 0,
      OrdenesCount: c._count?.ordenes ?? 0,
      FacturasCount: c.invoiceCount ?? 0,
      FacturadoTotal: c.invoiceTotal ?? 0,
      CostoAproxTotal: c.invoiceCost ?? 0,
    }))

    const buffer = await buildXlsxBuffer([{ name: 'Clientes', rows }])
    const filename = `clientes-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando clientes:', error)
    return NextResponse.json({ success: false, error: 'Error exportando clientes' }, { status: 500 })
  }
}
