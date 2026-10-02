import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforcePublicActionRateLimit } from '@/lib/public-form-security'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'
import { serializeWebsiteProjectDomain, verifyWebsiteDomainDns } from '@/lib/website-domains-server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest, context: { params: Promise<{ projectId: string; domainId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId, domainId } = await context.params
  const rateLimit = await enforcePublicActionRateLimit({
    request,
    scope: 'website-domain-verification',
    identifier: `${guard.userId}:${domainId}`,
    limit: 10,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas comprobaciones. Espera un momento antes de intentarlo nuevamente.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
    )
  }

  const domain = await prisma.websiteProjectDomain.findFirst({
    where: { id: domainId, websiteProjectId: projectId, websiteProject: { empresaId: guard.access.empresaId! }, status: { not: 'DISCONNECTED' } },
  })
  if (!domain) return NextResponse.json({ ok: false, error: 'Dominio no encontrado.' }, { status: 404 })
  if (domain.verificationExpiresAt <= new Date()) {
    return NextResponse.json({ ok: false, error: 'La verificación venció. Genera un nuevo registro TXT.' }, { status: 410 })
  }

  const result = await verifyWebsiteDomainDns(domain.hostname, domain.verificationToken)
  const status = !result.ownershipVerified ? 'PENDING_VERIFICATION' : result.routingVerified ? 'ACTIVE' : 'PENDING_DNS'
  const failureReason = !result.ownershipVerified
    ? 'No encontramos el registro TXT de propiedad.'
    : !result.routingConfigured
      ? 'Ordex no tiene configurado un destino DNS para dominios personalizados.'
      : !result.routingVerified
        ? 'El dominio todavía no apunta al destino DNS de Ordex.'
        : null

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.websiteProjectDomain.update({
      where: { id: domain.id },
      data: {
        status,
        verifiedAt: result.ownershipVerified ? domain.verifiedAt ?? new Date() : null,
        dnsStatus: result.routingVerified ? 'VERIFIED' : 'PENDING',
        sslStatus: result.routingVerified ? 'PENDING' : 'PENDING',
        lastCheckedAt: new Date(),
        failureReason,
      },
    })

    if (status === 'ACTIVE') {
      const primary = await tx.websiteProjectDomain.findFirst({
        where: { websiteProjectId: projectId, isPrimary: true, status: 'ACTIVE' },
        select: { id: true },
      })
      if (!primary) {
        await tx.websiteProjectDomain.update({ where: { id: current.id }, data: { isPrimary: true } })
        await tx.websiteProject.update({
          where: { id: projectId },
          data: { primaryDomain: current.hostname, updatedByUserId: guard.userId },
        })
        return { ...current, isPrimary: true }
      }
    }

    return current
  })

  return NextResponse.json({ ok: true, item: serializeWebsiteProjectDomain(updated), verification: result })
}