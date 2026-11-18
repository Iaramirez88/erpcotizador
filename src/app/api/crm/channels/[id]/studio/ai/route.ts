import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import {
  getChatbotStudioSettings,
  getDefaultChatbotAutomationFlowFromSettings,
} from '@/lib/crm-chatbot-studio'
import {
  generateChatbotStudioFlowDraft,
  getChatbotStudioAiConnectionStatus,
} from '@/lib/crm-chatbot-studio-ai'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = {
  params: Promise<{ id: string }>
}

async function resolveChannel(empresaId: string, channelId: string) {
  return prisma.crmChannelConnection.findFirst({
    where: { id: channelId, empresaId },
    select: { id: true, empresaId: true, settingsJson: true },
  })
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await resolveChannel(access.empresaId, id)
    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    return NextResponse.json({ success: true, data: getChatbotStudioAiConnectionStatus() })
  } catch (error) {
    console.error('Error consultando estado de IA del Chatbot Studio:', error)
    return NextResponse.json({ error: 'Error consultando estado de IA del Chatbot Studio' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await resolveChannel(access.empresaId, id)
    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const instruction = normalizeString(body?.instruction)
    if (instruction.length < 12) {
      return NextResponse.json({ error: 'Describe el flujo con al menos 12 caracteres.' }, { status: 400 })
    }
    if (instruction.length > 2400) {
      return NextResponse.json({ error: 'La instrucción no puede superar 2400 caracteres.' }, { status: 400 })
    }

    const settingsJson = (channel.settingsJson as Record<string, unknown> | null | undefined) ?? {}
    const studioSettings = getChatbotStudioSettings(settingsJson)
    const currentFlow = getDefaultChatbotAutomationFlowFromSettings(studioSettings)

    const result = await generateChatbotStudioFlowDraft({
      instruction,
      assistantName: normalizeString(settingsJson.assistantName) || 'asistente virtual',
      currentFlow: {
        name: currentFlow.name,
        description: currentFlow.description,
        stageCount: currentFlow.flowStages.length,
        actionCount: currentFlow.quickActions.length,
        triggerCount: currentFlow.flowTriggers.length,
        stageTitles: currentFlow.flowStages.map((stage) => stage.title),
      },
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error generando flujo de chatbot con IA:', error)
    const message = error instanceof Error ? error.message : 'No se pudo generar el flujo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
