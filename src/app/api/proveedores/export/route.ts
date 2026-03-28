import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import { buildXlsxBuffer, formatDateForFilename } from '@/lib/excel-export'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.PROVEEDORES, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get('search') || '').trim()
    const activo = searchParams.get('activo')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { nit: { contains: search, mode: 'insensitive' as const } },
        { telefono: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (activo !== null && activo !== undefined && activo !== '') {
      where.activo = activo === 'true'
    }

    const proveedores = await prisma.proveedor.findMany({
      where,
      orderBy: { nombre: 'asc' },
      take: 5000,
    })

    const rows = proveedores.map((p) => ({
      ID: p.id,
      Nombre: p.nombre,
      NIT: p.nit ?? '',
      Telefono: p.telefono ?? '',
      Email: p.email ?? '',
      Contacto: p.contacto ?? '',
      Direccion: p.direccion ?? '',
      Ciudad: p.ciudad ?? '',
      Departamento: p.departamento ?? '',
      Observaciones: p.observaciones ?? '',
      Activo: p.activo ? 'SI' : 'NO',
      Creado: p.createdAt,
    }))

    const buffer = await buildXlsxBuffer([{ name: 'Proveedores', rows }])
    const filename = `proveedores-${formatDateForFilename()}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando proveedores:', error)
    return NextResponse.json({ success: false, error: 'Error exportando proveedores' }, { status: 500 })
  }
}
