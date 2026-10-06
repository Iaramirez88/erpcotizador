import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { createSignedCrmState } from '@/lib/crm-channel-secrets'
import { buildGoogleMarketingOAuthUrl, createGoogleMarketingPkce, encryptGoogleMarketingToken, parseGoogleMarketingProduct } from '@/lib/crm-google-marketing'
import { parseJsonObject } from '@/lib/crm-omnichannel'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'CONFIGURE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const product = parseGoogleMarketingProduct(new URL(request.url).searchParams.get('product'))
    if (!product) return NextResponse.json({ error: 'Selecciona Google Ads, Analytics o Search Console.' }, { status: 400 })
    const requestedReturnTo = new URL(request.url).searchParams.get('returnTo') || ''
    const returnTo = requestedReturnTo.startsWith('/dashboard/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : undefined

    const existing = await prisma.crmMarketingConnection.findFirst({
      where: { empresaId: access.empresaId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, settingsJson: true },
    })
    const connection = existing || await prisma.crmMarketingConnection.create({
      data: {
        empresaId: access.empresaId,
        createdById: access.userId,
      },
      select: { id: true, settingsJson: true },
    })
    const state = createSignedCrmState({
      channelId: connection.id,
      empresaId: access.empresaId,
      userId: access.userId,
      issuedAt: Math.floor(Date.now() / 1000),
      purpose: `GOOGLE_MARKETING_${product}`,
      returnTo,
    })
    const pkce = createGoogleMarketingPkce()
    await prisma.crmMarketingConnection.update({
      where: { id: connection.id },
      data: {
        settingsJson: {
          ...parseJsonObject(connection.settingsJson),
          googleOAuthPkce: {
            verifierEncrypted: encryptGoogleMarketingToken(pkce.verifier),
            purpose: `GOOGLE_MARKETING_${product}`,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          },
        } as Prisma.InputJsonValue,
      },
    })

    return NextResponse.redirect(buildGoogleMarketingOAuthUrl(state, product, pkce.challenge))
  } catch (error) {
    console.error('Error iniciando Google Marketing OAuth:', error)
    const message = error instanceof Error ? error.message : 'No se pudo iniciar la conexión con Google.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
