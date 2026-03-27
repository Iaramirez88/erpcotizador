import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { requireApiAccess } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { DEFAULT_POS_INVOICE_TEMPLATE, mergePosInvoiceTemplateSettings } from '@/lib/pos-invoice-template'

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'READ')
    if (!access.ok) return access.response

    const template = await prisma.posInvoiceTemplate.findUnique({ where: { userId: access.userId } })
    if (!template) {
      return NextResponse.json({ settings: mergePosInvoiceTemplateSettings(DEFAULT_POS_INVOICE_TEMPLATE) })
    }

    return NextResponse.json({ settings: mergePosInvoiceTemplateSettings(template.settings) })
  } catch (error) {
    console.error('Error al cargar plantilla POS:', error)
    return NextResponse.json({ error: 'Error al cargar plantilla' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'WRITE')
    if (!access.ok) return access.response

    const { settings } = await request.json()
    const normalized = mergePosInvoiceTemplateSettings(settings)

    const template = await prisma.posInvoiceTemplate.upsert({
      where: { userId: access.userId },
      create: { userId: access.userId, settings: normalized },
      update: { settings: normalized },
    })

    return NextResponse.json({ success: true, settings: mergePosInvoiceTemplateSettings(template.settings) })
  } catch (error) {
    console.error('Error al guardar plantilla POS:', error)
    return NextResponse.json({ error: 'Error al guardar plantilla' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const access = await requireApiAccess(ModuleKey.POS, 'WRITE')
    if (!access.ok) return access.response

    await prisma.posInvoiceTemplate.delete({ where: { userId: access.userId } }).catch(() => {})

    return NextResponse.json({ success: true, settings: mergePosInvoiceTemplateSettings(DEFAULT_POS_INVOICE_TEMPLATE) })
  } catch (error) {
    console.error('Error al resetear plantilla POS:', error)
    return NextResponse.json({ error: 'Error al resetear plantilla' }, { status: 500 })
  }
}