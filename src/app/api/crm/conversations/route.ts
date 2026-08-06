import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { assertCrmSedeAccess, normalizeString, parseConversationStatus } from '@/lib/crm'
import { resolveCrmConversationAvatarUrl } from '@/lib/chat-avatar'
import { getWhatsAppDispatchConfig, normalizeWhatsAppRecipient } from '@/lib/crm-whatsapp'

export const runtime = 'nodejs'

function getBridgeKind(settingsJson: unknown) {
  if (!settingsJson || typeof settingsJson !== 'object' || Array.isArray(settingsJson)) return null
  return normalizeString((settingsJson as Record<string, unknown>).bridgeKind).toUpperCase() || null
}

async function resolveClienteForConversation(args: { clienteId: string; empresaId: string }) {
  return prisma.cliente.findFirst({
    where: { id: args.clienteId, empresaId: args.empresaId },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      celular: true,
      sedeId: true,
    },
  })
}

async function resolveLeadForConversation(args: { leadId: string; empresaId: string }) {
  return prisma.crmLead.findFirst({
    where: { id: args.leadId, empresaId: args.empresaId },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      celular: true,
      sedeId: true,
      convertedClienteId: true,
    },
  })
}

async function resolveOutboundWhatsAppChannel(args: { empresaId: string; sedeId: string | null }) {
  const channels = await prisma.crmChannelConnection.findMany({
    where: {
      empresaId: args.empresaId,
      provider: { in: ['WHATSAPP_CLOUD', 'WHATSAPP_SANDBOX'] },
      status: { in: ['TESTING', 'ACTIVE'] },
      OR: args.sedeId ? [{ sedeId: args.sedeId }, { sedeId: null }] : [{ sedeId: null }, {}],
    },
    orderBy: [{ sedeId: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      sedeId: true,
      provider: true,
      status: true,
      name: true,
      externalPhoneNumberId: true,
      externalPageId: true,
      settingsJson: true,
    },
  })

  return channels.find((channel) => getWhatsAppDispatchConfig(channel).enabled) ?? null
}

export async function GET(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = normalizeString(searchParams.get('search'))
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const assignedToUserId = normalizeString(searchParams.get('assignedToUserId'))
    const channelConnectionId = normalizeString(searchParams.get('channelConnectionId'))
    const provider = normalizeString(searchParams.get('provider'))
    const status = parseConversationStatus(searchParams.get('status'))

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const rows = await prisma.crmConversation.findMany({
      where: {
        empresaId: access.empresaId,
        ...(sedeId ? { sedeId } : {}),
        ...(assignedToUserId ? { assignedToUserId } : {}),
        ...(channelConnectionId ? { channelConnectionId } : {}),
        ...(provider ? { channelConnection: { provider: provider as never } } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { contactDisplayName: { contains: search, mode: 'insensitive' } },
                { contactPhone: { contains: search, mode: 'insensitive' } },
                { contactEmail: { contains: search, mode: 'insensitive' } },
                { lead: { nombre: { contains: search, mode: 'insensitive' } } },
                { cliente: { nombre: { contains: search, mode: 'insensitive' } } },
                { opportunity: { title: { contains: search, mode: 'insensitive' } } },
                { messages: { some: { bodyText: { contains: search, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        channelConnection: { select: { id: true, name: true, provider: true, status: true, settingsJson: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, nombre: true, status: true } },
        cliente: { select: { id: true, nombre: true, documento: true } },
        opportunity: { select: { id: true, title: true, stage: true } },
        messages: {
          orderBy: { occurredAt: 'desc' },
          take: 1,
          select: {
            id: true,
            direction: true,
            messageType: true,
            status: true,
            bodyText: true,
            attachmentsJson: true,
            payloadJson: true,
            occurredAt: true,
            sentByUser: { select: { id: true, name: true, email: true } },
          },
        },
        captures: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            normalizedDataJson: true,
            rawPayloadJson: true,
          },
        },
        _count: { select: { messages: true, captures: true } },
      },
    })

    const data = rows.map((row) => {
      const { channelConnection, captures, ...rest } = row
      return {
      ...rest,
      contactAvatarUrl: resolveCrmConversationAvatarUrl({
        messages: row.messages,
        captures,
      }),
      channelConnection: {
        id: channelConnection.id,
        name: channelConnection.name,
        provider: channelConnection.provider,
        status: channelConnection.status,
        bridgeKind: getBridgeKind(channelConnection.settingsJson),
      },
    }})

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listando conversaciones CRM:', error)
    return NextResponse.json({ error: 'Error listando conversaciones CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'INBOX',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const clienteId = normalizeString(body?.clienteId)
    const leadId = normalizeString(body?.leadId)
    const contactPhone = normalizeString(body?.contactPhone)
    const contactDisplayName = normalizeString(body?.contactDisplayName)
    const contactEmail = normalizeString(body?.contactEmail).toLowerCase() || null

    if (!clienteId && !leadId && !contactPhone) {
      return NextResponse.json({ error: 'clienteId, leadId o contactPhone es requerido' }, { status: 400 })
    }

    const cliente = clienteId ? await resolveClienteForConversation({ clienteId, empresaId: access.empresaId }) : null
    const lead = !cliente && leadId ? await resolveLeadForConversation({ leadId, empresaId: access.empresaId }) : null

    if (clienteId && !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    if (leadId && !cliente && !lead) {
      return NextResponse.json({ error: 'Prospecto no encontrado' }, { status: 404 })
    }

    const targetSedeId = cliente?.sedeId || lead?.sedeId || access.sedeId || null
    if (targetSedeId) {
      const denied = await assertCrmSedeAccess({ sedeId: targetSedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const recipientPhone = normalizeWhatsAppRecipient(
      cliente?.celular
      || cliente?.telefono
      || lead?.celular
      || lead?.telefono
      || contactPhone
    )
    if (!recipientPhone) {
      return NextResponse.json({ error: cliente ? 'El cliente no tiene un celular o teléfono válido para WhatsApp.' : lead ? 'El prospecto no tiene un celular o teléfono válido para WhatsApp.' : 'Debes indicar un número de WhatsApp válido.' }, { status: 400 })
    }

    const channel = await resolveOutboundWhatsAppChannel({ empresaId: access.empresaId, sedeId: targetSedeId })
    if (!channel) {
      return NextResponse.json({ error: 'No hay un canal activo de WhatsApp listo para abrir la conversación.' }, { status: 409 })
    }

    const externalThreadId = cliente
      ? `manual-cliente-${cliente.id}-${recipientPhone}`
      : lead
        ? `manual-lead-${lead.id}-${recipientPhone}`
        : `manual-phone-${recipientPhone}`
    const existing = await prisma.crmConversation.findFirst({
      where: {
        empresaId: access.empresaId,
        channelConnectionId: channel.id,
        OR: [
          { externalThreadId },
          ...(cliente ? [{ clienteId: cliente.id, contactPhone: recipientPhone }] : []),
          ...(lead ? [{ leadId: lead.id, contactPhone: recipientPhone }] : []),
          { contactPhone: recipientPhone },
        ],
      },
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ success: true, data: { conversationId: existing.id, created: false } })
    }

    const created = await prisma.$transaction(async (tx) => {
      const now = new Date()
      const conversation = await tx.crmConversation.create({
        data: {
          empresaId: access.empresaId,
          sedeId: channel.sedeId,
          channelConnectionId: channel.id,
          leadId: lead?.id || null,
          clienteId: cliente?.id || lead?.convertedClienteId || null,
          status: 'OPEN',
          directionLastMessage: 'SYSTEM',
          externalThreadId,
          contactDisplayName: cliente?.nombre || lead?.nombre || contactDisplayName || recipientPhone,
          contactPhone: recipientPhone,
          contactEmail: (cliente ? normalizeString(cliente.email).toLowerCase() : lead ? normalizeString(lead.email).toLowerCase() : contactEmail) || null,
          assignedToUserId: access.userId,
          source: 'WHATSAPP',
          sourceMedium: 'crm-manual',
          unreadCount: 0,
          firstInboundAt: null,
          lastMessageAt: now,
        },
        select: { id: true },
      })

      await tx.crmMessage.create({
        data: {
          empresaId: access.empresaId,
          sedeId: channel.sedeId,
          conversationId: conversation.id,
          direction: 'SYSTEM',
          messageType: 'TEXT',
          status: 'SENT',
          bodyText: cliente
            ? `Conversación iniciada manualmente desde Clientes para el número ${recipientPhone}. Si el contacto no ha escrito en las últimas 24 horas, WhatsApp puede exigir una plantilla aprobada antes del primer mensaje saliente.`
            : lead
              ? `Conversación iniciada manualmente desde Prospectos para el número ${recipientPhone}. Si el contacto no ha escrito en las últimas 24 horas, WhatsApp puede exigir una plantilla aprobada antes del primer mensaje saliente.`
              : `Conversación iniciada manualmente para el número ${recipientPhone}. Si el contacto no ha escrito en las últimas 24 horas, WhatsApp puede exigir una plantilla aprobada antes del primer mensaje saliente.`,
          payloadJson: {
            source: cliente ? 'crm-manual-client' : lead ? 'crm-manual-lead' : 'crm-manual-phone',
            messageOrigin: 'SYSTEM',
            clienteId: cliente?.id || lead?.convertedClienteId || null,
            leadId: lead?.id || null,
          } as Prisma.InputJsonValue,
          occurredAt: now,
        },
      })

      await tx.crmActivity.create({
        data: {
          empresaId: access.empresaId,
          sedeId: channel.sedeId,
          type: 'WHATSAPP',
          summary: cliente
            ? 'Conversación WhatsApp creada manualmente desde clientes'
            : lead
              ? 'Conversación WhatsApp creada manualmente desde prospectos'
              : 'Conversación WhatsApp creada manualmente desde inbox',
          details: cliente
            ? `Se abrió la conversación para ${recipientPhone} desde la base de clientes.`
            : lead
              ? `Se abrió la conversación para ${recipientPhone} desde la base de prospectos.`
              : `Se abrió la conversación manualmente para ${recipientPhone} desde el inbox.`,
          leadId: lead?.id || null,
          clienteId: cliente?.id || lead?.convertedClienteId || null,
          occurredAt: now,
          createdById: access.userId,
        },
      })

      return conversation
    })

    return NextResponse.json({ success: true, data: { conversationId: created.id, created: true } }, { status: 201 })
  } catch (error) {
    console.error('Error creando conversación CRM desde cliente:', error)
    return NextResponse.json({ error: 'Error creando conversación CRM desde cliente' }, { status: 500 })
  }
}