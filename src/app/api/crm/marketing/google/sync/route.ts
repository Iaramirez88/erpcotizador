import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertGoogleAdsCustomerSeparation, encryptGoogleMarketingToken, getGoogleAdsApiVersion, getGoogleAdsConnectionConfig, getGoogleAdsRequestHeaders, getGoogleMarketingProductScope, refreshGoogleMarketingAccessToken } from '@/lib/crm-google-marketing'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type AdsResult = {
  campaign?: { id?: string; name?: string; status?: string }
  campaignBudget?: { amountMicros?: string }
  adGroup?: { id?: string; name?: string; status?: string }
  adGroupAd?: { status?: string; ad?: { id?: string; name?: string } }
  adGroupCriterion?: { criterionId?: string; status?: string; keyword?: { text?: string; matchType?: string } }
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

type AdsQueryDiagnostic = {
  customerId: string
  loginCustomerId: string | null
  query: string
  httpStatus: number
  requestId: string | null
  batches: number
  rows: number
}

type AnalyticsPayload = {
  rows?: Array<{ metricValues?: Array<{ value?: string }> }>
  totals?: Array<{ metricValues?: Array<{ value?: string }> }>
  error?: { message?: string }
}

type AnalyticsReportPayload = {
  rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>
  error?: { message?: string }
}

type SearchConsoleRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }
type AttributedOpportunity = { stage: string; expectedValue: number; cotizacionId: string | null; cotizacion: { total: number; ventaRealizadaAt: Date | null; posInvoice: { total: number; status: string } | null } | null }

type GoogleApiError = { error?: { code?: number; message?: string; status?: string; details?: Array<{ errors?: Array<{ errorCode?: Record<string, string> }>; requestId?: string }> } }

function googleApiErrorMessage(payload: unknown, response: Response, context?: { googleEmail?: string | null; loginCustomerId?: string }) {
  const candidates = Array.isArray(payload) ? payload : [payload]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const error = (candidate as GoogleApiError).error
    if (error?.message) {
      const failures = error.details?.flatMap((detail) => detail.errors || []) || []
      const codes = failures.flatMap((failure) => Object.entries(failure.errorCode || {}).map(([group, code]) => `${group}.${code}`))
      const diagnostic = codes.length ? ` Código: ${[...new Set(codes)].join(', ')}.` : ''
      if (/does not have permission|permission_denied|insufficient permission/i.test(error.message)) {
        const identity = context?.googleEmail || 'La cuenta Google conectada'
        const target = context?.loginCustomerId ? ` al MCC ${context.loginCustomerId}` : ' a la cuenta operativa'
        const requestId = response.headers.get('request-id')
        return `${identity} no tiene permiso API${target}. Verifica el correo en Administrador > Acceso y seguridad > Usuarios dentro de esa cuenta.${diagnostic}${requestId ? ` Request ID: ${requestId}.` : ''}`
      }
      return `${error.message}${error.status ? ` (${error.status})` : ''}${diagnostic}`
    }
  }
  return `Google Ads respondió ${response.status} ${response.statusText || 'sin detalle'}.`
}

function dayKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10)
}

function campaignKey(value: string | null | undefined) {
  return String(value || '').trim().toLocaleLowerCase('es')
}

function attributionTokens(value: string | null | undefined) {
  const normalized = campaignKey(value)
  return new Set([normalized, ...normalized.split(/[^\p{L}\p{N}]+/u)].filter(Boolean))
}

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function isRealizedSale(opportunity: AttributedOpportunity) {
  return opportunity.cotizacion?.posInvoice?.status === 'PAID' || opportunity.cotizacion?.posInvoice?.status === 'PARTIALLY_REFUNDED' || Boolean(opportunity.cotizacion?.ventaRealizadaAt) || (opportunity.stage === 'WON' && !opportunity.cotizacionId)
}

function realizedSaleValue(opportunity: AttributedOpportunity) {
  if (opportunity.cotizacion?.posInvoice?.status === 'PAID' || opportunity.cotizacion?.posInvoice?.status === 'PARTIALLY_REFUNDED') return opportunity.cotizacion.posInvoice.total
  if (opportunity.cotizacion?.ventaRealizadaAt) return opportunity.cotizacion.total
  return opportunity.stage === 'WON' && !opportunity.cotizacionId ? opportunity.expectedValue : 0
}

function parseDateRange(request: Request) {
  const bodyUrl = new URL(request.url)
  const toValue = bodyUrl.searchParams.get('to') || new Date().toISOString().slice(0, 10)
  const defaultFrom = new Date(`${toValue}T00:00:00.000Z`)
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29)
  const fromValue = bodyUrl.searchParams.get('from') || defaultFrom.toISOString().slice(0, 10)
  const from = new Date(`${fromValue}T00:00:00.000Z`)
  const to = new Date(`${toValue}T23:59:59.999Z`)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to || to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) return null
  return { from, to, fromValue, toValue }
}

async function fetchAnalyticsReport(accessToken: string, propertyId: string, dimensions: string[], metrics: string[], startDate: string, endDate: string, limit = 100) {
  const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ dateRanges: [{ startDate, endDate }], dimensions: dimensions.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), limit }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as AnalyticsReportPayload
  if (!response.ok) throw new Error(payload.error?.message || 'Google Analytics rechazó el informe detallado.')
  return (payload.rows || []).map((row) => ({
    dimensions: Object.fromEntries(dimensions.map((name, index) => [name, row.dimensionValues?.[index]?.value || ''])),
    metrics: Object.fromEntries(metrics.map((name, index) => [name, numberValue(row.metricValues?.[index]?.value)])),
  }))
}

async function fetchSearchConsoleReport(accessToken: string, propertyUrl: string, startDate: string, endDate: string, dimension: string) {
  const response = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, dimensions: [dimension], rowLimit: 250 }),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as { rows?: SearchConsoleRow[]; error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message || `Search Console rechazó el informe por ${dimension}.`)
  return (payload.rows || []).map((row) => ({
    value: row.keys?.[0] || '',
    clicks: numberValue(row.clicks),
    impressions: numberValue(row.impressions),
    ctr: numberValue(row.ctr),
    position: numberValue(row.position),
  }))
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const range = parseDateRange(request)
    if (!range) return NextResponse.json({ error: 'El rango debe ser válido y no superar 366 días.' }, { status: 400 })

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
    let adsInventoryRows: AdsResult[] = []
    const adsEntityRows: Array<AdsResult & { entityType: 'AD_GROUP' | 'AD' | 'KEYWORD' }> = []
    const adsDiagnostics: AdsQueryDiagnostic[] = []
    const adsPersistence = { received: 0, inserted: 0, updated: 0 }
    let analyticsSnapshot: Record<string, unknown> | null = null
    let searchConsoleSnapshot: Record<string, unknown> | null = null

    if (connection.googleAdsCustomerId && connection.scopes.includes(getGoogleMarketingProductScope('ADS'))) {
      try {
        const apiVersion = getGoogleAdsApiVersion()
        const adsConfig = getGoogleAdsConnectionConfig(parseJsonObject(connection.settingsJson))
        if (adsConfig.mode === 'MCC' && !adsConfig.loginCustomerId) throw new Error('La conexión MCC no tiene un Customer ID de administrador configurado.')
        const operatingCustomerId = assertGoogleAdsCustomerSeparation(connection.googleAdsCustomerId, adsConfig.loginCustomerId)
        const inventoryQuery = "SELECT campaign.id, campaign.name, campaign.status FROM campaign WHERE campaign.status != 'REMOVED'"
        const inventoryResponse = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${operatingCustomerId}/googleAds:searchStream`, {
          method: 'POST',
          headers: getGoogleAdsRequestHeaders(accessToken, adsConfig.loginCustomerId, true),
          body: JSON.stringify({ query: inventoryQuery }),
          cache: 'no-store',
        })
        const inventoryPayload = (await inventoryResponse.json().catch(() => null)) as Array<{ results?: AdsResult[]; error?: { message?: string } }> | GoogleApiError | null
        const adsErrorContext = { googleEmail: connection.googleEmail, loginCustomerId: adsConfig.loginCustomerId }
        if (!inventoryResponse.ok) throw new Error(googleApiErrorMessage(inventoryPayload, inventoryResponse, adsErrorContext))
        adsInventoryRows = Array.isArray(inventoryPayload) ? inventoryPayload.flatMap((batch) => batch.results || []) : []
        const inventoryDiagnostic = {
          customerId: operatingCustomerId,
          loginCustomerId: adsConfig.loginCustomerId || null,
          query: inventoryQuery,
          httpStatus: inventoryResponse.status,
          requestId: inventoryResponse.headers.get('request-id'),
          batches: Array.isArray(inventoryPayload) ? inventoryPayload.length : 0,
          rows: adsInventoryRows.length,
        }
        adsDiagnostics.push(inventoryDiagnostic)
        console.info('Google Ads inventory diagnostic', { ...inventoryDiagnostic, results: adsInventoryRows })

        const dateFilter = `segments.date BETWEEN '${range.fromValue}' AND '${range.toValue}'`
        const metricsQuery = `SELECT segments.date, customer.currency_code, campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE ${dateFilter}`
        const response = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${operatingCustomerId}/googleAds:searchStream`, {
          method: 'POST',
          headers: getGoogleAdsRequestHeaders(accessToken, adsConfig.loginCustomerId, true),
          body: JSON.stringify({ query: metricsQuery }),
          cache: 'no-store',
        })
        const payload = (await response.json().catch(() => null)) as Array<{ results?: AdsResult[]; error?: { message?: string } }> | GoogleApiError | null
        if (!response.ok) throw new Error(googleApiErrorMessage(payload, response, adsErrorContext))
        const embeddedError = googleApiErrorMessage(payload, response, adsErrorContext)
        if (Array.isArray(payload) && payload.some((batch) => batch.error)) throw new Error(embeddedError)
        adsRows = Array.isArray(payload) ? payload.flatMap((batch) => batch.results || []) : []
        const metricsDiagnostic = {
          customerId: operatingCustomerId,
          loginCustomerId: adsConfig.loginCustomerId || null,
          query: metricsQuery,
          httpStatus: response.status,
          requestId: response.headers.get('request-id'),
          batches: Array.isArray(payload) ? payload.length : 0,
          rows: adsRows.length,
        }
        adsDiagnostics.push(metricsDiagnostic)
        console.info('Google Ads metrics diagnostic', { ...metricsDiagnostic, results: adsRows })

        const entityQueries: Array<{ entityType: 'AD_GROUP' | 'AD' | 'KEYWORD'; query: string }> = [
          { entityType: 'AD_GROUP', query: `SELECT segments.date, customer.currency_code, campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ad_group WHERE ${dateFilter}` },
          { entityType: 'AD', query: `SELECT segments.date, customer.currency_code, campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ad_group_ad WHERE ${dateFilter}` },
          { entityType: 'KEYWORD', query: `SELECT segments.date, customer.currency_code, campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE ${dateFilter}` },
        ]
        for (const entityQuery of entityQueries) {
          const entityResponse = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${operatingCustomerId}/googleAds:searchStream`, {
            method: 'POST',
            headers: getGoogleAdsRequestHeaders(accessToken, adsConfig.loginCustomerId, true),
            body: JSON.stringify({ query: entityQuery.query }),
            cache: 'no-store',
          })
          const entityPayload = (await entityResponse.json().catch(() => null)) as Array<{ results?: AdsResult[]; error?: { message?: string } }> | GoogleApiError | null
          if (!entityResponse.ok) throw new Error(googleApiErrorMessage(entityPayload, entityResponse, adsErrorContext))
          const entityResults = Array.isArray(entityPayload) ? entityPayload.flatMap((batch) => batch.results || []) : []
          adsEntityRows.push(...entityResults.map((row) => ({ ...row, entityType: entityQuery.entityType })))
          adsDiagnostics.push({ customerId: operatingCustomerId, loginCustomerId: adsConfig.loginCustomerId || null, query: entityQuery.query, httpStatus: entityResponse.status, requestId: entityResponse.headers.get('request-id'), batches: Array.isArray(entityPayload) ? entityPayload.length : 0, rows: entityResults.length })
        }
      } catch (error) {
        warnings.push(`Google Ads: ${error instanceof Error ? error.message : 'No se pudo consultar la cuenta seleccionada.'}`)
      }
    }

    if (connection.googleAnalyticsPropertyId && connection.scopes.includes(getGoogleMarketingProductScope('ANALYTICS'))) {
      try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${connection.googleAnalyticsPropertyId}:runReport`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: range.fromValue, endDate: range.toValue }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }, { name: 'purchaseRevenue' }],
        }),
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => ({}))) as AnalyticsPayload
      if (!response.ok) throw new Error(payload.error?.message || 'Google Analytics rechazó la sincronización.')
      const values = payload.totals?.[0]?.metricValues || payload.rows?.[0]?.metricValues || []
      const [channels, pages, events, devices, countries] = await Promise.all([
        fetchAnalyticsReport(accessToken, connection.googleAnalyticsPropertyId, ['sessionDefaultChannelGroup'], ['sessions', 'totalUsers', 'keyEvents', 'purchaseRevenue'], range.fromValue, range.toValue),
        fetchAnalyticsReport(accessToken, connection.googleAnalyticsPropertyId, ['pagePath'], ['screenPageViews', 'totalUsers', 'averageSessionDuration', 'keyEvents'], range.fromValue, range.toValue),
        fetchAnalyticsReport(accessToken, connection.googleAnalyticsPropertyId, ['eventName'], ['eventCount', 'totalUsers', 'keyEvents'], range.fromValue, range.toValue),
        fetchAnalyticsReport(accessToken, connection.googleAnalyticsPropertyId, ['deviceCategory'], ['sessions', 'totalUsers', 'keyEvents'], range.fromValue, range.toValue),
        fetchAnalyticsReport(accessToken, connection.googleAnalyticsPropertyId, ['country'], ['sessions', 'totalUsers', 'keyEvents'], range.fromValue, range.toValue),
      ])
      analyticsSnapshot = {
        period: { startDate: range.fromValue, endDate: range.toValue },
        sessions: numberValue(values[0]?.value),
        totalUsers: numberValue(values[1]?.value),
        keyEvents: numberValue(values[2]?.value),
        purchaseRevenue: numberValue(values[3]?.value),
        channels,
        pages,
        events,
        devices,
        countries,
        syncedAt: new Date().toISOString(),
      }
      } catch (error) {
        warnings.push(`Google Analytics: ${error instanceof Error ? error.message : 'No se pudieron consultar los informes detallados.'}`)
      }
    }

    if (connection.searchConsoleSiteUrl && connection.scopes.includes(getGoogleMarketingProductScope('SEARCH_CONSOLE'))) {
      try {
      const latestAvailable = new Date()
      latestAvailable.setUTCDate(latestAvailable.getUTCDate() - 2)
      const end = range.to < latestAvailable ? range.to : latestAvailable
      const start = range.from
      const startDate = dayKey(start)
      const endDate = dayKey(end)
      if (start > end) throw new Error('El rango aún no tiene datos disponibles; Search Console publica con aproximadamente dos días de retraso.')
      const [queries, pages, devices, countries] = await Promise.all([
        fetchSearchConsoleReport(accessToken, connection.searchConsoleSiteUrl, startDate, endDate, 'query'),
        fetchSearchConsoleReport(accessToken, connection.searchConsoleSiteUrl, startDate, endDate, 'page'),
        fetchSearchConsoleReport(accessToken, connection.searchConsoleSiteUrl, startDate, endDate, 'device'),
        fetchSearchConsoleReport(accessToken, connection.searchConsoleSiteUrl, startDate, endDate, 'country'),
      ])
      searchConsoleSnapshot = { period: { startDate, endDate }, queries, pages, devices, countries, syncedAt: new Date().toISOString() }
      } catch (error) {
        warnings.push(`Search Console: ${error instanceof Error ? error.message : 'No se pudieron consultar los informes detallados.'}`)
      }
    }

    if (adsRows.length) {
      adsPersistence.received = adsRows.length
      const campaignIds = [...new Set(adsRows.map((row) => String(row.campaign?.id || '')).filter(Boolean))]
      const existingMetrics = await prisma.crmAdCampaignDailyMetric.findMany({
        where: { connectionId: connection.id, campaignId: { in: campaignIds }, metricDate: { gte: range.from, lte: range.to } },
        select: { campaignId: true, metricDate: true },
      })
      const existingKeys = new Set(existingMetrics.map((row) => `${dayKey(row.metricDate)}|${row.campaignId}`))
      for (const row of adsRows) {
        const key = `${String(row.segments?.date || '')}|${String(row.campaign?.id || '')}`
        if (existingKeys.has(key)) adsPersistence.updated += 1
        else adsPersistence.inserted += 1
      }
      const captures = await prisma.crmLeadCapture.findMany({
        where: {
          empresaId: access.empresaId,
          createdAt: { gte: range.from, lte: range.to },
          OR: [{ utmCampaign: { not: null } }, { gclid: { not: null } }],
        },
        select: {
          createdAt: true,
          utmCampaign: true,
          utmContent: true,
          utmTerm: true,
          leadId: true,
          lead: {
            select: {
              status: true,
              opportunities: { select: { stage: true, expectedValue: true, cotizacionId: true, cotizacion: { select: { total: true, ventaRealizadaAt: true, posInvoice: { select: { total: true, status: true } } } } } },
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
        const won = opportunities.filter(isRealizedSale)
        return prisma.crmAdCampaignDailyMetric.upsert({
          where: { connectionId_metricDate_campaignId: { connectionId: connection.id, metricDate: new Date(`${metricDate}T00:00:00.000Z`), campaignId } },
          update: {
            campaignName,
            campaignStatus: row.campaign?.status || null,
            currencyCode: row.customer?.currencyCode || null,
            dailyBudget: numberValue(row.campaignBudget?.amountMicros) / 1_000_000,
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
            crmRevenue: won.reduce((sum, item) => sum + realizedSaleValue(item), 0),
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
            dailyBudget: numberValue(row.campaignBudget?.amountMicros) / 1_000_000,
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
            crmRevenue: won.reduce((sum, item) => sum + realizedSaleValue(item), 0),
            rawJson: row as Prisma.InputJsonValue,
          },
        })
      }))

      const entityOperations = adsEntityRows.flatMap((row) => {
        const campaignId = String(row.campaign?.id || '')
        const campaignName = String(row.campaign?.name || campaignId)
        const metricDate = String(row.segments?.date || '')
        const adGroupId = String(row.adGroup?.id || '') || null
        const adGroupName = String(row.adGroup?.name || '') || null
        const entity = row.entityType === 'AD_GROUP'
          ? { id: adGroupId, name: adGroupName, status: row.adGroup?.status || null, attribution: row.adGroup }
          : row.entityType === 'AD'
            ? { id: String(row.adGroupAd?.ad?.id || '') || null, name: String(row.adGroupAd?.ad?.name || row.adGroupAd?.ad?.id || '') || null, status: row.adGroupAd?.status || null, attribution: row.adGroupAd?.ad }
            : { id: String(row.adGroupCriterion?.criterionId || '') || null, name: String(row.adGroupCriterion?.keyword?.text || '') || null, status: row.adGroupCriterion?.status || null, attribution: row.adGroupCriterion?.keyword }
        if (!entity.id || !entity.name || !metricDate || !campaignId) return []
        const campaignRelated = attribution.get(`${metricDate}|${campaignKey(campaignName)}`) || attribution.get(`${metricDate}|${campaignKey(campaignId)}`) || []
        const attributionValues = new Set([entity.id, entity.name].map(campaignKey))
        const related = campaignRelated.filter((capture) => [...attributionTokens(row.entityType === 'KEYWORD' ? capture.utmTerm : capture.utmContent)].some((value) => attributionValues.has(value)))
        const uniqueLeads = new Map(related.filter((item) => item.leadId).map((item) => [item.leadId, item]))
        const leads = [...uniqueLeads.values()]
        const opportunities = leads.flatMap((item) => item.lead?.opportunities || [])
        const won = opportunities.filter(isRealizedSale)
        return [prisma.crmAdEntityDailyMetric.upsert({
          where: { connectionId_metricDate_entityType_entityId: { connectionId: connection.id, metricDate: new Date(`${metricDate}T00:00:00.000Z`), entityType: row.entityType, entityId: entity.id } },
          update: {
            entityName: entity.name, entityStatus: entity.status, campaignId, campaignName, adGroupId, adGroupName,
            keywordText: row.adGroupCriterion?.keyword?.text || null, matchType: row.adGroupCriterion?.keyword?.matchType || null,
            currencyCode: row.customer?.currencyCode || null, impressions: Math.round(numberValue(row.metrics?.impressions)), clicks: Math.round(numberValue(row.metrics?.clicks)),
            cost: numberValue(row.metrics?.costMicros) / 1_000_000, conversions: numberValue(row.metrics?.conversions), conversionValue: numberValue(row.metrics?.conversionsValue),
            crmLeads: leads.length, qualifiedLeads: leads.filter((item) => item.lead?.status === 'QUALIFIED').length, opportunities: opportunities.length, sales: won.length,
            crmRevenue: won.reduce((sum, item) => sum + realizedSaleValue(item), 0), rawJson: row as Prisma.InputJsonValue,
          },
          create: {
            empresaId: access.empresaId, connectionId: connection.id, metricDate: new Date(`${metricDate}T00:00:00.000Z`), entityType: row.entityType, entityId: entity.id,
            entityName: entity.name, entityStatus: entity.status, campaignId, campaignName, adGroupId, adGroupName,
            keywordText: row.adGroupCriterion?.keyword?.text || null, matchType: row.adGroupCriterion?.keyword?.matchType || null,
            currencyCode: row.customer?.currencyCode || null, impressions: Math.round(numberValue(row.metrics?.impressions)), clicks: Math.round(numberValue(row.metrics?.clicks)),
            cost: numberValue(row.metrics?.costMicros) / 1_000_000, conversions: numberValue(row.metrics?.conversions), conversionValue: numberValue(row.metrics?.conversionsValue),
            crmLeads: leads.length, qualifiedLeads: leads.filter((item) => item.lead?.status === 'QUALIFIED').length, opportunities: opportunities.length, sales: won.length,
            crmRevenue: won.reduce((sum, item) => sum + realizedSaleValue(item), 0), rawJson: row as Prisma.InputJsonValue,
          },
        })]
      })
      if (entityOperations.length) await prisma.$transaction(entityOperations)
    }

    await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted: encryptGoogleMarketingToken(accessToken),
        tokenExpiresAt: typeof refreshed.expires_in === 'number' ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
        settingsJson: {
          ...parseJsonObject(connection.settingsJson),
          adsInventorySnapshot: { campaigns: adsInventoryRows, syncedAt: new Date().toISOString() },
          ...(analyticsSnapshot ? { analyticsSnapshot } : {}),
          ...(searchConsoleSnapshot ? { searchConsoleSnapshot } : {}),
        } as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: warnings.join(' ') || null,
      },
    })

    console.info('Google Ads persistence diagnostic', adsPersistence)
    return NextResponse.json({ success: true, data: { range: { from: range.fromValue, to: range.toValue }, adsCampaigns: adsInventoryRows.length, adsRows: adsRows.length, adsEntityRows: adsEntityRows.length, adsDiagnostics, adsPersistence, analytics: analyticsSnapshot, searchConsole: searchConsoleSnapshot, warnings } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar Google Marketing.'
    console.error('Error sincronizando Google Marketing:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
