import { AccessLevel, ModuleKey, type Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { assertCrmSedeAccess } from '@/lib/crm'
import { buildMetaSettingsPatch, exchangeMetaCode, syncMetaConnection } from '@/lib/crm-meta'
import { verifySignedCrmState } from '@/lib/crm-channel-secrets'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

function buildRedirect(status: 'connected' | 'error', channelId: string, message?: string) {
  const url = new URL('/dashboard/crm/integraciones', process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000')
  url.searchParams.set('meta', status)
  url.searchParams.set('channelId', channelId)
  if (message) url.searchParams.set('message', message)
  return url
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params

  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const errorReason = searchParams.get('error')
    const code = searchParams.get('code')
    const state = searchParams.get('state') || ''

    if (errorReason || !code) {
      return NextResponse.redirect(buildRedirect('error', id, errorReason || 'Meta no devolvió código de autorización.'))
    }

    const parsedState = verifySignedCrmState(state)
    if (!parsedState || parsedState.channelId !== id || parsedState.empresaId !== access.empresaId || parsedState.userId !== access.userId) {
      return NextResponse.redirect(buildRedirect('error', id, 'El estado OAuth de Meta no es válido.'))
    }

    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        provider: true,
        status: true,
        settingsJson: true,
        externalAccountId: true,
        externalPageId: true,
        externalPhoneNumberId: true,
      },
    })

    if (!channel) {
      return NextResponse.redirect(buildRedirect('error', id, 'Canal no encontrado.'))
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const token = await exchangeMetaCode(channel.id, code)
    if (!token.access_token) {
      return NextResponse.redirect(buildRedirect('error', id, 'Meta no devolvió access token utilizable.'))
    }

    const snapshot = await syncMetaConnection(token.access_token, token.expires_in, token.granted_scopes)
    const patch = buildMetaSettingsPatch({
      provider: channel.provider,
      currentSettingsJson: channel.settingsJson,
      snapshot,
      accessToken: token.access_token,
      selectedPageId: channel.externalPageId,
      selectedInstagramAccountId: channel.externalAccountId,
      selectedPhoneNumberId: channel.externalPhoneNumberId,
    })

    await prisma.crmChannelConnection.update({
      where: { id: channel.id },
      data: {
        status: channel.status === 'DRAFT' ? 'TESTING' : channel.status,
        externalAccountId: patch.externalAccountId ?? channel.externalAccountId,
        externalPageId: patch.externalPageId ?? channel.externalPageId,
        externalPhoneNumberId: patch.externalPhoneNumberId ?? channel.externalPhoneNumberId,
        settingsJson: patch.settingsJson as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    })

    return NextResponse.redirect(buildRedirect('connected', id))
  } catch (error) {
    console.error('Error finalizando OAuth de Meta:', error)
    return NextResponse.redirect(buildRedirect('error', id, error instanceof Error ? error.message : 'No se pudo completar la conexión con Meta.'))
  }
}