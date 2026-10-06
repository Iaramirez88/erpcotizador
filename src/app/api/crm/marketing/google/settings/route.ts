import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PATCH(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'CONFIGURE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const connection = await prisma.crmMarketingConnection.findFirst({
      where: { empresaId: access.empresaId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    if (!connection) return NextResponse.json({ error: 'Conecta primero una cuenta de Google.' }, { status: 409 })

    const searchConsoleSiteUrl = normalizeString(body?.searchConsoleSiteUrl).slice(0, 2048) || null
    if (searchConsoleSiteUrl) {
      try {
        const url = new URL(searchConsoleSiteUrl)
        if (!['http:', 'https:', 'sc-domain:'].includes(url.protocol)) throw new Error()
      } catch {
        if (!searchConsoleSiteUrl.startsWith('sc-domain:')) {
          return NextResponse.json({ error: 'La propiedad de Search Console no es válida.' }, { status: 400 })
        }
      }
    }

    const row = await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: {
        googleAdsCustomerId: normalizeString(body?.googleAdsCustomerId).replace(/\D/g, '').slice(0, 20) || null,
        googleAnalyticsPropertyId: normalizeString(body?.googleAnalyticsPropertyId).replace(/^properties\//, '').replace(/\D/g, '').slice(0, 30) || null,
        searchConsoleSiteUrl,
      },
      select: {
        id: true,
        googleAdsCustomerId: true,
        googleAnalyticsPropertyId: true,
        searchConsoleSiteUrl: true,
      },
    })
    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error guardando configuración Google Marketing:', error)
    return NextResponse.json({ error: 'No se pudo guardar la configuración.' }, { status: 500 })
  }
}
