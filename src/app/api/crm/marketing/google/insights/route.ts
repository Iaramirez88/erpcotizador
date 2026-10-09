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
  dailyBudget: number
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

type EntitySummary = {
  id: string
  name: string
  status: string | null
  campaignId: string
  campaignName: string
  adGroupId: string | null
  adGroupName: string | null
  keywordText: string | null
  matchType: string | null
  impressions: number
  clicks: number
  cost: number
  conversions: number
  conversionValue: number
  crmLeads: number
  qualifiedLeads: number
  opportunities: number
  sales: number
  crmRevenue: number
}

type FunnelOpportunity = { stage: string; expectedValue: number; cotizacionId: string | null; cotizacion: { total: number; ventaRealizadaAt: Date | null; posInvoice: { total: number; status: string } | null } | null }

function funnelSaleValue(opportunity: FunnelOpportunity) {
  if (opportunity.cotizacion?.posInvoice?.status === 'PAID' || opportunity.cotizacion?.posInvoice?.status === 'PARTIALLY_REFUNDED') return opportunity.cotizacion.posInvoice.total
  if (opportunity.cotizacion?.ventaRealizadaAt) return opportunity.cotizacion.total
  return opportunity.stage === 'WON' && !opportunity.cotizacionId ? opportunity.expectedValue : 0
}

function summarizeEntities(rows: Awaited<ReturnType<typeof prisma.crmAdEntityDailyMetric.findMany>>) {
  const summaries = new Map<string, EntitySummary>()
  for (const row of rows) {
    const current = summaries.get(row.entityId) || { id: row.entityId, name: row.entityName, status: row.entityStatus, campaignId: row.campaignId, campaignName: row.campaignName, adGroupId: row.adGroupId, adGroupName: row.adGroupName, keywordText: row.keywordText, matchType: row.matchType, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0, crmLeads: 0, qualifiedLeads: 0, opportunities: 0, sales: 0, crmRevenue: 0 }
    current.impressions += row.impressions
    current.clicks += row.clicks
    current.cost += row.cost
    current.conversions += row.conversions
    current.conversionValue += row.conversionValue
    current.crmLeads += row.crmLeads
    current.qualifiedLeads += row.qualifiedLeads
    current.opportunities += row.opportunities
    current.sales += row.sales
    current.crmRevenue += row.crmRevenue
    summaries.set(row.entityId, current)
  }
  return [...summaries.values()].map((item) => ({ ...item, ctr: item.impressions ? item.clicks / item.impressions : 0, cpa: item.conversions ? item.cost / item.conversions : 0, crmRoas: item.cost ? item.crmRevenue / item.cost : 0 })).sort((left, right) => right.cost - left.cost)
}

function parseDateRange(request: Request) {
  const params = new URL(request.url).searchParams
  const toValue = params.get('to') || new Date().toISOString().slice(0, 10)
  const defaultFrom = new Date(`${toValue}T00:00:00.000Z`)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
  const fromValue = params.get('from') || defaultFrom.toISOString().slice(0, 10)
  const from = new Date(`${fromValue}T00:00:00.000Z`)
  const to = new Date(`${toValue}T23:59:59.999Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) return null
  return { from, to, fromValue, toValue }
}

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({ domain: 'CAPTACION', subdomain: 'CHANNELS', action: 'READ', scope: 'SEDE' })
    if (!access.ok) return access.response

    const connection = await prisma.crmMarketingConnection.findFirst({
      where: { empresaId: access.empresaId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, googleAdsCustomerId: true, googleAnalyticsPropertyId: true, searchConsoleSiteUrl: true, scopes: true, settingsJson: true, lastSyncAt: true },
    })
    if (!connection) return NextResponse.json({ error: 'No hay una conexión activa de Google Marketing.' }, { status: 404 })

    const range = parseDateRange(request)
    if (!range) return NextResponse.json({ error: 'El rango debe ser válido y no superar 366 días.' }, { status: 400 })
    const [rows, entityRows, captures] = await Promise.all([
      prisma.crmAdCampaignDailyMetric.findMany({ where: { empresaId: access.empresaId, connectionId: connection.id, metricDate: { gte: range.from, lte: range.to } }, orderBy: [{ metricDate: 'desc' }, { campaignName: 'asc' }] }),
      prisma.crmAdEntityDailyMetric.findMany({ where: { empresaId: access.empresaId, connectionId: connection.id, metricDate: { gte: range.from, lte: range.to } }, orderBy: [{ metricDate: 'desc' }, { cost: 'desc' }] }),
      prisma.crmLeadCapture.findMany({
        where: { empresaId: access.empresaId, createdAt: { gte: range.from, lte: range.to }, OR: [{ utmSource: { equals: 'google', mode: 'insensitive' } }, { gclid: { not: null } }] },
        orderBy: { createdAt: 'desc' }, take: 500,
        select: { id: true, createdAt: true, captureType: true, utmCampaign: true, utmContent: true, utmTerm: true, gclid: true, lead: { select: { id: true, nombre: true, status: true, convertedCliente: { select: { id: true, nombre: true } }, opportunities: { select: { id: true, stage: true, expectedValue: true, cotizacionId: true, cotizacion: { select: { total: true, ventaRealizadaAt: true, posInvoice: { select: { total: true, status: true } } } } } } } } },
      }),
    ])
    const settings = parseJsonObject(connection.settingsJson)
    const inventory = parseJsonObject(settings.adsInventorySnapshot)
    const inventoryCampaigns = Array.isArray(inventory.campaigns) ? inventory.campaigns as Array<{ campaign?: { id?: string; name?: string; status?: string } }> : []
    const campaignMap = new Map<string, CampaignSummary>()
    for (const row of inventoryCampaigns) {
      const id = String(row.campaign?.id || '')
      if (!id) continue
      campaignMap.set(id, { id, name: row.campaign?.name || id, status: row.campaign?.status || null, currencyCode: null, dailyBudget: 0, impressions: 0, clicks: 0, cost: 0, conversions: 0, conversionValue: 0, crmLeads: 0, qualifiedLeads: 0, sales: 0, crmRevenue: 0 })
    }
    for (const row of rows) {
      const current = campaignMap.get(row.campaignId) || {
        id: row.campaignId,
        name: row.campaignName,
        status: row.campaignStatus,
        currencyCode: row.currencyCode,
        dailyBudget: row.dailyBudget,
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
      if (!current.dailyBudget) current.dailyBudget = row.dailyBudget
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
    const funnel = captures.map((capture) => {
      const sales = capture.lead?.opportunities.map((opportunity) => funnelSaleValue(opportunity)).filter((value) => value > 0) || []
      return { id: capture.id, capturedAt: capture.createdAt, channel: capture.captureType, campaign: capture.utmCampaign, ad: capture.utmContent, keyword: capture.utmTerm, gclid: capture.gclid, lead: capture.lead ? { id: capture.lead.id, name: capture.lead.nombre, status: capture.lead.status } : null, client: capture.lead?.convertedCliente || null, sales: sales.length, revenue: sales.reduce((sum, value) => sum + value, 0) }
    })
    return NextResponse.json({ success: true, data: {
      lastSyncAt: connection.lastSyncAt,
      range: { from: range.fromValue, to: range.toValue },
      ads: { connected: Boolean(connection.googleAdsCustomerId), customerId: connection.googleAdsCustomerId, campaigns, adGroups: summarizeEntities(entityRows.filter((row) => row.entityType === 'AD_GROUP')), ads: summarizeEntities(entityRows.filter((row) => row.entityType === 'AD')), keywords: summarizeEntities(entityRows.filter((row) => row.entityType === 'KEYWORD')), funnel, dailyRows: rows.length },
      analytics: { connected: Boolean(connection.googleAnalyticsPropertyId), propertyId: connection.googleAnalyticsPropertyId, snapshot: parseJsonObject(settings.analyticsSnapshot) },
      searchConsole: { connected: Boolean(connection.searchConsoleSiteUrl), propertyUrl: connection.searchConsoleSiteUrl, snapshot: parseJsonObject(settings.searchConsoleSnapshot) },
    } })
  } catch (error) {
    console.error('Error cargando detalle de Google Marketing:', error)
    return NextResponse.json({ error: 'No se pudo cargar el detalle de Google Marketing.' }, { status: 500 })
  }
}