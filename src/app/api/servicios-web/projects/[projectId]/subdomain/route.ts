import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateWebsiteSubdomain } from '@/lib/website-builder'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

async function loadOwnedProject(projectId: string, empresaId: string) {
  return prisma.websiteProject.findFirst({
    where: { id: projectId, empresaId },
    select: { id: true, subdomain: true },
  })
}

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project) return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })

  const validation = validateWebsiteSubdomain(request.nextUrl.searchParams.get('value'))
  if (!validation.ok) return NextResponse.json({ ok: false, available: false, error: validation.error }, { status: 400 })

  const existing = await prisma.websiteProject.findUnique({
    where: { subdomain: validation.subdomain },
    select: { id: true },
  })

  return NextResponse.json({
    ok: true,
    subdomain: validation.subdomain,
    available: !existing || existing.id === project.id,
  })
}

export async function PUT(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const guard = await requireWebsiteBuilderAccess()
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { projectId } = await context.params
  const project = await loadOwnedProject(projectId, guard.access.empresaId!)
  if (!project) return NextResponse.json({ ok: false, error: 'Sitio no encontrado.' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const validation = validateWebsiteSubdomain(body?.subdomain)
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error }, { status: 400 })

  try {
    const updated = await prisma.websiteProject.update({
      where: { id: project.id },
      data: { subdomain: validation.subdomain, updatedByUserId: guard.userId },
      select: { id: true, subdomain: true, updatedAt: true },
    })
    return NextResponse.json({ ok: true, item: { ...updated, updatedAt: updated.updatedAt.toISOString() } })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Ese subdominio ya está en uso.' }, { status: 409 })
    }
    throw error
  }
}
