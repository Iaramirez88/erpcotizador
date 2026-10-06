import { NextResponse } from 'next/server'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { normalizeString } from '@/lib/crm'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

function normalizeDomain(value: unknown) {
  const raw = normalizeString(value).toLowerCase()
  if (!raw) return ''
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'CREATE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const domain = normalizeDomain(body?.domain)
    const keyword = normalizeString(body?.keyword).slice(0, 200)
    const websiteProjectId = normalizeString(body?.websiteProjectId) || null
    const country = (normalizeString(body?.country) || 'COL').toUpperCase().slice(0, 3)
    const locationCodeValue = Number(body?.locationCode)
    const locationCode = Number.isSafeInteger(locationCodeValue) && locationCodeValue > 0 ? locationCodeValue : null
    const locationName = normalizeString(body?.locationName).slice(0, 160) || null
    const language = (normalizeString(body?.language) || 'es').toLowerCase().slice(0, 10)
    const device = normalizeString(body?.device) === 'MOBILE' ? 'MOBILE' : 'DESKTOP'
    const searchIntent = (normalizeString(body?.searchIntent) || 'COMMERCIAL').toUpperCase().slice(0, 40)
    const serviceType = normalizeString(body?.serviceType).slice(0, 160) || null

    if (!domain || !keyword) {
      return NextResponse.json({ error: 'Dominio y palabra clave son obligatorios.' }, { status: 400 })
    }

    if (websiteProjectId) {
      const website = await prisma.websiteProject.findFirst({ where: { id: websiteProjectId, empresaId: access.empresaId }, select: { id: true } })
      if (!website) return NextResponse.json({ error: 'El sitio web no pertenece a esta empresa.' }, { status: 404 })
    }

    const row = await prisma.crmSeoKeyword.upsert({
      where: {
        empresaId_domain_keyword_country_device: {
          empresaId: access.empresaId,
          domain,
          keyword,
          country,
          device,
        },
      },
      update: { active: true, websiteProjectId, locationCode, locationName, language, searchIntent, serviceType },
      create: {
        empresaId: access.empresaId,
        websiteProjectId,
        domain,
        keyword,
        country,
        locationCode,
        locationName,
        language,
        device,
        searchIntent,
        serviceType,
      },
    })

    return NextResponse.json({ success: true, data: row })
  } catch (error) {
    console.error('Error creando palabra clave SEO:', error)
    return NextResponse.json({ error: 'No se pudo guardar la palabra clave.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'CHANNELS',
      action: 'DELETE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const id = normalizeString(new URL(request.url).searchParams.get('id'))
    const result = await prisma.crmSeoKeyword.deleteMany({ where: { id, empresaId: access.empresaId } })
    if (!result.count) return NextResponse.json({ error: 'Palabra clave no encontrada.' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando palabra clave SEO:', error)
    return NextResponse.json({ error: 'No se pudo eliminar la palabra clave.' }, { status: 500 })
  }
}
