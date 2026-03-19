import { AccessLevel, ModuleKey } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { assertCrmSedeAccess } from '@/lib/crm'
import { buildMetaOAuthUrl } from '@/lib/crm-meta'
import { createSignedCrmState } from '@/lib/crm-channel-secrets'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: { id: true, empresaId: true, sedeId: true, provider: true },
    })

    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    if (!['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX', 'FACEBOOK_PAGE', 'MESSENGER', 'INSTAGRAM_DM'].includes(channel.provider)) {
      return NextResponse.json({ error: 'Este canal no usa conexión Meta.' }, { status: 400 })
    }

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const state = createSignedCrmState({
      channelId: channel.id,
      empresaId: access.empresaId,
      userId: access.userId,
      issuedAt: Math.floor(Date.now() / 1000),
    })

    return NextResponse.redirect(buildMetaOAuthUrl({ channelId: channel.id, state }))
  } catch (error) {
    console.error('Error iniciando OAuth de Meta:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo iniciar la conexión con Meta.' }, { status: 500 })
  }
}