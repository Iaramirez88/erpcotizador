import { NextResponse } from 'next/server'
import type { CrmConsentStatus, CrmContactChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { requireCapabilityAccess } from '@/lib/api-rbac'

export const runtime = 'nodejs'

const CHANNELS: CrmContactChannel[] = ['EMAIL', 'WHATSAPP', 'SMS', 'CALL']
const STATUSES: CrmConsentStatus[] = ['UNKNOWN', 'GRANTED', 'REVOKED']

interface RouteContext {
  params: Promise<{ id: string }>
}

async function loadContact(contactId: string) {
  return prisma.crmContact.findUnique({
    where: { id: contactId },
    select: { id: true, empresaId: true, status: true },
  })
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const contact = await loadContact(id)
    if (!contact || contact.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    const consents = await prisma.crmContactConsent.findMany({
      where: { empresaId: access.empresaId, contactId: contact.id },
      orderBy: { channel: 'asc' },
    })

    return NextResponse.json({ success: true, data: consents })
  } catch (error) {
    console.error('Error obteniendo consentimientos:', error)
    return NextResponse.json({ error: 'Error obteniendo consentimientos' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CONTACTS',
      action: 'UPDATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const { id } = await context.params
    const contact = await loadContact(id)
    if (!contact || contact.empresaId !== access.empresaId) {
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const channel = normalizeString(body?.channel).toUpperCase() as CrmContactChannel
    const status = (normalizeString(body?.status).toUpperCase() || 'GRANTED') as CrmConsentStatus
    const source = normalizeString(body?.source) || 'manual'

    if (!CHANNELS.includes(channel)) {
      return NextResponse.json({ error: 'channel inválido' }, { status: 400 })
    }
    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }

    const now = new Date()
    const consent = await prisma.crmContactConsent.upsert({
      where: { contactId_channel: { contactId: contact.id, channel } },
      create: {
        empresaId: access.empresaId,
        contactId: contact.id,
        channel,
        status,
        source,
        grantedAt: status === 'GRANTED' ? now : null,
        revokedAt: status === 'REVOKED' ? now : null,
        evidenceJson: { registeredByUserId: access.userId },
      },
      update: {
        status,
        source,
        grantedAt: status === 'GRANTED' ? now : null,
        revokedAt: status === 'REVOKED' ? now : null,
        evidenceJson: { registeredByUserId: access.userId },
      },
    })

    if (status === 'REVOKED') {
      await prisma.crmLead.updateMany({
        where: { empresaId: access.empresaId, contactId: contact.id, lifecycleStatus: { not: 'CONVERTED' } },
        data: { lifecycleStatus: 'DO_NOT_CONTACT', noContactRequestedAt: now },
      })
    }

    return NextResponse.json({ success: true, data: consent })
  } catch (error) {
    console.error('Error registrando consentimiento:', error)
    return NextResponse.json({ error: 'Error registrando consentimiento' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return POST(request, context)
}
