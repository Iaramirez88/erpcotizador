import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireCapabilityAccess } from '@/lib/api-rbac'
import { reconcileCrmFollowUpTasks } from '@/lib/crm-follow-up'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const access = await requireCapabilityAccess({
      domain: 'CAPTACION',
      subdomain: 'COMMERCIAL_TASKS',
      action: 'EXECUTE',
      scope: 'SEDE',
    })
    if (!access.ok) return access.response

    const data = await prisma.$transaction((tx) => reconcileCrmFollowUpTasks({
      client: tx,
      empresaId: access.empresaId,
      actorUserId: access.userId,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error reconciliando seguimientos automáticos CRM:', error)
    return NextResponse.json({ error: 'Error reconciliando seguimientos automáticos CRM' }, { status: 500 })
  }
}