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
import { channelHasActivity, getChannelArchiveState, withChannelArchiveState } from '@/lib/crm-channel-archive'
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
        archivedAt: getChannelArchiveState(row.settingsJson).archivedAt,
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
      const incomingSettings = body.settingsJson as Record<string, unknown>
      const currentSettings = (current.settingsJson && isPlainObject(current.settingsJson) ? current.settingsJson : {}) as Record<string, unknown>
      // Shallow merge: conserva los campos previos (flujo del Studio, variables,
      // reglas, layout, etc.) que el cliente no envíe, evitando pérdida de
      // configuración ante PATCH parciales.
      patch.settingsJson = { ...currentSettings, ...incomingSettings } as Prisma.InputJsonValue
    }

    const archivedFlag = typeof body?.archived === 'boolean' ? body.archived : null
    const currentArchive = getChannelArchiveState(current.settingsJson)
    const baseSettingsJson = (patch.settingsJson as Prisma.InputJsonValue | undefined) ?? current.settingsJson

    if (archivedFlag === true) {
      // Archivar siempre deja el canal fuera de operación y conserva su histórico.
      patch.settingsJson = withChannelArchiveState(baseSettingsJson, {
        archivedAt: new Date(),
        archivedById: access.userId,
      }) as Prisma.InputJsonValue
      patch.status = 'DISABLED'
    } else if (archivedFlag === false) {
      // Restaurar solo quita el archivo: el canal sigue desactivado hasta que se reactive.
      patch.settingsJson = withChannelArchiveState(baseSettingsJson, { archivedAt: null }) as Prisma.InputJsonValue
    } else if (body?.settingsJson !== undefined && currentArchive.archivedAt) {
      // Una edición normal de settingsJson no debe perder el estado de archivo.
      patch.settingsJson = withChannelArchiveState(baseSettingsJson, currentArchive) as Prisma.InputJsonValue
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

    // Respaldo de versiones: guarda un snapshot del settingsJson previo antes de
    // sobrescribirlo, para poder restaurar una configuración anterior.
    const settingsChanged = body?.settingsJson !== undefined

    const updated = await prisma.$transaction(async (tx) => {
      if (settingsChanged) {
        const latest = await tx.crmChannelSettingsVersion.findFirst({
          where: { channelConnectionId: id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        })
        await tx.crmChannelSettingsVersion.create({
          data: {
            channelConnectionId: id,
            versionNumber: (latest?.versionNumber ?? 0) + 1,
            settingsJson: (current.settingsJson ?? {}) as Prisma.InputJsonValue,
            changeNote: typeof body?.settingsChangeNote === 'string' ? normalizeString(body.settingsChangeNote) || null : null,
            createdByUserId: access.userId,
          },
        })

        // Mantener un máximo de 100 versiones por canal para no crecer sin límite.
        const versionsToDelete = await tx.crmChannelSettingsVersion.findMany({
          where: { channelConnectionId: id },
          orderBy: { versionNumber: 'desc' },
          skip: 100,
          select: { id: true },
        })
        if (versionsToDelete.length) {
          await tx.crmChannelSettingsVersion.deleteMany({
            where: { id: { in: versionsToDelete.map((item) => item.id) } },
          })
        }
      }

      return tx.crmChannelConnection.update({
        where: { id },
        data: patch,
        include: {
          sede: { select: { id: true, nombre: true, codigo: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { conversations: true, captures: true } },
        },
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        verifyTokenPreview: maskTokenPreview(updated.verifyToken),
        archivedAt: getChannelArchiveState(updated.settingsJson).archivedAt,
      },
    })
  } catch (error) {
    console.error('Error actualizando canal CRM:', error)
    return NextResponse.json({ error: 'Error actualizando canal CRM' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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
        status: true,
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

    const conversations = current._count.conversations ?? 0
    const captures = current._count.captures ?? 0

    if (channelHasActivity(current._count)) {
      // En modo testing la información es de prueba y puede eliminarse junto al canal,
      // siempre que el usuario confirme explícitamente la pérdida de datos.
      if (current.status === 'TESTING') {
        let confirmCascade = false
        try {
          const body = (await request.json().catch(() => null)) as { confirmCascade?: boolean } | null
          confirmCascade = body?.confirmCascade === true
        } catch {
          confirmCascade = false
        }

        if (!confirmCascade) {
          return NextResponse.json(
            {
              error: 'Este canal está en modo testing. Confirma que deseas eliminar el canal junto con toda su información de prueba.',
              code: 'TESTING_CASCADE_REQUIRED',
              data: {
                conversations,
                captures,
                canDeleteWithData: true,
              },
            },
            { status: 409 },
          )
        }

        await prisma.$transaction([
          prisma.crmMessage.deleteMany({ where: { conversation: { channelConnectionId: id } } }),
          prisma.crmLeadCapture.deleteMany({ where: { channelConnectionId: id } }),
          prisma.crmConversation.deleteMany({ where: { channelConnectionId: id } }),
          prisma.crmChannelSettingsVersion.deleteMany({ where: { channelConnectionId: id } }),
          prisma.crmChannelConnection.delete({ where: { id } }),
        ])
        return NextResponse.json({ success: true })
      }

      return NextResponse.json(
        {
          error: 'Este canal ya tiene actividad. Desactívalo o archívalo en lugar de eliminarlo.',
          code: 'CHANNEL_HAS_ACTIVITY',
          data: {
            conversations,
            captures,
            canDeactivate: true,
            canArchive: true,
          },
        },
        { status: 409 },
      )
    }

    await prisma.crmChannelConnection.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando canal CRM:', error)
    return NextResponse.json({ error: 'Error eliminando canal CRM' }, { status: 500 })
  }
}