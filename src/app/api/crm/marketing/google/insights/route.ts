import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type CampaignSummary = {
  id: string
  name: string
  status: string | null
  currencyCode: string | null
  impressions: number
  clicks: number
  cost: number
  conversions: number
  conversionValue: number
  crmLeads: number
  qualifiedLeads: number
  sales: number
  crmRevenue: number
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({ domain: 'CAPTACION', subdomain: 'CHANNELS', action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const connection = await prisma.crmMarketingConnection.findFirst({
      where: { empresaId: access.empresaId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, googleAdsCustomerId: true, googleAnalyticsPropertyId: true, searchConsoleSiteUrl: true, scopes: true, settingsJson: true, lastSyncAt: true },
    })
    if (!connection) return NextResponse.json({ error: 'No hay una conexión activa de Google Marketing.' }, { status: 404 })

    const from = new Date()
    from.setDate(from.getDate() - 30)
    const rows = await prisma.crmAdCampaignDailyMetric.findMany({
      where: { empresaId: access.empresaId, connectionId: connection.id, metricDate: { gte: from } },
      orderBy: [{ metricDate: 'desc' }, { campaignName: 'asc' }],
    })
    const settings = parseJsonObject(connection.settingsJson)
    const inventory = parseJsonObject(settings.adsInventorySnapshot)
    const inventoryCampaigns = Array.isArray(inventory.campaigns) ? inventory.campaigns as Array<{ campaign?: { id?: string; name?: string; status?: string } }> : []
    const campaignMap = new Map<string, CampaignSummary>()
    for (const row of inventoryCampaigns) {
      const id = String(row.campaign?.id || '')
      if (!id) continue
      campaignMap.set(id, { id, name: row.campaign?.name || id, status: row.campaign?.status || null, currencyCode: null, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0, crmLeads: 0, qualifiedLeads: 0, sales: 0, crmRevenue: 0 })
    }
    for (const row of rows) {
      const current = campaignMap.get(row.campaignId) || {
        id: row.campaignId,
        name: row.campaignName,
        status: row.campaignStatus,
        currencyCode: row.currencyCode,
        impressions: 0,
        clicks: 0,
        cost: 0,
        conversions: 0,
        conversionValue: 0,
        crmLeads: 0,
        qualifiedLeads: 0,
        sales: 0,
        crmRevenue: 0,
      }
      current.impressions += row.impressions
      current.clicks += row.clicks
      current.cost += row.cost
      current.conversions += row.conversions
      current.conversionValue += row.conversionValue
      current.crmLeads += row.crmLeads
      current.qualifiedLeads += row.qualifiedLeads
      current.sales += row.sales
      current.crmRevenue += row.crmRevenue
      campaignMap.set(row.campaignId, current)
    }
    const campaigns = [...campaignMap.values()].map((campaign) => ({
      ...campaign,
      ctr: campaign.impressions ? campaign.clicks / campaign.impressions : 0,
      cpa: campaign.conversions ? campaign.cost / campaign.conversions : 0,
      roas: campaign.cost ? campaign.conversionValue / campaign.cost : 0,
      crmRoas: campaign.cost ? campaign.crmRevenue / campaign.cost : 0,
    })).sort((left, right) => right.cost - left.cost)
    return NextResponse.json({ success: true, data: {
      lastSyncAt: connection.lastSyncAt,
      ads: { connected: Boolean(connection.googleAdsCustomerId), customerId: connection.googleAdsCustomerId, campaigns, dailyRows: rows.length },
      analytics: { connected: Boolean(connection.googleAnalyticsPropertyId), propertyId: connection.googleAnalyticsPropertyId, snapshot: parseJsonObject(settings.analyticsSnapshot) },
      searchConsole: { connected: Boolean(connection.searchConsoleSiteUrl), propertyUrl: connection.searchConsoleSiteUrl, snapshot: parseJsonObject(settings.searchConsoleSnapshot) },
    } })
  } catch (error) {
    console.error('Error cargando detalle de Google Marketing:', error)
    return NextResponse.json({ error: 'No se pudo cargar el detalle de Google Marketing.' }, { status: 500 })
  }
}