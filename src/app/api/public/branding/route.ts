import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const empresas = await prisma.empresa.findMany({
    select: { id: true, nombre: true, logo: true },
    orderBy: { createdAt: 'asc' },
    take: 2,
  })

  const empresa = empresas.length === 1 ? empresas[0] : null

  return NextResponse.json({
    ok: true,
    data: {
      empresaId: empresa?.id ?? null,
      nombre: empresa?.nombre ?? 'SGDigital',
      logo: empresa?.logo ?? null,
    },
  })
}
