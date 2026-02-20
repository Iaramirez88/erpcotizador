import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateWorkspaceCode } from '@/lib/workspace-code'

export const runtime = 'nodejs'

export async function GET() {
  let empresas = await prisma.empresa.findMany({
    select: {
      id: true,
      nombre: true,
      logo: true,
      registrationCodeHash: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Bootstrap: si la base está vacía, dejamos SGDigital por defecto.
  if (!empresas.length) {
    await prisma.empresa.upsert({
      where: { nit: '900000000-1' },
      create: {
        nombre: 'SGDigital',
        nit: '900000000-1',
        email: 'contacto@sgdigital.com',
        direccion: null,
        telefono: null,
        workspaceCode: generateWorkspaceCode(),
      },
      update: {},
      select: { id: true },
    })

    empresas = await prisma.empresa.findMany({
      select: {
        id: true,
        nombre: true,
        logo: true,
        registrationCodeHash: true,
      },
      orderBy: { createdAt: 'asc' },
    })
  }

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
