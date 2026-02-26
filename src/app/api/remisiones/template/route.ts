import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_REMISION_TEMPLATE, mergeRemisionTemplateSettings } from '@/lib/remision-template'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const template = await prisma.remisionTemplate.findUnique({
      where: { userId: session.user.id },
    })

    if (!template) {
      return NextResponse.json({ settings: mergeRemisionTemplateSettings(DEFAULT_REMISION_TEMPLATE) })
    }

    return NextResponse.json({ settings: mergeRemisionTemplateSettings(template.settings) })
  } catch (error) {
    console.error('Error al cargar plantilla:', error)
    return NextResponse.json({ error: 'Error al cargar plantilla' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { settings } = await request.json()
    const normalized = mergeRemisionTemplateSettings(settings)

    const template = await prisma.remisionTemplate.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        settings: normalized,
      },
      update: {
        settings: normalized,
      },
    })

    return NextResponse.json({ success: true, settings: mergeRemisionTemplateSettings(template.settings) })
  } catch (error) {
    console.error('Error al guardar plantilla:', error)
    return NextResponse.json({ error: 'Error al guardar plantilla' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await prisma.remisionTemplate.delete({
      where: { userId: session.user.id },
    }).catch(() => {
      // Si no existe, no pasa nada
    })

    return NextResponse.json({ success: true, settings: mergeRemisionTemplateSettings(DEFAULT_REMISION_TEMPLATE) })
  } catch (error) {
    console.error('Error al resetear plantilla:', error)
    return NextResponse.json({ error: 'Error al resetear plantilla' }, { status: 500 })
  }
}
