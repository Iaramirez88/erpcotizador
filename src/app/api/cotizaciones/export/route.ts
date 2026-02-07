import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { EstadoCotizacion, ModuleKey, Prisma } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

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

    const andFilters: Prisma.CotizacionWhereInput[] = [
      sedeId ? { sedeId } : { OR: [{ sedeId: access.sedeId }, { sedeId: null }] },
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

    if (clienteId) where.clienteId = clienteId

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
      if (allowed.has(normalized)) where.estado = normalized as EstadoCotizacion
    }

    if (from || to) {
      const createdAt: { gte?: Date; lt?: Date } = {}
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`)
        if (!Number.isNaN(fromDate.getTime())) createdAt.gte = fromDate
      }
      if (to) {
        const toDate = new Date(`${to}T00:00:00`)
        if (!Number.isNaN(toDate.getTime())) {
          toDate.setDate(toDate.getDate() + 1)
          createdAt.lt = toDate
        }
      }
      if (createdAt.gte || createdAt.lt) where.createdAt = createdAt
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
        cliente: { select: { nombre: true, email: true } },
        orden: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    })

    const rows = cotizaciones.map((c) => ({
      ID: c.id,
      Numero: c.numero,
      Fecha: c.createdAt,
      Estado: c.estado,
      Cliente: c.cliente?.nombre ?? '',
      ClienteEmail: c.cliente?.email ?? '',
      Subtotal: c.subtotal ?? 0,
      IVA: c.iva ?? 0,
      Total: c.total ?? 0,
      ValidezDias: c.validezDias ?? 0,
      EmailSentCount: c.emailSentCount ?? 0,
      WhatsappSentCount: c.whatsappSentCount ?? 0,
      LastEmailSentAt: c.lastEmailSentAt ?? '',
      LastWhatsappSentAt: c.lastWhatsappSentAt ?? '',
      OrdenId: c.orden?.id ?? '',
    }))

    const buffer = buildXlsxBuffer([{ name: 'Cotizaciones', rows }])
    const filename = `cotizaciones-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando cotizaciones:', error)
    return NextResponse.json({ success: false, error: 'Error exportando cotizaciones' }, { status: 500 })
  }
}
