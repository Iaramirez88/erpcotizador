import { NextResponse } from 'next/server'
import { ModuleKey, Prisma, ProductCustomFieldType, TipoMaterial } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function normalizeOptions(value: unknown) {
  return Array.isArray(value)
    ? value.map((option) => String(option || '').trim()).filter(Boolean)
    : []
}

function isTipoMaterial(value: unknown): value is TipoMaterial {
  return typeof value === 'string' && value in TipoMaterial
}

function isCustomFieldType(value: unknown): value is ProductCustomFieldType {
  return typeof value === 'string' && value in ProductCustomFieldType
}

function handleConfigError(error: unknown, fallbackMessage: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ success: false, error: 'Ya existe un registro con ese nombre o clave' }, { status: 409 })
  }

  console.error(fallbackMessage, error)
  return NextResponse.json({ success: false, error: fallbackMessage }, { status: 500 })
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const [typeOptions, categoryOptions, customFields] = await Promise.all([
      prisma.productTypeOption.findMany({
        where: { empresaId: access.empresaId, activo: true },
        orderBy: [{ nombre: 'asc' }],
      }),
      prisma.productCategoryOption.findMany({
        where: { empresaId: access.empresaId, activo: true },
        orderBy: [{ nombre: 'asc' }],
      }),
      prisma.productCustomFieldDefinition.findMany({
        where: { empresaId: access.empresaId, activo: true },
        orderBy: [{ label: 'asc' }],
      }),
    ])

    return NextResponse.json({
      success: true,
      data: { typeOptions, categoryOptions, customFields },
    })
  } catch (error) {
    console.error('Error al obtener configuración de productos:', error)
    return NextResponse.json({ success: false, error: 'Error al obtener configuración de productos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => ({})) as {
      entity?: 'typeOption' | 'categoryOption' | 'customField'
      nombre?: string
      baseTipo?: TipoMaterial
      label?: string
      key?: string
      fieldType?: ProductCustomFieldType
      helpText?: string
      required?: boolean
      options?: string[]
    }

    if (body.entity === 'typeOption') {
      const nombre = String(body.nombre || '').trim()
      const baseTipo = isTipoMaterial(body.baseTipo) ? body.baseTipo : TipoMaterial.OTRO
      if (!nombre) {
        return NextResponse.json({ success: false, error: 'El nombre del tipo es requerido' }, { status: 400 })
      }

      const created = await prisma.productTypeOption.create({
        data: {
          empresaId: access.empresaId,
          nombre,
          baseTipo,
        },
      })

      return NextResponse.json({ success: true, data: created }, { status: 201 })
    }

    if (body.entity === 'categoryOption') {
      const nombre = String(body.nombre || '').trim()
      if (!nombre) {
        return NextResponse.json({ success: false, error: 'El nombre de la categoría es requerido' }, { status: 400 })
      }

      const created = await prisma.productCategoryOption.create({
        data: {
          empresaId: access.empresaId,
          nombre,
        },
      })

      return NextResponse.json({ success: true, data: created }, { status: 201 })
    }

    if (body.entity === 'customField') {
      const label = String(body.label || '').trim()
      const key = String(body.key || '').trim() || slugify(label)
      const fieldType = isCustomFieldType(body.fieldType)
        ? body.fieldType
        : ProductCustomFieldType.TEXT

      if (!label || !key) {
        return NextResponse.json({ success: false, error: 'Etiqueta y clave del campo son requeridas' }, { status: 400 })
      }

      const options = normalizeOptions(body.options)

      const created = await prisma.productCustomFieldDefinition.create({
        data: {
          empresaId: access.empresaId,
          key,
          label,
          fieldType,
          helpText: String(body.helpText || '').trim() || null,
          required: body.required === true,
          optionsJson: options.length ? options : undefined,
        },
      })

      return NextResponse.json({ success: true, data: created }, { status: 201 })
    }

    return NextResponse.json({ success: false, error: 'Entidad inválida' }, { status: 400 })
  } catch (error) {
    return handleConfigError(error, 'Error al guardar configuración de productos')
  }
}

export async function PUT(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => ({})) as {
      entity?: 'typeOption' | 'categoryOption' | 'customField'
      id?: string
      nombre?: string
      baseTipo?: TipoMaterial
      label?: string
      fieldType?: ProductCustomFieldType
      helpText?: string
      required?: boolean
      options?: string[]
    }

    const id = String(body.id || '').trim()
    if (!id) {
      return NextResponse.json({ success: false, error: 'El id es requerido' }, { status: 400 })
    }

    if (body.entity === 'typeOption') {
      const nombre = String(body.nombre || '').trim()
      const baseTipo = isTipoMaterial(body.baseTipo) ? body.baseTipo : TipoMaterial.OTRO
      if (!nombre) {
        return NextResponse.json({ success: false, error: 'El nombre del tipo es requerido' }, { status: 400 })
      }

      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.productTypeOption.findFirst({
          where: { id, empresaId: access.empresaId },
          select: { id: true, nombre: true },
        })

        if (!current) return null

        const row = await tx.productTypeOption.update({
          where: { id: current.id },
          data: { nombre, baseTipo },
        })

        await tx.material.updateMany({
          where: { empresaId: access.empresaId, tipoNombre: current.nombre },
          data: {
            tipoNombre: nombre,
            tipo: baseTipo,
          },
        })

        return row
      })

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Tipo no encontrado' }, { status: 404 })
      }

      return NextResponse.json({ success: true, data: updated })
    }

    if (body.entity === 'categoryOption') {
      const nombre = String(body.nombre || '').trim()
      if (!nombre) {
        return NextResponse.json({ success: false, error: 'El nombre de la categoría es requerido' }, { status: 400 })
      }

      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.productCategoryOption.findFirst({
          where: { id, empresaId: access.empresaId },
          select: { id: true, nombre: true },
        })

        if (!current) return null

        const row = await tx.productCategoryOption.update({
          where: { id: current.id },
          data: { nombre },
        })

        await tx.material.updateMany({
          where: { empresaId: access.empresaId, categoria: current.nombre },
          data: { categoria: nombre },
        })

        return row
      })

      if (!updated) {
        return NextResponse.json({ success: false, error: 'Categoría no encontrada' }, { status: 404 })
      }

      return NextResponse.json({ success: true, data: updated })
    }

    if (body.entity === 'customField') {
      const label = String(body.label || '').trim()
      const fieldType = isCustomFieldType(body.fieldType) ? body.fieldType : ProductCustomFieldType.TEXT
      if (!label) {
        return NextResponse.json({ success: false, error: 'La etiqueta del campo es requerida' }, { status: 400 })
      }

      const options = normalizeOptions(body.options)

      const updated = await prisma.productCustomFieldDefinition.updateMany({
        where: { id, empresaId: access.empresaId },
        data: {
          label,
          fieldType,
          helpText: String(body.helpText || '').trim() || null,
          required: body.required === true,
          optionsJson: options.length ? options : Prisma.JsonNull,
        },
      })

      if (updated.count === 0) {
        return NextResponse.json({ success: false, error: 'Campo no encontrado' }, { status: 404 })
      }

      const row = await prisma.productCustomFieldDefinition.findFirst({
        where: { id, empresaId: access.empresaId },
      })

      return NextResponse.json({ success: true, data: row })
    }

    return NextResponse.json({ success: false, error: 'Entidad inválida' }, { status: 400 })
  } catch (error) {
    return handleConfigError(error, 'Error al actualizar configuración de productos')
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => ({})) as {
      entity?: 'typeOption' | 'categoryOption' | 'customField'
      id?: string
    }

    const id = String(body.id || '').trim()
    if (!id) {
      return NextResponse.json({ success: false, error: 'El id es requerido' }, { status: 400 })
    }

    if (body.entity === 'typeOption') {
      await prisma.productTypeOption.deleteMany({ where: { id, empresaId: access.empresaId } })
      return NextResponse.json({ success: true })
    }

    if (body.entity === 'categoryOption') {
      await prisma.productCategoryOption.deleteMany({ where: { id, empresaId: access.empresaId } })
      return NextResponse.json({ success: true })
    }

    if (body.entity === 'customField') {
      await prisma.productCustomFieldDefinition.deleteMany({ where: { id, empresaId: access.empresaId } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Entidad inválida' }, { status: 400 })
  } catch (error) {
    console.error('Error al borrar configuración de productos:', error)
    return NextResponse.json({ success: false, error: 'Error al borrar configuración de productos' }, { status: 500 })
  }
}
