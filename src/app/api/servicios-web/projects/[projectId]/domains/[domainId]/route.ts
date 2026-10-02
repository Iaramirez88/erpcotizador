import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'
import { serializeWebsiteProjectDomain } from '@/lib/website-domains-server'

export const runtime = 'nodejs'

async function loadOwnedDomain(projectId: string, domainId: string, empresaId: string) {
  return prisma.websiteProjectDomain.findFirst({
    where: { id: domainId, websiteProjectId: projectId, websiteProject: { empresaId }, status: { not: 'DISCONNECTED' } },
  })
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ projectId: string; domainId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId, domainId } = await context.params
  const domain = await loadOwnedDomain(projectId, domainId, guard.access.empresaId!)
  if (!domain) return NextResponse.json({ ok: false, error: 'Dominio no encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action ?? '').toUpperCase()

  if (action === 'SET_PRIMARY') {
    if (domain.status !== 'ACTIVE') {
      return NextResponse.json({ ok: false, error: 'Verifica el dominio antes de seleccionarlo como principal.' }, { status: 409 })
    }
    const updated = await prisma.$transaction(async (tx) => {
      await tx.websiteProjectDomain.updateMany({ where: { websiteProjectId: projectId, isPrimary: true }, data: { isPrimary: false } })
      const current = await tx.websiteProjectDomain.update({ where: { id: domain.id }, data: { isPrimary: true } })
      await tx.websiteProject.update({
        where: { id: projectId },
        data: { primaryDomain: domain.hostname, updatedByUserId: guard.userId },
      })
      return current
    })
    return NextResponse.json({ ok: true, item: serializeWebsiteProjectDomain(updated) })
  }

  if (action === 'ROTATE_VERIFICATION') {
    const updated = await prisma.websiteProjectDomain.update({
      where: { id: domain.id },
      data: {
        status: 'PENDING_VERIFICATION',
        verificationToken: randomBytes(24).toString('base64url'),
        verificationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        verifiedAt: null,
        dnsStatus: 'PENDING',
        sslStatus: 'PENDING',
        isPrimary: false,
        lastCheckedAt: null,
        failureReason: null,
      },
    })
    if (domain.isPrimary) {
      await prisma.websiteProject.update({ where: { id: projectId }, data: { primaryDomain: null, updatedByUserId: guard.userId } })
    }
    return NextResponse.json({ ok: true, item: serializeWebsiteProjectDomain(updated) })
  }

  return NextResponse.json({ ok: false, error: 'Acción no válida.' }, { status: 400 })
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ projectId: string; domainId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId, domainId } = await context.params
  const domain = await loadOwnedDomain(projectId, domainId, guard.access.empresaId!)
  if (!domain) return NextResponse.json({ ok: false, error: 'Dominio no encontrado.' }, { status: 404 })

  await prisma.$transaction([
    prisma.websiteProjectDomain.update({
      where: { id: domain.id },
      data: {
        status: 'DISCONNECTED',
        dnsStatus: 'DISCONNECTED',
        sslStatus: 'DISCONNECTED',
        isPrimary: false,
        disconnectedAt: new Date(),
        quarantineUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.websiteProject.update({
      where: { id: projectId },
      data: domain.isPrimary ? { primaryDomain: null, updatedByUserId: guard.userId } : { updatedByUserId: guard.userId },
    }),
  ])

  return NextResponse.json({ ok: true, disconnectedId: domain.id })
}