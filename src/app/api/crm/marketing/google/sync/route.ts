import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { encryptGoogleMarketingToken, getGoogleMarketingProductScope, refreshGoogleMarketingAccessToken } from '@/lib/crm-google-marketing'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type AdsResult = {
  campaign?: { id?: string; name?: string; status?: string }
  segments?: { date?: string }
  customer?: { currencyCode?: string }
  metrics?: {
    impressions?: string
    clicks?: string
    costMicros?: string
    conversions?: number
    conversionsValue?: number
  }
}

type AnalyticsPayload = {
  rows?: Array<{ metricValues?: Array<{ value?: string }> }>
  totals?: Array<{ metricValues?: Array<{ value?: string }> }>
  error?: { message?: string }
}

function dayKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}

function campaignKey(value: string | null | undefined) {
  return String(value || '').trim().toLocaleLowerCase('es')
}

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
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
    if (!connection?.refreshTokenEncrypted) {
      return NextResponse.json({ error: 'Conecta una cuenta de Google antes de sincronizar.' }, { status: 409 })
    }

    const refreshed = await refreshGoogleMarketingAccessToken(connection.refreshTokenEncrypted)
    const accessToken = String(refreshed.access_token)
    const warnings: string[] = []
    let adsRows: AdsResult[] = []
    let analyticsSnapshot: Record<string, unknown> | null = null

    if (connection.googleAdsCustomerId && connection.scopes.includes(getGoogleMarketingProductScope('ADS'))) {
      const developerToken = String(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '').trim()
      const apiVersion = String(process.env.GOOGLE_ADS_API_VERSION || 'v20').trim()
      if (!developerToken) {
        warnings.push('Falta GOOGLE_ADS_DEVELOPER_TOKEN; Google Ads no fue sincronizado.')
      } else {
        const response = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${connection.googleAdsCustomerId}/googleAds:searchStream`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'developer-token': developerToken,
            ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { 'login-customer-id': String(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '') } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: 'SELECT segments.date, customer.currency_code, campaign.id, campaign.name, campaign.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date DURING LAST_30_DAYS',
          }),
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => null)) as Array<{ results?: AdsResult[] }> | { error?: { message?: string } } | null
        if (!response.ok) {
          const message = payload && !Array.isArray(payload) ? payload.error?.message : null
          throw new Error(message || 'Google Ads rechazó la sincronización.')
        }
        adsRows = Array.isArray(payload) ? payload.flatMap((batch) => batch.results || []) : []
      }
    }

    if (connection.googleAnalyticsPropertyId && connection.scopes.includes(getGoogleMarketingProductScope('ANALYTICS'))) {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${connection.googleAnalyticsPropertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }, { name: 'purchaseRevenue' }],
        }),
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => ({}))) as AnalyticsPayload
      if (!response.ok) throw new Error(payload.error?.message || 'Google Analytics rechazó la sincronización.')
      const values = payload.totals?.[0]?.metricValues || payload.rows?.[0]?.metricValues || []
      analyticsSnapshot = {
        period: 'LAST_30_DAYS',
        sessions: numberValue(values[0]?.value),
        totalUsers: numberValue(values[1]?.value),
        keyEvents: numberValue(values[2]?.value),
        purchaseRevenue: numberValue(values[3]?.value),
        syncedAt: new Date().toISOString(),
      }
    }

    if (adsRows.length) {
      const captures = await prisma.crmLeadCapture.findMany({
        where: {
          empresaId: access.empresaId,
          createdAt: { gte: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) },
          OR: [{ utmCampaign: { not: null } }, { gclid: { not: null } }],
        },
        select: {
          createdAt: true,
          utmCampaign: true,
          leadId: true,
          lead: {
            select: {
              status: true,
              opportunities: { select: { stage: true, expectedValue: true, cotizacionId: true } },
            },
          },
        },
      })
      const attribution = new Map<string, typeof captures>()
      for (const capture of captures) {
        if (!capture.utmCampaign) continue
        const key = `${dayKey(capture.createdAt)}|${campaignKey(capture.utmCampaign)}`
        attribution.set(key, [...(attribution.get(key) || []), capture])
      }

      await prisma.$transaction(adsRows.map((row) => {
        const campaignId = String(row.campaign?.id || '')
        const campaignName = String(row.campaign?.name || campaignId)
        const metricDate = String(row.segments?.date || '')
        const related = attribution.get(`${metricDate}|${campaignKey(campaignName)}`) || attribution.get(`${metricDate}|${campaignKey(campaignId)}`) || []
        const uniqueLeads = new Map(related.filter((item) => item.leadId).map((item) => [item.leadId, item]))
        const leads = [...uniqueLeads.values()]
        const opportunities = leads.flatMap((item) => item.lead?.opportunities || [])
        const won = opportunities.filter((item) => item.stage === 'WON')
        return prisma.crmAdCampaignDailyMetric.upsert({
          where: { connectionId_metricDate_campaignId: { connectionId: connection.id, metricDate: new Date(`${metricDate}T00:00:00.000Z`), campaignId } },
          update: {
            campaignName,
            campaignStatus: row.campaign?.status || null,
            currencyCode: row.customer?.currencyCode || null,
            impressions: Math.round(numberValue(row.metrics?.impressions)),
            clicks: Math.round(numberValue(row.metrics?.clicks)),
            cost: numberValue(row.metrics?.costMicros) / 1_000_000,
            conversions: numberValue(row.metrics?.conversions),
            conversionValue: numberValue(row.metrics?.conversionsValue),
            crmLeads: leads.length,
            qualifiedLeads: leads.filter((item) => item.lead?.status === 'QUALIFIED').length,
            opportunities: opportunities.length,
            quotes: opportunities.filter((item) => item.cotizacionId).length,
            sales: won.length,
            crmRevenue: won.reduce((sum, item) => sum + item.expectedValue, 0),
            rawJson: row as Prisma.InputJsonValue,
          },
          create: {
            empresaId: access.empresaId,
            connectionId: connection.id,
            metricDate: new Date(`${metricDate}T00:00:00.000Z`),
            campaignId,
            campaignName,
            campaignStatus: row.campaign?.status || null,
            currencyCode: row.customer?.currencyCode || null,
            impressions: Math.round(numberValue(row.metrics?.impressions)),
            clicks: Math.round(numberValue(row.metrics?.clicks)),
            cost: numberValue(row.metrics?.costMicros) / 1_000_000,
            conversions: numberValue(row.metrics?.conversions),
            conversionValue: numberValue(row.metrics?.conversionsValue),
            crmLeads: leads.length,
            qualifiedLeads: leads.filter((item) => item.lead?.status === 'QUALIFIED').length,
            opportunities: opportunities.length,
            quotes: opportunities.filter((item) => item.cotizacionId).length,
            sales: won.length,
            crmRevenue: won.reduce((sum, item) => sum + item.expectedValue, 0),
            rawJson: row as Prisma.InputJsonValue,
          },
        })
      }))
    }

    await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: encryptGoogleMarketingToken(accessToken),
        tokenExpiresAt: typeof refreshed.expires_in === 'number' ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
        settingsJson: {
          ...parseJsonObject(connection.settingsJson),
          ...(analyticsSnapshot ? { analyticsSnapshot } : {}),
        } as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: warnings.join(' ') || null,
      },
    })

    return NextResponse.json({ success: true, data: { adsRows: adsRows.length, analytics: analyticsSnapshot, warnings } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar Google Marketing.'
    console.error('Error sincronizando Google Marketing:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
