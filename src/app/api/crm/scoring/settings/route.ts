import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { ensureCrmScoringRules, ensureCrmScoringSettings } from '@/lib/crm-scoring'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SCORING',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const [settings, rules] = await Promise.all([
      ensureCrmScoringSettings(prisma, access.empresaId),
      ensureCrmScoringRules(prisma, access.empresaId),
    ])

    return NextResponse.json({ success: true, data: { settings, rules } })
  } catch (error) {
    console.error('Error obteniendo configuración de scoring:', error)
    return NextResponse.json({ error: 'Error obteniendo configuración de scoring' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'SCORING',
      action: 'CONFIGURE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const warmRaw = Number(body?.warmThreshold)
    const hotRaw = Number(body?.hotThreshold)
    const active = Object.prototype.hasOwnProperty.call(body ?? {}, 'active') ? Boolean(body?.active) : undefined

    const warmThreshold = Number.isFinite(warmRaw) ? Math.max(0, Math.trunc(warmRaw)) : null
    const hotThreshold = Number.isFinite(hotRaw) ? Math.max(0, Math.trunc(hotRaw)) : null

    if ((warmThreshold != null && hotThreshold != null) && warmThreshold >= hotThreshold) {
      return NextResponse.json(
        { error: 'warmThreshold debe ser menor que hotThreshold' },
        { status: 400 }
      )
    }

    const settings = await prisma.crmScoringSettings.upsert({
      where: { empresaId: access.empresaId },
      create: {
        empresaId: access.empresaId,
        warmThreshold: warmThreshold ?? 20,
        hotThreshold: hotThreshold ?? 50,
        active: active ?? true,
      },
      update: {
        ...(warmThreshold != null ? { warmThreshold } : {}),
        ...(hotThreshold != null ? { hotThreshold } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    })

    return NextResponse.json({ success: true, data: settings })
  } catch (error) {
    console.error('Error actualizando configuración de scoring:', error)
    return NextResponse.json({ error: 'Error actualizando configuración de scoring' }, { status: 500 })
  }
}
