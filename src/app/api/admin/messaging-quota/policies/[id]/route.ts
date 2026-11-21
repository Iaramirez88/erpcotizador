import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth()
  if (!isSuperAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await context.params
  await prisma.messagingQuotaPolicy.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
