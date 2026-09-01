import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import {
  buildCrmCampaignScopeId,
  mergeCompanyCrmKpiSettings,
  parseCrmCampaignScopeId,
  parseCompanyCrmKpiSettings,
  type CrmKpiGoalSettings,
  type CrmKpiScopeType,
} from '@/lib/company-crm-kpi-settings'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type CampaignTimelinePoint = {
  key: string
  label: string
  captures: number
  conversations: number
  channels: number
}

type CampaignOption = {
  id: string
  label: string
  channelId: string
  channelName: string
  captures: number
  conversations: number
  timeline: CampaignTimelinePoint[]
}

function isScopeType(value: unknown): value is CrmKpiScopeType {
  return value === 'COMPANY' || value === 'SEDE' || value === 'CHANNEL' || value === 'CAMPAIGN'
}

function parseGoalSettings(value: unknown): Partial<CrmKpiGoalSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const normalize = (entry: unknown) => {
    if (typeof entry === 'number' && Number.isFinite(entry) && entry >= 0) return entry
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      if (!trimmed) return null
      const parsed = Number(trimmed)
      if (Number.isFinite(parsed) && parsed >= 0) return parsed
    }
    return null
  }

  return {
    operationalTarget: normalize(record.operationalTarget),
    capturesTarget: normalize(record.capturesTarget),
    conversationsTarget: normalize(record.conversationsTarget),
    conversionTargetPct: normalize(record.conversionTargetPct),
    minimumAcceptancePct: normalize(record.minimumAcceptancePct),
  }
}

function buildTimelineTemplate() {
  return Array.from({ length: 6 }, (_, index) => {
    const base = new Date()
    const month = new Date(base.getFullYear(), base.getMonth() - (5 - index), 1)
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      label: month.toLocaleDateString('es-CO', { month: 'short' }),
      captures: 0,
      conversations: 0,
      channels: 0,
    }
  })
}

function getMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

async function buildCampaignOptions(empresaId: string): Promise<CampaignOption[]> {
  const [channels, captures, conversations] = await Promise.all([
    prisma.crmChannelConnection.findMany({
      where: { empresaId },
      select: { id: true, name: true },
    }),
    prisma.crmLeadCapture.findMany({
      where: {
        empresaId,
        OR: [
          { utmCampaign: { not: null } },
          { conversation: { is: { sourceCampaign: { not: null } } } },
        ],
      },
      select: {
        channelConnectionId: true,
        utmCampaign: true,
        createdAt: true,
        conversation: { select: { sourceCampaign: true } },
      },
    }),
    prisma.crmConversation.findMany({
      where: {
        empresaId,
        sourceCampaign: { not: null },
      },
      select: {
        channelConnectionId: true,
        sourceCampaign: true,
        createdAt: true,
      },
    }),
  ])

  const channelsById = new Map(channels.map((channel) => [channel.id, channel]))
  const optionMap = new Map<string, CampaignOption>()

  function ensureOption(channelId: string, campaignName: string) {
    const channel = channelsById.get(channelId)
    if (!channel) return null

    const label = normalizeString(campaignName)
    if (!label) return null

    const id = buildCrmCampaignScopeId(channelId, label)
    const current = optionMap.get(id)
    if (current) return current

    const next: CampaignOption = {
      id,
      label,
      channelId,
      channelName: channel.name,
      captures: 0,
      conversations: 0,
      timeline: buildTimelineTemplate(),
    }
    optionMap.set(id, next)
    return next
  }

  function applyTimeline(pointList: CampaignTimelinePoint[], createdAt: Date, field: 'captures' | 'conversations') {
    const monthKey = getMonthKey(createdAt)
    const bucket = pointList.find((item) => item.key === monthKey)
    if (!bucket) return
    bucket[field] += 1
    bucket.channels = 1
  }

  for (const capture of captures) {
    const campaignName = normalizeString(capture.utmCampaign || capture.conversation?.sourceCampaign)
    if (!campaignName) continue
    const option = ensureOption(capture.channelConnectionId, campaignName)
    if (!option) continue
    option.captures += 1
    applyTimeline(option.timeline, capture.createdAt, 'captures')
  }

  for (const conversation of conversations) {
    const campaignName = normalizeString(conversation.sourceCampaign)
    if (!campaignName) continue
    const option = ensureOption(conversation.channelConnectionId, campaignName)
    if (!option) continue
    option.conversations += 1
    applyTimeline(option.timeline, conversation.createdAt, 'conversations')
  }

  return [...optionMap.values()].sort((left, right) => {
    const rightScore = right.captures + right.conversations
    const leftScore = left.captures + left.conversations
    if (rightScore !== leftScore) return rightScore - leftScore
    return left.label.localeCompare(right.label, 'es', { sensitivity: 'base' })
  })
}

export async function GET() {
  const access = await requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'CHANNELS',
    action: 'READ',
    scope: 'SEDE',
  })
  if (!access.ok) return access.response

  const [empresa, sede, campaignOptions] = await Promise.all([
    prisma.empresa.findUnique({
      where: { id: access.empresaId },
      select: { id: true, nombre: true, dashboardConfig: true },
    }),
    prisma.sede.findUnique({
      where: { id: access.sedeId },
      select: { id: true, nombre: true },
    }),
    buildCampaignOptions(access.empresaId),
  ])

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      companyName: empresa.nombre,
      currentSede: sede,
      settings: parseCompanyCrmKpiSettings(empresa.dashboardConfig),
      campaignOptions,
    },
  })
}

export async function PUT(request: NextRequest) {
  const access = await requireCapabilityAccess({
    domain: 'CAPTACION',
    subdomain: 'CHANNELS',
    action: 'UPDATE',
    scope: 'SEDE',
  })
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const scopeType = body?.scopeType
  const scopeId = normalizeString(body?.scopeId)
  const settings = parseGoalSettings(body?.settings)

  if (!isScopeType(scopeType)) {
    return NextResponse.json({ error: 'scopeType inválido' }, { status: 400 })
  }

  if ((scopeType === 'SEDE' || scopeType === 'CHANNEL' || scopeType === 'CAMPAIGN') && !scopeId) {
    return NextResponse.json({ error: 'scopeId es requerido para ese alcance' }, { status: 400 })
  }

  const parsedCampaignScope = scopeType === 'CAMPAIGN' && scopeId ? parseCrmCampaignScopeId(scopeId) : null

  if (scopeType === 'CAMPAIGN' && !parsedCampaignScope) {
    return NextResponse.json({ error: 'scopeId de campaña inválido' }, { status: 400 })
  }

  if (scopeType === 'SEDE' && scopeId) {
    const denied = await assertCrmSedeAccess({ sedeId: scopeId, empresaId: access.empresaId, userId: access.userId, minLevel: 'WRITE' })
    if (denied) return denied
  }

  if (scopeType === 'CHANNEL' && scopeId) {
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id: scopeId, empresaId: access.empresaId },
      select: { id: true, sedeId: true },
    })
    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }
    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: 'WRITE' })
      if (denied) return denied
    }
  }

  if (scopeType === 'CAMPAIGN' && parsedCampaignScope) {
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id: parsedCampaignScope.channelId, empresaId: access.empresaId },
      select: { id: true, sedeId: true },
    })
    if (!channel) {
      return NextResponse.json({ error: 'Canal de la campaña no encontrado' }, { status: 404 })
    }
    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: 'WRITE' })
      if (denied) return denied
    }
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: access.empresaId },
    select: { id: true, nombre: true, dashboardConfig: true },
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa no encontrada' }, { status: 404 })
  }

  const updated = await prisma.empresa.update({
    where: { id: access.empresaId },
    data: {
      dashboardConfig: mergeCompanyCrmKpiSettings(empresa.dashboardConfig, {
        scopeType,
        scopeId: scopeId || null,
        settings,
      }) as Prisma.InputJsonValue,
    },
    select: { id: true, nombre: true, dashboardConfig: true },
  })

  return NextResponse.json({
    success: true,
    data: {
      companyName: updated.nombre,
      settings: parseCompanyCrmKpiSettings(updated.dashboardConfig),
      campaignOptions: await buildCampaignOptions(access.empresaId),
    },
  })
}