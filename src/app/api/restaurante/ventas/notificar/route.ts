import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

type Body = {
  invoiceId?: unknown
  numero?: unknown
  tableName?: unknown
  clienteNombre?: unknown
  total?: unknown
}

function cleanText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function cleanNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({ domain: 'VERTICALES', subdomain: 'RESTAURANTE', action: 'UPDATE', allowLegacyFallback: false })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Body | null
    const invoiceId = cleanText(body?.invoiceId)
    const numero = cleanText(body?.numero)
    const tableName = cleanText(body?.tableName)
    const clienteNombre = cleanText(body?.clienteNombre) || 'Consumidor final'
    const total = cleanNumber(body?.total)

    if (!invoiceId || !numero) {
      return NextResponse.json({ ok: false, error: 'invoiceId y numero son requeridos' }, { status: 400 })
    }

    const memberships = await prisma.sedeMembership.findMany({
      where: { sedeId: access.sedeId },
      select: { userId: true },
    })

    const recipientIds = Array.from(new Set(memberships.map((membership) => membership.userId).filter((userId) => Boolean(userId) && userId !== access.userId)))

    if (recipientIds.length) {
      const totalLabel = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total || 0)
      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          empresaId: access.empresaId,
          sedeId: access.sedeId,
          type: 'INFO',
          title: `Nueva venta restaurante ${numero}`,
          body: `${tableName || 'Mesa'} · ${clienteNombre} · ${totalLabel}`,
          actionUrl: '/dashboard/restaurante',
          actionLabel: 'Abrir restaurante',
        })),
      })
    }

    return NextResponse.json({ ok: true, recipients: recipientIds.length })
  } catch (error) {
    console.error('POST /api/restaurante/ventas/notificar error:', error)
    return NextResponse.json({ ok: false, error: 'No se pudo notificar la venta de restaurante' }, { status: 500 })
  }
}