import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { encryptGoogleMarketingToken, getGoogleMarketingProductScope, refreshGoogleMarketingAccessToken } from '@/lib/crm-google-marketing'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export async function POST() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const connection = await prisma.crmMarketingConnection.findFirst({
      where: { empresaId: access.empresaId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    })
    if (!connection?.refreshTokenEncrypted || !connection.scopes.includes(getGoogleMarketingProductScope('SEARCH_CONSOLE'))) {
      return NextResponse.json({ error: 'Conecta Google antes de consultar posiciones.' }, { status: 409 })
    }
    if (!connection.searchConsoleSiteUrl) {
      return NextResponse.json({ error: 'Configura la propiedad de Search Console.' }, { status: 409 })
    }

    const keywords = await prisma.crmSeoKeyword.findMany({
      where: { empresaId: access.empresaId, active: true },
    })
    if (!keywords.length) return NextResponse.json({ error: 'Agrega al menos una palabra clave.' }, { status: 400 })

    const token = await refreshGoogleMarketingAccessToken(connection.refreshTokenEncrypted)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - 2)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - 27)
    const endpoint = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(connection.searchConsoleSiteUrl)}/searchAnalytics/query`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: isoDate(startDate),
        endDate: isoDate(endDate),
        dimensions: ['query', 'page'],
        rowLimit: 25000,
        dataState: 'final',
      }),
      cache: 'no-store',
    })
    const payload = (await response.json().catch(() => ({}))) as {
      rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>
      error?: { message?: string }
    }
    if (!response.ok) throw new Error(payload.error?.message || 'Search Console rechazó la consulta.')

    const rowsByKeyword = new Map<string, NonNullable<typeof payload.rows>[number]>()
    for (const row of payload.rows || []) {
      const query = String(row.keys?.[0] || '').trim().toLowerCase()
      if (!query) continue
      const current = rowsByKeyword.get(query)
      if (!current || (row.impressions || 0) > (current.impressions || 0)) rowsByKeyword.set(query, row)
    }
    const checkedAt = new Date()

    await prisma.$transaction(async (tx) => {
      for (const keyword of keywords) {
        const row = rowsByKeyword.get(keyword.keyword.trim().toLowerCase())
        const position = typeof row?.position === 'number' ? row.position : null
        await tx.crmSeoKeywordPosition.create({
          data: {
            empresaId: access.empresaId,
            keywordId: keyword.id,
            checkedAt,
            position,
            resultUrl: row?.keys?.[1] || null,
            clicks: row?.clicks == null ? null : Math.round(row.clicks),
            impressions: row?.impressions == null ? null : Math.round(row.impressions),
            ctr: row?.ctr ?? null,
            rawJson: (row || {}) as Prisma.InputJsonValue,
          },
        })
        await tx.crmSeoKeyword.update({
          where: { id: keyword.id },
          data: {
            previousSearchConsolePosition: keyword.latestSearchConsolePosition,
            latestSearchConsolePosition: position,
            latestSearchConsoleUrl: row?.keys?.[1] || null,
            lastSearchConsoleCheckedAt: checkedAt,
          },
        })
      }
      await tx.crmMarketingConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEncrypted: encryptGoogleMarketingToken(token.access_token),
          tokenExpiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null,
          lastSyncAt: checkedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      })
    })

    return NextResponse.json({ success: true, data: { checked: keywords.length, matched: keywords.filter((item) => rowsByKeyword.has(item.keyword.trim().toLowerCase())).length } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron consultar las posiciones.'
    console.error('Error sincronizando Search Console:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
