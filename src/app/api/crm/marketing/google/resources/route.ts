import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { encryptGoogleMarketingToken, getGoogleMarketingProductScope, refreshGoogleMarketingAccessToken } from '@/lib/crm-google-marketing'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type GoogleErrorPayload = { error?: { message?: string } }
type AdsCustomer = { id: string; name: string; manager: boolean; currencyCode?: string | null; warning?: string }
type AnalyticsProperty = { id: string; name: string; accountName: string }
type SearchConsoleSite = { siteUrl: string; permissionLevel?: string | null }

async function responsePayload<T>(response: Response, fallback: string) {
  const payload = await response.json().catch(() => ({})) as T & GoogleErrorPayload
  if (!response.ok) throw new Error(payload.error?.message || fallback)
  return payload
}

async function discoverAds(accessToken: string): Promise<AdsCustomer[]> {
  const apiVersion = String(process.env.GOOGLE_ADS_API_VERSION || 'v25').trim()
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? { 'login-customer-id': String(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID).replace(/\D/g, '') } : {}),
  }
  const listResponse = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers:listAccessibleCustomers`, {
    headers,
    cache: 'no-store',
  })
  const list = await responsePayload<{ resourceNames?: string[] }>(listResponse, 'Google Ads no permitió consultar las cuentas accesibles.')
  return Promise.all((list.resourceNames || []).slice(0, 100).map(async (resourceName) => {
    const id = resourceName.replace(/^customers\//, '')
    try {
      const detailResponse = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${id}/googleAds:search`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager, customer.status FROM customer LIMIT 1' }),
        cache: 'no-store',
      })
      const detail = await responsePayload<{ results?: Array<{ customer?: { descriptiveName?: string; currencyCode?: string; manager?: boolean } }> }>(detailResponse, 'No se pudo leer el detalle de la cuenta.')
      const customer = detail.results?.[0]?.customer
      return { id, name: customer?.descriptiveName || `Cuenta ${id}`, manager: Boolean(customer?.manager), currencyCode: customer?.currencyCode || null }
    } catch (error) {
      return { id, name: `Cuenta ${id}`, manager: false, currencyCode: null, warning: error instanceof Error ? error.message : 'No se pudo consultar el detalle.' }
    }
  }))
}

async function discoverAnalytics(accessToken: string): Promise<AnalyticsProperty[]> {
  const response = await fetch('https://analyticsadmin.googleapis.com/v1alpha/accountSummaries?pageSize=200', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const payload = await responsePayload<{ accountSummaries?: Array<{ displayName?: string; propertySummaries?: Array<{ property?: string; displayName?: string }> }> }>(response, 'Google Analytics no permitió consultar las propiedades.')
  return (payload.accountSummaries || []).flatMap((account) => (account.propertySummaries || []).map((property) => ({
    id: String(property.property || '').replace(/^properties\//, ''),
    name: property.displayName || property.property || 'Propiedad sin nombre',
    accountName: account.displayName || 'Google Analytics',
  }))).filter((property) => property.id)
}

async function discoverSearchConsole(accessToken: string): Promise<SearchConsoleSite[]> {
  const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  const payload = await responsePayload<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>(response, 'Search Console no permitió consultar las propiedades.')
  return (payload.siteEntry || []).filter((site): site is { siteUrl: string; permissionLevel?: string } => Boolean(site.siteUrl)).map((site) => ({ siteUrl: site.siteUrl, permissionLevel: site.permissionLevel || null }))
}

export async function POST() {
  try {
    const access = await requireCapabilityAccess({ domain: 'CAPTACION', subdomain: 'CHANNELS', action: 'CONFIGURE', scope: 'SEDE' })
    if (!access.ok) return access.response
    const connection = await prisma.crmMarketingConnection.findFirst({
      where: { empresaId: access.empresaId, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    })
    if (!connection?.refreshTokenEncrypted) return NextResponse.json({ error: 'Conecta una cuenta de Google antes de buscar recursos.' }, { status: 409 })

    const refreshed = await refreshGoogleMarketingAccessToken(connection.refreshTokenEncrypted)
    const accessToken = String(refreshed.access_token)
    const warnings: string[] = []
    let ads: AdsCustomer[] = []
    let analytics: AnalyticsProperty[] = []
    let searchConsole: SearchConsoleSite[] = []
    const tasks: Promise<void>[] = []
    if (connection.scopes.includes(getGoogleMarketingProductScope('ADS'))) tasks.push(discoverAds(accessToken).then((items) => {
      ads = items
      const detailWarning = items.find((item) => item.warning)?.warning
      if (detailWarning) warnings.push(`Google Ads: ${detailWarning}`)
    }).catch((error) => { warnings.push(`Google Ads: ${error instanceof Error ? error.message : 'No disponible.'}`) }))
    if (connection.scopes.includes(getGoogleMarketingProductScope('ANALYTICS'))) tasks.push(discoverAnalytics(accessToken).then((items) => { analytics = items }).catch((error) => { warnings.push(`Google Analytics: ${error instanceof Error ? error.message : 'No disponible.'}`) }))
    if (connection.scopes.includes(getGoogleMarketingProductScope('SEARCH_CONSOLE'))) tasks.push(discoverSearchConsole(accessToken).then((items) => { searchConsole = items }).catch((error) => { warnings.push(`Search Console: ${error instanceof Error ? error.message : 'No disponible.'}`) }))
    await Promise.all(tasks)

    const googleAdsCustomerId = connection.googleAdsCustomerId || (ads.length === 1 ? ads[0].id : null)
    const googleAnalyticsPropertyId = connection.googleAnalyticsPropertyId || (analytics.length === 1 ? analytics[0].id : null)
    const searchConsoleSiteUrl = connection.searchConsoleSiteUrl || (searchConsole.length === 1 ? searchConsole[0].siteUrl : null)
    await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: {
        googleAdsCustomerId,
        googleAnalyticsPropertyId,
        searchConsoleSiteUrl,
        accessTokenEncrypted: encryptGoogleMarketingToken(accessToken),
        tokenExpiresAt: typeof refreshed.expires_in === 'number' ? new Date(Date.now() + refreshed.expires_in * 1000) : null,
      },
    })

    return NextResponse.json({ success: true, data: {
      ads,
      analytics,
      searchConsole,
      selected: { googleAdsCustomerId, googleAnalyticsPropertyId, searchConsoleSiteUrl },
      warnings,
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron consultar las cuentas de Google.'
    console.error('Error descubriendo recursos de Google Marketing:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}