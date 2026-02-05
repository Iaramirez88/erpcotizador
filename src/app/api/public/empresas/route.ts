import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      nombre: true,
      logo: true,
      registrationCodeHash: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    ok: true,
    data: empresas.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      logo: e.logo,
      requiresAccessCode: Boolean(e.registrationCodeHash),
    })),
  })
}
