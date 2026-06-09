import { NextResponse } from 'next/server'
import { } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import {
  ensureCrmStageSettings,
  normalizeString,
  parseOptionalInt,
  parseOpportunityStage,
} from '@/lib/crm'

export const runtime = 'nodejs'

function normalizeColor(value: unknown): string | null {
  const color = normalizeString(value)
  return color || null
}

export async function GET() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'OPPORTUNITIES',
      action: 'READ',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const rows = await ensureCrmStageSettings(prisma, access.empresaId)
    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    console.error('Error listando stages CRM:', error)
    return NextResponse.json({ error: 'Error listando stages CRM' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'OPPORTUNITIES',
      action: 'CONFIGURE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as { stages?: Array<Record<string, unknown>> } | null
    const stageRows = Array.isArray(body?.stages) ? body?.stages : null
    if (!stageRows?.length) {
      return NextResponse.json({ error: 'stages es requerido' }, { status: 400 })
    }

    const seen = new Set<string>()
    const parsed = stageRows.map((row) => {
      const key = parseOpportunityStage(row?.key)
      const label = normalizeString(row?.label)
      const sortOrder = parseOptionalInt(row?.sortOrder)
      const color = normalizeColor(row?.color)

      if (!key) throw new Error('STAGE_INVALID')
      if (!label) throw new Error('LABEL_REQUIRED')
      if (sortOrder === undefined || sortOrder === null) throw new Error('SORT_ORDER_INVALID')
      if (seen.has(key)) throw new Error('STAGE_DUPLICATED')
      seen.add(key)

      return { key, label, sortOrder, color }
    })

    const rows = await prisma.$transaction(async (tx) => {
      await ensureCrmStageSettings(tx, access.empresaId)

      for (const row of parsed) {
        await tx.crmStageSetting.upsert({
          where: { empresaId_key: { empresaId: access.empresaId, key: row.key } },
          create: {
            empresaId: access.empresaId,
            key: row.key,
            label: row.label,
            sortOrder: row.sortOrder,
            color: row.color,
          },
          update: {
            label: row.label,
            sortOrder: row.sortOrder,
            color: row.color,
          },
        })
      }

      return tx.crmStageSetting.findMany({
        where: { empresaId: access.empresaId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
    })

    return NextResponse.json({ success: true, data: rows })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'STAGE_INVALID') {
        return NextResponse.json({ error: 'Hay una etapa inválida en stages' }, { status: 400 })
      }
      if (error.message === 'LABEL_REQUIRED') {
        return NextResponse.json({ error: 'Cada etapa requiere label' }, { status: 400 })
      }
      if (error.message === 'SORT_ORDER_INVALID') {
        return NextResponse.json({ error: 'Cada etapa requiere sortOrder entero' }, { status: 400 })
      }
      if (error.message === 'STAGE_DUPLICATED') {
        return NextResponse.json({ error: 'No se permiten etapas duplicadas' }, { status: 400 })
      }
    }

    console.error('Error actualizando stages CRM:', error)
    return NextResponse.json({ error: 'Error actualizando stages CRM' }, { status: 500 })
  }
}