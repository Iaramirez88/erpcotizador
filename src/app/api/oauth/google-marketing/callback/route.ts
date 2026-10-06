import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { verifySignedCrmState } from '@/lib/crm-channel-secrets'
import {
  decryptGoogleMarketingToken,
  encryptGoogleMarketingToken,
  exchangeGoogleMarketingCode,
  fetchGoogleMarketingProfile,
  parseGoogleMarketingProduct,
} from '@/lib/crm-google-marketing'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'

function dashboardRedirect(request: Request, status: 'connected' | 'error', message?: string, returnTo?: string) {
  const safeReturnTo = returnTo?.startsWith('/dashboard/') && !returnTo.startsWith('//') ? returnTo : '/dashboard/crm/integraciones'
  const url = new URL(safeReturnTo, new URL(request.url).origin)
  if (!returnTo) url.searchParams.set('view', 'marketing')
  url.searchParams.set('googleMarketing', status)
  if (message) url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const oauthError = String(url.searchParams.get('error') || '').trim()
  const code = String(url.searchParams.get('code') || '').trim()
  const state = verifySignedCrmState(String(url.searchParams.get('state') || '').trim())

  if (oauthError) return dashboardRedirect(request, 'error', oauthError, state?.returnTo)
  if (!code || !state) return dashboardRedirect(request, 'error', 'La respuesta OAuth de Google no es válida o expiró.')
  const session = await auth()
  const sessionUserId = session?.user ? await resolveUserIdFromSession(session) : null
  if (!sessionUserId || sessionUserId !== state.userId) return dashboardRedirect(request, 'error', 'La sesión que inició OAuth ya no está activa.', state.returnTo)
  const product = parseGoogleMarketingProduct(state.purpose?.replace('GOOGLE_MARKETING_', ''))
  if (!product) return dashboardRedirect(request, 'error', 'No se pudo identificar el producto de Google solicitado.', state.returnTo)

  try {
    const connection = await prisma.crmMarketingConnection.findFirst({
      where: { id: state.channelId, empresaId: state.empresaId },
      select: { id: true, refreshTokenEncrypted: true, scopes: true, settingsJson: true },
    })
    if (!connection) return dashboardRedirect(request, 'error', 'La conexión de marketing ya no existe.', state.returnTo)

    const settings = parseJsonObject(connection.settingsJson)
    const pkce = parseJsonObject(settings.googleOAuthPkce)
    const verifierEncrypted = typeof pkce.verifierEncrypted === 'string' ? pkce.verifierEncrypted : ''
    const verifier = decryptGoogleMarketingToken(verifierEncrypted)
    const expiresAt = typeof pkce.expiresAt === 'string' ? Date.parse(pkce.expiresAt) : Number.NaN
    if (!verifier || pkce.purpose !== state.purpose || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return dashboardRedirect(request, 'error', 'La verificación PKCE no es válida o expiró.', state.returnTo)
    }
    const { googleOAuthPkce: _consumedPkce, ...settingsWithoutPkce } = settings
    void _consumedPkce
    await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: { settingsJson: settingsWithoutPkce as Prisma.InputJsonValue },
    })
    const token = await exchangeGoogleMarketingCode(code, verifier)
    const profile = await fetchGoogleMarketingProfile(String(token.access_token))
    const scopes = [...new Set([...connection.scopes, ...String(token.scope || '').split(/\s+/).filter(Boolean)])]

    await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: {
        status: 'ACTIVE',
        googleEmail: profile.email,
        googleAccountId: profile.accountId,
        scopes,
        accessTokenEncrypted: encryptGoogleMarketingToken(token.access_token),
        refreshTokenEncrypted: token.refresh_token
          ? encryptGoogleMarketingToken(token.refresh_token)
          : connection.refreshTokenEncrypted,
        tokenExpiresAt: typeof token.expires_in === 'number'
          ? new Date(Date.now() + token.expires_in * 1000)
          : null,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    })

    return dashboardRedirect(request, 'connected', undefined, state.returnTo)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo completar la conexión con Google.'
    console.error('Error completando Google Marketing OAuth:', error)
    if (state) {
      await prisma.crmMarketingConnection.updateMany({
        where: { id: state.channelId, empresaId: state.empresaId },
        data: { status: 'ERROR', lastErrorAt: new Date(), lastErrorMessage: message },
      }).catch(() => undefined)
    }
    return dashboardRedirect(request, 'error', message, state.returnTo)
  }
}
