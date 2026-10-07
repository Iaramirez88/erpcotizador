import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { normalizeString } from '@/lib/crm'
import { prisma } from '@/lib/prisma'
import { assertPublicHttpUrl } from '@/lib/public-http'
import { slugifyWebsiteBuilderValue } from '@/lib/website-builder'
import { requireWebsiteBuilderAccess } from '@/lib/website-builder-server'

export const runtime = 'nodejs'

async function uniqueTrackingSlug(empresaId: string, value: string) {
  const base = `seo-${slugifyWebsiteBuilderValue(value)}`.slice(0, 100)
  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`
    const exists = await prisma.websiteProject.findFirst({ where: { empresaId, slug }, select: { id: true } })
    if (!exists) return slug
  }
  return `${base.slice(0, 80)}-${Date.now()}`
}

export async function POST(request: Request) {
  try {
    const guard = await requireWebsiteBuilderAccess()
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status })
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const requestedUrl = normalizeString(body?.siteUrl)
    const publicUrl = await assertPublicHttpUrl(requestedUrl)
    const siteUrl = publicUrl.toString()
    const nombre = normalizeString(body?.nombre).slice(0, 160) || publicUrl.hostname
    const requestedProperty = normalizeString(body?.searchConsoleSiteUrl).slice(0, 2048)
    const searchConsoleSiteUrl = requestedProperty || `sc-domain:${publicUrl.hostname.replace(/^www\./, '')}`
    if (requestedProperty && !requestedProperty.startsWith('sc-domain:')) await assertPublicHttpUrl(requestedProperty)
    const slug = await uniqueTrackingSlug(guard.access.empresaId!, `${publicUrl.hostname}-${publicUrl.pathname}-${nombre}`)
    const project = await prisma.websiteProject.create({
      data: {
        empresaId: guard.access.empresaId!,
        nombre,
        slug,
        subdomain: null,
        primaryDomain: publicUrl.hostname,
        status: 'ACTIVE',
        trackingOnly: true,
        seoJson: { siteUrl, searchConsoleSiteUrl, externalTracking: true, createdAt: new Date().toISOString() } as Prisma.InputJsonValue,
        createdByUserId: guard.userId,
        updatedByUserId: guard.userId,
      },
      select: { id: true, nombre: true, primaryDomain: true, status: true, seoJson: true },
    })
    return NextResponse.json({ success: true, data: project }, { status: 201 })
  } catch (error) {
    console.error('Error registrando sitio SEO externo:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo registrar la URL externa.' }, { status: 400 })
  }
}