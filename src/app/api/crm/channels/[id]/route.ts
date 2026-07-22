import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  isPlainObject,
  normalizeString,
  parseChannelConnectionStatus,
  parseChannelProvider,
} from '@/lib/crm'
import { buildOutboundMessagingUsageMeters, getOutboundMessagingLimitConfig, getOutboundMessagingUsageSnapshot, hasOutboundMessagingLimits } from '@/lib/crm-channel-limits'
import { isWhatsAppCloudChannelReadyForProduction } from '@/lib/crm-meta'
import { maskTokenPreview } from '@/lib/crm-omnichannel'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
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
    const row = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { conversations: true, captures: true } },
      },
    })

    if (!row) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    const outboundMessagingLimitConfig = getOutboundMessagingLimitConfig(row.settingsJson)
    const outboundMessagingUsage = hasOutboundMessagingLimits(outboundMessagingLimitConfig)
      ? await getOutboundMessagingUsageSnapshot({ empresaId: row.empresaId, channelConnectionId: row.id })
      : null
    const outboundMessagingMeters = outboundMessagingUsage
      ? buildOutboundMessagingUsageMeters(outboundMessagingLimitConfig, outboundMessagingUsage)
      : []

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        verifyTokenPreview: maskTokenPreview(row.verifyToken),
        outboundMessagingStats: {
          config: outboundMessagingLimitConfig,
          usage: outboundMessagingUsage,
          meters: outboundMessagingMeters,
        },
      },
    })
  } catch (error) {
    console.error('Error obteniendo canal CRM:', error)
    return NextResponse.json({ error: 'Error obteniendo canal CRM' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        sedeId: true,
        provider: true,
        status: true,
        settingsJson: true,
        externalAccountId: true,
        externalPhoneNumberId: true,
      },
    })

    if (!current) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const patch: Prisma.CrmChannelConnectionUpdateInput = {}

    if (body?.provider !== undefined) {
      const provider = parseChannelProvider(body.provider)
      if (!provider) return NextResponse.json({ error: 'provider inválido' }, { status: 400 })
      patch.provider = provider
    }

    if (body?.status !== undefined) {
      const status = parseChannelConnectionStatus(body.status)
      if (!status) return NextResponse.json({ error: 'status inválido' }, { status: 400 })
      patch.status = status
    }

    if (body?.name !== undefined) {
      const name = normalizeString(body.name)
      if (!name) return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
      patch.name = name
    }

    if (body?.externalAccountId !== undefined) patch.externalAccountId = normalizeString(body.externalAccountId) || null
    if (body?.externalPageId !== undefined) patch.externalPageId = normalizeString(body.externalPageId) || null
    if (body?.externalPhoneNumberId !== undefined) patch.externalPhoneNumberId = normalizeString(body.externalPhoneNumberId) || null
    if (body?.verifyToken !== undefined) patch.verifyToken = normalizeString(body.verifyToken) || null
    if (body?.settingsJson !== undefined) {
      if (!isPlainObject(body.settingsJson)) return NextResponse.json({ error: 'settingsJson inválido' }, { status: 400 })
      patch.settingsJson = body.settingsJson as Prisma.InputJsonValue
    }

    const nextProvider = (patch.provider as typeof current.provider | undefined) ?? current.provider
    const nextStatus = (patch.status as typeof current.status | undefined) ?? current.status
    const nextSettingsJson = (patch.settingsJson as Prisma.InputJsonValue | undefined) ?? current.settingsJson
    const nextExternalAccountId = patch.externalAccountId !== undefined ? normalizeString(patch.externalAccountId as string | null | undefined) || null : current.externalAccountId
    const nextExternalPhoneNumberId = patch.externalPhoneNumberId !== undefined ? normalizeString(patch.externalPhoneNumberId as string | null | undefined) || null : current.externalPhoneNumberId

    if (!isWhatsAppCloudChannelReadyForProduction({
      provider: nextProvider,
      settingsJson: nextSettingsJson,
      externalAccountId: nextExternalAccountId,
      externalPhoneNumberId: nextExternalPhoneNumberId,
    }) && nextStatus === 'ACTIVE') {
      return NextResponse.json({ error: 'WhatsApp Cloud solo puede pasar a ACTIVE cuando el canal queda conectado por Meta OAuth y con un número sincronizado del cliente.' }, { status: 400 })
    }

    const updated = await prisma.crmChannelConnection.update({
      where: { id },
      data: patch,
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { conversations: true, captures: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        verifyTokenPreview: maskTokenPreview(updated.verifyToken),
      },
    })
  } catch (error) {
    console.error('Error actualizando canal CRM:', error)
    return NextResponse.json({ error: 'Error actualizando canal CRM' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const current = await prisma.crmChannelConnection.findFirst({
      where: { id, empresaId: access.empresaId },
      select: {
        id: true,
        sedeId: true,
        _count: { select: { conversations: true, captures: true } },
      },
    })

    if (!current) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    if (current.sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: current.sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    if ((current._count.conversations ?? 0) > 0 || (current._count.captures ?? 0) > 0) {
      return NextResponse.json({ error: 'Este canal ya tiene actividad. Desactívalo en lugar de eliminarlo.' }, { status: 409 })
    }

    await prisma.crmChannelConnection.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando canal CRM:', error)
    return NextResponse.json({ error: 'Error eliminando canal CRM' }, { status: 500 })
  }
}