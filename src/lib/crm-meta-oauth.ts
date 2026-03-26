import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildMetaSettingsPatch, exchangeMetaCode } from '@/lib/crm-meta'
import { normalizeString } from '@/lib/crm'
import { syncMetaConnection } from '@/lib/crm-meta'
import { verifySignedCrmState } from '@/lib/crm-channel-secrets'

function getAppBaseUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export function buildMetaDashboardRedirect(status: 'connected' | 'error', channelId?: string | null, message?: string) {
  const url = new URL('/dashboard/crm/integraciones', getAppBaseUrl())
  url.searchParams.set('meta', status)
  if (channelId) url.searchParams.set('channelId', channelId)
  if (message) url.searchParams.set('message', message)
  return url
}

export async function handleMetaOAuthCallback(args: {
  request: Request
  redirectUri?: string
  legacyChannelId?: string
  sourceLabel: string
}) {
  const { searchParams } = new URL(args.request.url)
  const rawState = searchParams.get('state') || ''
  const parsedState = rawState ? verifySignedCrmState(rawState) : null
  const fallbackChannelId = args.legacyChannelId || parsedState?.channelId || null
  const errorReason = normalizeString(searchParams.get('error_reason') || searchParams.get('error') || searchParams.get('error_message'))
  const code = normalizeString(searchParams.get('code'))

  if (errorReason || !code) {
    const message = errorReason || 'Meta no devolvio codigo de autorizacion.'
    console.error(`[Meta OAuth] ${args.sourceLabel} rechazo la autorizacion.`, {
      channelId: fallbackChannelId,
      errorReason: message,
    })
    return NextResponse.redirect(buildMetaDashboardRedirect('error', fallbackChannelId, message))
  }

  if (!parsedState) {
    console.error(`[Meta OAuth] ${args.sourceLabel} recibio state invalido.`)
    return NextResponse.redirect(buildMetaDashboardRedirect('error', fallbackChannelId, 'El estado OAuth de Meta no es valido.'))
  }

  if (args.legacyChannelId && parsedState.channelId !== args.legacyChannelId) {
    console.error(`[Meta OAuth] ${args.sourceLabel} detecto channelId inconsistente.`, {
      expectedChannelId: args.legacyChannelId,
      stateChannelId: parsedState.channelId,
    })
    return NextResponse.redirect(buildMetaDashboardRedirect('error', args.legacyChannelId, 'El canal recibido por Meta no coincide con el estado firmado.'))
  }

  try {
    const channel = await prisma.crmChannelConnection.findFirst({
      where: {
        id: parsedState.channelId,
        empresaId: parsedState.empresaId,
      },
      select: {
        id: true,
        empresaId: true,
        provider: true,
        status: true,
        settingsJson: true,
        externalAccountId: true,
        externalPageId: true,
        externalPhoneNumberId: true,
      },
    })

    if (!channel) {
      console.error(`[Meta OAuth] ${args.sourceLabel} no encontro el canal destino.`, {
        channelId: parsedState.channelId,
        empresaId: parsedState.empresaId,
      })
      return NextResponse.redirect(buildMetaDashboardRedirect('error', parsedState.channelId, 'Canal no encontrado.'))
    }

    console.info(`[Meta OAuth] ${args.sourceLabel} iniciando intercambio de codigo.`, {
      channelId: channel.id,
      provider: channel.provider,
    })

    const token = await exchangeMetaCode({
      code,
      redirectUri: args.redirectUri,
    })

    if (!token.access_token) {
      console.error(`[Meta OAuth] ${args.sourceLabel} no recibio access token utilizable.`, {
        channelId: channel.id,
      })
      return NextResponse.redirect(buildMetaDashboardRedirect('error', channel.id, 'Meta no devolvio access token utilizable.'))
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

    console.info(`[Meta OAuth] ${args.sourceLabel} completo la conexion correctamente.`, {
      channelId: channel.id,
      provider: channel.provider,
    })

    return NextResponse.redirect(buildMetaDashboardRedirect('connected', channel.id))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar la conexion con Meta.'
    console.error(`[Meta OAuth] ${args.sourceLabel} fallo completando la conexion.`, {
      channelId: parsedState.channelId,
      error: message,
    })

    await prisma.crmChannelConnection.updateMany({
      where: {
        id: parsedState.channelId,
        empresaId: parsedState.empresaId,
      },
      data: {
        lastErrorAt: new Date(),
        lastErrorMessage: message,
      },
    })

    return NextResponse.redirect(buildMetaDashboardRedirect('error', parsedState.channelId, message))
  }
}