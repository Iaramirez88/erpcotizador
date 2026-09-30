import { NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.ORDENES, 'READ')
    if (!access.ok) return access.response

    const clientes = await prisma.cliente.findMany({
      where: {
        empresaId: access.empresaId,
        OR: [{ sedeId: access.sedeId }, { sedeId: null }],
      },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        documento: true,
      },
    })

    return NextResponse.json({ success: true, data: clientes })
  } catch (error) {
    console.error('Error al listar clientes para órdenes:', error)
    return NextResponse.json({ success: false, error: 'No se pudieron cargar los clientes.' }, { status: 500 })
  }
}
