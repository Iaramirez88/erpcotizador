import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const userId = session.user.id

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, empresaId: true },
  })

  if (!user?.id) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  if (!user.empresaId) return NextResponse.json({ error: 'No tienes un espacio de trabajo activo' }, { status: 400 })

  const empresa = await prisma.empresa.findUnique({
    where: { id: user.empresaId },
    select: { id: true, nombre: true, nit: true },
  })

  if (!empresa?.id) return NextResponse.json({ error: 'Espacio de trabajo no encontrado' }, { status: 404 })

  // No permitir darse de baja del espacio personal (se usa como fallback del sistema).
  if (empresa.nit === `PERS-${userId}`) {
    return NextResponse.json({ error: 'No puedes darte de baja de tu espacio personal.' }, { status: 400 })
  }

  const personalNit = `PERS-${userId}`
  const personalNombre = `Espacio personal${user.email ? ` (${user.email.trim().toLowerCase()})` : ''}`

  const result = await prisma.$transaction(async (tx) => {
    const myAdmin = await tx.sedeMembership.findFirst({
      where: {
        userId,
        sede: { empresaId: empresa.id },
        role: { in: ['ADMIN', 'MANAGER'] },
      },
      select: { id: true },
    })

    if (myAdmin?.id) {
      const otherAdmin = await tx.sedeMembership.findFirst({
        where: {
          userId: { not: userId },
          sede: { empresaId: empresa.id },
          role: { in: ['ADMIN', 'MANAGER'] },
        },
        select: { id: true },
      })

      if (!otherAdmin?.id) {
        return {
          ok: false as const,
          status: 409,
          error: 'No puedes darte de baja porque eres el último ADMIN/MANAGER del espacio de trabajo. Asigna otro administrador primero.',
        }
      }
    }

    const personalEmpresa = await tx.empresa.upsert({
      where: { nit: personalNit },
      create: {
        nombre: personalNombre,
        nit: personalNit,
        email: user.email ? user.email.trim().toLowerCase() : null,
        planTier: 'BASIC',
        billingCycle: 'MONTHLY',
        planValidUntil: null,
      },
      update: {},
      select: { id: true },
    })

    // Quitar membresías y accesos del espacio actual
    await tx.teamMember.deleteMany({ where: { userId, team: { sede: { empresaId: empresa.id } } } })
    await tx.userModuleAccess.deleteMany({ where: { userId, sede: { empresaId: empresa.id } } })
    await tx.sedeMembership.deleteMany({ where: { userId, sede: { empresaId: empresa.id } } })
    await tx.userGlobalAccess.deleteMany({ where: { userId, empresaId: empresa.id } })

    // Mover al espacio personal
    await tx.user.update({ where: { id: userId }, data: { empresaId: personalEmpresa.id } })

    return {
      ok: true as const,
      personalEmpresaId: personalEmpresa.id,
    }
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(
    {
      success: true,
      message: `Te diste de baja de “${empresa.nombre}”. Ahora estás en tu espacio personal.`,
    },
    { status: 200 }
  )
}
