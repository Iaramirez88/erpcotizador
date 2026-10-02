import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'
import { serializeWebsiteProjectDomain, validateWebsiteCustomHostname } from '@/lib/website-domains-server'

export const runtime = 'nodejs'

async function loadOwnedProject(projectId: string, empresaId: string) {
  return prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId },
    select: { id: true },
  })
}

export async function GET(_request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project) return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })

  const domains = await prisma.websiteProjectDomain.findMany({
    where: { websiteProjectId: project.id, status: { not: 'DISCONNECTED' } },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  })

  return NextResponse.json({ ok: true, items: domains.map(serializeWebsiteProjectDomain) })
}

export async function POST(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project) return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const validation = validateWebsiteCustomHostname(body?.hostname)
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })

  const activeCount = await prisma.websiteProjectDomain.count({
    where: { websiteProjectId: project.id, status: { not: 'DISCONNECTED' } },
  })
  if (activeCount >= 10) {
    return NextResponse.json({ ok: false, error: 'Este sitio alcanzó el límite de 10 dominios conectados.' }, { status: 409 })
  }

  const existing = await prisma.websiteProjectDomain.findUnique({ where: { hostname: validation.hostname } })
  if (existing && existing.websiteProjectId !== project.id && (!existing.quarantineUntil || existing.quarantineUntil > new Date())) {
    return NextResponse.json({ ok: false, error: 'Este dominio está conectado o en período de protección.' }, { status: 409 })
  }

  const verificationToken = randomBytes(24).toString('base64url')
  const verificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  try {
    const domain = existing
      ? await prisma.websiteProjectDomain.update({
          where: { id: existing.id },
          data: {
            websiteProjectId: project.id,
            status: 'PENDING_VERIFICATION',
            verificationToken,
            verificationExpiresAt,
            verifiedAt: null,
            dnsStatus: 'PENDING',
            sslStatus: 'PENDING',
            isPrimary: false,
            lastCheckedAt: null,
            failureReason: null,
            disconnectedAt: null,
            quarantineUntil: null,
          },
        })
      : await prisma.websiteProjectDomain.create({
          data: { websiteProjectId: project.id, hostname: validation.hostname, verificationToken, verificationExpiresAt },
        })

    return NextResponse.json({ ok: true, item: serializeWebsiteProjectDomain(domain) }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Este dominio ya está conectado.' }, { status: 409 })
    }
    throw error
  }
}