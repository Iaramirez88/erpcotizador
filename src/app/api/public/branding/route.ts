import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const empresa = await prisma.empresa.findFirst({
    select: { id: true, nombre: true, logo: true },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    ok: true,
    data: {
      empresaId: empresa?.id ?? null,
      nombre: empresa?.nombre ?? 'SGDigital',
      logo: empresa?.logo ?? null,
    },
  })
}
