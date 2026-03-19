import { AccessLevel, ModuleKey, type Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { assertCrmSedeAccess, normalizeString } from '@/lib/crm'
import { buildMetaSettingsPatch, getMetaAccessToken, syncMetaConnection } from '@/lib/crm-meta'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const { id } = await context.params
    const channel = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        empresaId: true,
        sedeId: true,
        provider: true,
        settingsJson: true,
        externalAccountId: true,
        externalPageId: true,
        externalPhoneNumberId: true,
      },
    })

    if (!channel) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    if (channel.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: channel.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const accessToken = getMetaAccessToken(channel.settingsJson)
    if (!accessToken) {
      return NextResponse.json({ error: 'El canal no tiene una conexión Meta activa.' }, { status: 409 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const snapshot = await syncMetaConnection(accessToken)
    const patch = buildMetaSettingsPatch({
      provider: channel.provider,
      currentSettingsJson: channel.settingsJson,
      snapshot,
      accessToken,
      selectedPageId: normalizeString(body?.externalPageId) || channel.externalPageId,
      selectedInstagramAccountId: normalizeString(body?.externalAccountId) || channel.externalAccountId,
      selectedPhoneNumberId: normalizeString(body?.externalPhoneNumberId) || channel.externalPhoneNumberId,
    })

    const updated = await prisma.crmChannelConnection.update({
      where: { id: channel.id },
      data: {
        externalAccountId: patch.externalAccountId ?? channel.externalAccountId,
        externalPageId: patch.externalPageId ?? channel.externalPageId,
        externalPhoneNumberId: patch.externalPhoneNumberId ?? channel.externalPhoneNumberId,
        settingsJson: patch.settingsJson as Prisma.InputJsonValue,
        lastSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { conversations: true, captures: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Error sincronizando assets de Meta:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo sincronizar Meta.' }, { status: 500 })
  }
}