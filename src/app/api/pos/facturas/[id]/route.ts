import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

async function getOrCreateEmpresaIdForUser(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  const empresa = await getOrCreateDefaultEmpresa()
  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireApiAccess('POS' as ModuleKey, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getOrCreateEmpresaIdForUser(access.userId)
    const { id } = await ctx.params

    const invoice = await prisma.posInvoice.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        empresaId: true,
        sedeId: true,
        clienteNombre: true,
        clienteDocumento: true,
        ivaPct: true,
        subtotal: true,
        iva: true,
        total: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        warehouse: { select: { id: true, nombre: true, codigo: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            descripcion: true,
            quantity: true,
            unitPrice: true,
            total: true,
            material: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
        payments: {
          orderBy: { receivedAt: 'asc' },
          select: { id: true, method: true, amount: true, note: true, receivedAt: true },
        },
        returns: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, numero: true, total: true, createdAt: true },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!invoice || invoice.empresaId !== empresaId || invoice.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: invoice })
  } catch (error) {
    console.error('Error al obtener factura POS:', error)
    return NextResponse.json({ error: 'Error al obtener factura POS' }, { status: 500 })
  }
}
