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

    const ret = await prisma.posReturn.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        empresaId: true,
        sedeId: true,
        motivo: true,
        ivaPct: true,
        subtotal: true,
        iva: true,
        total: true,
        createdAt: true,
        invoice: { select: { id: true, numero: true } },
        warehouse: { select: { id: true, nombre: true, codigo: true } },
        items: {
          select: {
            id: true,
            descripcion: true,
            quantity: true,
            unitPrice: true,
            total: true,
            material: { select: { id: true, nombre: true, unidadMedida: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!ret || ret.empresaId !== empresaId || ret.sedeId !== access.sedeId) {
      return NextResponse.json({ error: 'Devolución no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: ret })
  } catch (error) {
    console.error('Error al obtener devolución POS:', error)
    return NextResponse.json({ error: 'Error al obtener devolución POS' }, { status: 500 })
  }
}
