import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { getGoogleMarketingConfigurationStatus } from '@/lib/crm-google-marketing'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const from = new Date()
    from.setDate(from.getDate() - 30)

    const [connection, keywords, briefs, websites, adsAggregate, attributedLeads] = await Promise.all([
      prisma.crmMarketingConnection.findFirst({
        where: { empresaId: access.empresaId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          googleEmail: true,
          googleAdsCustomerId: true,
          googleAnalyticsPropertyId: true,
          searchConsoleSiteUrl: true,
          scopes: true,
          lastSyncAt: true,
          lastErrorAt: true,
          lastErrorMessage: true,
          updatedAt: true,
        },
      }),
      prisma.crmSeoKeyword.findMany({
        where: { empresaId: access.empresaId },
        orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
        take: 100,
        include: {
          websiteProject: { select: { id: true, nombre: true } },
          positions: { orderBy: { checkedAt: 'desc' }, take: 12 },
        },
      }),
      prisma.crmContentBrief.findMany({
        where: { empresaId: access.empresaId },
        orderBy: { updatedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          title: true,
          seedIdea: true,
          targetKeyword: true,
          competitorUrls: true,
          contentType: true,
          status: true,
          generatedText: true,
          generatedContentJson: true,
          websiteProjectId: true,
          updatedAt: true,
        },
      }),
      prisma.websiteProject.findMany({
        where: { empresaId: access.empresaId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, nombre: true, primaryDomain: true, subdomain: true, status: true },
      }),
      prisma.crmAdCampaignDailyMetric.aggregate({
        where: { empresaId: access.empresaId, metricDate: { gte: from } },
        _sum: {
          impressions: true,
          clicks: true,
          cost: true,
          conversions: true,
          conversionValue: true,
          crmLeads: true,
          qualifiedLeads: true,
          opportunities: true,
          quotes: true,
          sales: true,
          crmRevenue: true,
          crmGrossProfit: true,
        },
      }),
      prisma.crmLeadCapture.count({
        where: { empresaId: access.empresaId, gclid: { not: null }, createdAt: { gte: from } },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        googleConfiguration: getGoogleMarketingConfigurationStatus(),
        connection,
        keywords,
        briefs,
        websites,
        metrics: { ...adsAggregate._sum, attributedLeads },
      },
    })
  } catch (error) {
    console.error('Error cargando marketing y SEO:', error)
    return NextResponse.json({ error: 'No se pudo cargar Marketing y SEO.' }, { status: 500 })
  }
}
