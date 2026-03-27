import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { DEFAULT_ORDEN_COMPRA_TEMPLATE, mergeOrdenCompraTemplateSettings } from '@/lib/orden-compra-template'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const template = await prisma.ordenCompraTemplate.findUnique({
      where: { userId: session.user.id },
    })

    if (!template) {
      return NextResponse.json({ settings: mergeOrdenCompraTemplateSettings(DEFAULT_ORDEN_COMPRA_TEMPLATE) })
    }

    return NextResponse.json({ settings: mergeOrdenCompraTemplateSettings(template.settings) })
  } catch (error) {
    console.error('Error al cargar plantilla de orden de compra:', error)
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
    const normalized = mergeOrdenCompraTemplateSettings(settings)

    const template = await prisma.ordenCompraTemplate.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        settings: normalized,
      },
      update: {
        settings: normalized,
      },
    })

    return NextResponse.json({ success: true, settings: mergeOrdenCompraTemplateSettings(template.settings) })
  } catch (error) {
    console.error('Error al guardar plantilla de orden de compra:', error)
    return NextResponse.json({ error: 'Error al guardar plantilla' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await prisma.ordenCompraTemplate.delete({
      where: { userId: session.user.id },
    }).catch(() => {
      // Si no existe, no pasa nada.
    })

    return NextResponse.json({ success: true, settings: mergeOrdenCompraTemplateSettings(DEFAULT_ORDEN_COMPRA_TEMPLATE) })
  } catch (error) {
    console.error('Error al resetear plantilla de orden de compra:', error)
    return NextResponse.json({ error: 'Error al resetear plantilla' }, { status: 500 })
  }
}