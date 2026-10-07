import { Prisma } from '@prisma/client'
import { encryptGoogleMarketingToken, getGoogleMarketingProductScope, refreshGoogleMarketingAccessToken } from '@/lib/crm-google-marketing'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

function isoDate(date: Date) { return date.toISOString().slice(0, 10) }

export async function syncWebsiteProjectSearchConsole(args: { empresaId: string; projectId: string }) {
  const [project, connection] = await Promise.all([
    prisma.websiteProject.findFirst({ where: { id: args.projectId, empresaId: args.empresaId }, select: { id: true, seoJson: true, seoKeywords: { where: { active: true } } } }),
    prisma.crmMarketingConnection.findFirst({ where: { empresaId: args.empresaId, status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' } }),
  ])
  if (!project) throw new Error('Sitio no encontrado.')
  if (!connection?.refreshTokenEncrypted || !connection.scopes.includes(getGoogleMarketingProductScope('SEARCH_CONSOLE'))) throw new Error('Search Console no está conectado para esta empresa.')
  const propertyUrl = String(parseJsonObject(project.seoJson).searchConsoleSiteUrl || '').trim()
  if (!propertyUrl) throw new Error('El sitio no tiene una propiedad de Search Console configurada.')
  if (!project.seoKeywords.length) return { checked: 0, matched: 0 }

  const token = await refreshGoogleMarketingAccessToken(connection.refreshTokenEncrypted)
  const endDate = new Date(); endDate.setDate(endDate.getDate() - 2)
  const startDate = new Date(endDate); startDate.setDate(startDate.getDate() - 27)
  const response = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: isoDate(startDate), endDate: isoDate(endDate), dimensions: ['query', 'page'], rowLimit: 25000, dataState: 'final' }),
    cache: 'no-store',
    signal: AbortSignal.timeout(45_000),
  })
  const payload = await response.json().catch(() => ({})) as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>; error?: { message?: string } }
  if (!response.ok) {
    const googleMessage = payload.error?.message || ''
    if (/insufficient permission|permission/i.test(googleMessage)) {
      throw new Error(`La cuenta ${connection.googleEmail || 'Google conectada'} no tiene acceso a ${propertyUrl}. Agrégala en Search Console > Configuración > Usuarios y permisos con acceso completo, o selecciona una propiedad que esa cuenta administre.`)
    }
    throw new Error(googleMessage || 'Search Console rechazó la consulta.')
  }
  const byQuery = new Map<string, NonNullable<typeof payload.rows>[number]>()
  for (const row of payload.rows || []) {
    const query = String(row.keys?.[0] || '').trim().toLowerCase()
    const current = byQuery.get(query)
    if (query && (!current || (row.impressions || 0) > (current.impressions || 0))) byQuery.set(query, row)
  }
  const checkedAt = new Date()
  await prisma.$transaction(async (tx) => {
    for (const keyword of project.seoKeywords) {
      const row = byQuery.get(keyword.keyword.trim().toLowerCase())
      const position = typeof row?.position === 'number' ? row.position : null
      await tx.crmSeoKeywordPosition.create({ data: { empresaId: args.empresaId, keywordId: keyword.id, checkedAt, position, resultUrl: row?.keys?.[1] || null, clicks: row?.clicks == null ? null : Math.round(row.clicks), impressions: row?.impressions == null ? null : Math.round(row.impressions), ctr: row?.ctr ?? null, source: 'SEARCH_CONSOLE', rawJson: (row || {}) as Prisma.InputJsonValue } })
      await tx.crmSeoKeyword.update({ where: { id: keyword.id }, data: { previousSearchConsolePosition: keyword.latestSearchConsolePosition, latestSearchConsolePosition: position, latestSearchConsoleUrl: row?.keys?.[1] || null, lastSearchConsoleCheckedAt: checkedAt } })
    }
    await tx.crmMarketingConnection.update({ where: { id: connection.id }, data: { accessTokenEncrypted: encryptGoogleMarketingToken(token.access_token), tokenExpiresAt: typeof token.expires_in === 'number' ? new Date(Date.now() + token.expires_in * 1000) : null, lastSyncAt: checkedAt, lastErrorAt: null, lastErrorMessage: null } })
  })
  return { checked: project.seoKeywords.length, matched: project.seoKeywords.filter((item) => byQuery.has(item.keyword.trim().toLowerCase())).length }
}