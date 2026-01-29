import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'

export const runtime = 'nodejs'

type ImportModule = 'clientes' | 'proveedores' | 'materiales' | 'compras' | 'ordenes'

interface RouteContext {
  params: Promise<{ module: string }>
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function normalizeKey(key: string) {
  return key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = asString(value).trim()
  if (!s) return fallback
  // Soporta 1.234,56 / 1,234.56 / 1234
  const cleaned = s
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : fallback
}

function parseBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') return value
  const s = asString(value).trim().toLowerCase()
  if (!s) return fallback
  if (['1', 'true', 'si', 'sí', 'y', 'yes', 'activo'].includes(s)) return true
  if (['0', 'false', 'no', 'n', 'inactive', 'inactivo'].includes(s)) return false
  return fallback
}

function normalizeUnidadMedida(value: unknown) {
  const s = asString(value).trim().toLowerCase()
  if (!s) return ''
  const cleaned = s.replace(//g, '2').replace(//g, '3')
  if (['m2', 'm²', 'metro2', 'metro_cuadrado', 'metrocuadrado', 'm2s'].includes(cleaned)) return 'm2'
  if (['ml', 'm', 'metro', 'metro_lineal', 'metrolineal', 'lineal'].includes(cleaned)) return 'ml'
  if (['unidad', 'und', 'u', 'unid', 'pieza', 'pza'].includes(cleaned)) return 'unidad'
  if (['fisico', 'físico', 'producto_fisico', 'producto', 'merchandising', 'promo', 'promocional', 'promocionales'].includes(cleaned)) return 'unidad'
  if (['metraje', 'metrado', 'material', 'rollo'].includes(cleaned)) return 'm2'
  return cleaned
}

function resolveUnidadMedida(inputUnidad: unknown, tipoProducto: unknown) {
  const u = normalizeUnidadMedida(inputUnidad)
  if (u === 'm2' || u === 'ml' || u === 'unidad') return u
  const t = normalizeUnidadMedida(tipoProducto)
  if (t === 'm2' || t === 'ml' || t === 'unidad') return t
  return 'unidad'
}

async function getOrCreateEmpresaIdForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (user?.empresaId) return user.empresaId

  let empresa = await prisma.empresa.findFirst({ select: { id: true } })
  if (!empresa) {
    empresa = await prisma.empresa.create({ data: { nombre: 'SGDigital', nit: '900000000-1' }, select: { id: true } })
  }

  await prisma.user.update({ where: { id: userId }, data: { empresaId: empresa.id } }).catch(() => null)
  return empresa.id
}

function isAllowedModule(m: string): m is ImportModule {
  return ['clientes', 'proveedores', 'materiales', 'compras', 'ordenes'].includes(m)
}

function sniffExt(filename: string) {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.csv')) return 'csv'
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'xlsx'
  return ''
}

async function parseRows(file: File): Promise<{ rows: Record<string, unknown>[]; warnings: string[] }>
{
  const warnings: string[] = []
  const ext = sniffExt(file.name)
  const buf = Buffer.from(await file.arrayBuffer())

  if (ext === 'csv' || file.type.includes('csv') || file.type.includes('text')) {
    const text = buf.toString('utf8')
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true })
    if (parsed.errors?.length) {
      warnings.push(...parsed.errors.slice(0, 10).map((e) => `${e.code}: ${e.message}`))
    }
    const data = (parsed.data || []).filter((r) => r && Object.keys(r).length > 0)
    return { rows: data, warnings }
  }

  if (ext === 'xlsx') {
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) return { rows: [], warnings: ['Archivo Excel sin hojas'] }
    const ws = wb.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
    return { rows: json, warnings }
  }

  return { rows: [], warnings: ['Formato no soportado. Sube .csv o .xlsx'] }
}

function mapRow(row: Record<string, unknown>, aliases: Record<string, readonly string[]>) {
  const normalized: Record<string, unknown> = {}
  const rawEntries = Object.entries(row)
  const keyToValue: Record<string, unknown> = {}
  for (const [k, v] of rawEntries) keyToValue[normalizeKey(k)] = v

  for (const [field, keys] of Object.entries(aliases)) {
    for (const key of keys) {
      const v = keyToValue[normalizeKey(key)]
      if (v !== undefined && asString(v).trim() !== '') {
        normalized[field] = v
        break
      }
    }
  }
  return normalized
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { module: moduleParam } = await context.params
  if (!isAllowedModule(moduleParam)) {
    return NextResponse.json({ success: false, error: 'Módulo inválido' }, { status: 400 })
  }

  const moduleKey: ModuleKey =
    moduleParam === 'clientes'
      ? 'CLIENTES'
      : moduleParam === 'proveedores'
        ? 'PROVEEDORES'
        : moduleParam === 'materiales'
          ? 'MATERIALES'
          : moduleParam === 'compras'
            ? 'COMPRAS'
            : 'ORDENES'

  const access = await requireApiAccess(moduleKey, 'WRITE')
  if (!access.ok) return access.response

  const userId = access.userId

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const dryRun = String(form?.get('dryRun') ?? '').toLowerCase() === 'true'

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'Archivo requerido (file)' }, { status: 400 })
  }

  const empresaId = await getOrCreateEmpresaIdForUser(userId)

  const { rows, warnings } = await parseRows(file)
  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'No se detectaron filas para importar', warnings }, { status: 400 })
  }

  const errors: Array<{ row: number; error: string }> = []

  if (moduleParam === 'clientes') {
    const aliases = {
      nombre: ['nombre', 'cliente', 'razon_social', 'razon', 'empresa'],
      tipoDocumento: ['tipodocumento', 'tipo_documento', 'tipo'],
      documento: ['documento', 'nit', 'cedula', 'cc'],
      email: ['email', 'correo'],
      telefono: ['telefono', 'tel'],
      celular: ['celular', 'movil', 'mobile'],
      direccion: ['direccion'],
      ciudad: ['ciudad'],
      departamento: ['departamento'],
    } as const

    const data = rows
      .map((r, i) => ({ idx: i + 2, raw: r, mapped: mapRow(r, aliases) }))
      .map(({ idx, mapped }) => {
        const nombre = asString(mapped.nombre).trim()
        const documento = asString(mapped.documento).trim()
        const tipoDocumento = asString(mapped.tipoDocumento || 'NIT').trim() || 'NIT'
        if (!nombre || !documento) {
          errors.push({ row: idx, error: 'Faltan campos requeridos: nombre, documento' })
          return null
        }
        return {
          nombre,
          tipoDocumento,
          documento,
          email: asString(mapped.email).trim() || null,
          telefono: asString(mapped.telefono).trim() || null,
          celular: asString(mapped.celular).trim() || null,
          direccion: asString(mapped.direccion).trim() || null,
          ciudad: asString(mapped.ciudad).trim() || null,
          departamento: asString(mapped.departamento).trim() || null,
          empresaId,
        }
      })
      .filter(Boolean)

    if (dryRun) {
      return NextResponse.json({ success: true, data: { module: moduleParam, totalRows: rows.length, toCreate: data.length, errors, warnings } })
    }

    const result = await prisma.cliente.createMany({
      data: data as never,
      skipDuplicates: true,
    })

    return NextResponse.json({ success: true, data: { module: moduleParam, created: result.count, totalRows: rows.length, errors, warnings } })
  }

  if (moduleParam === 'proveedores') {
    const aliases = {
      nombre: ['nombre', 'proveedor', 'razon_social', 'razon'],
      nit: ['nit', 'documento', 'identificacion'],
      telefono: ['telefono', 'tel'],
      direccion: ['direccion'],
      email: ['email', 'correo'],
      contacto: ['contacto', 'persona_contacto'],
      ciudad: ['ciudad'],
      departamento: ['departamento'],
      observaciones: ['observaciones', 'notas'],
      activo: ['activo', 'estado'],
    } as const

    const data = rows
      .map((r, i) => ({ idx: i + 2, mapped: mapRow(r, aliases) }))
      .map(({ idx, mapped }) => {
        const nombre = asString(mapped.nombre).trim()
        if (!nombre) {
          errors.push({ row: idx, error: 'Falta campo requerido: nombre' })
          return null
        }
        const nit = asString(mapped.nit).trim() || null
        return {
          nombre,
          nit,
          telefono: asString(mapped.telefono).trim() || null,
          direccion: asString(mapped.direccion).trim() || null,
          email: asString(mapped.email).trim() || null,
          contacto: asString(mapped.contacto).trim() || null,
          ciudad: asString(mapped.ciudad).trim() || null,
          departamento: asString(mapped.departamento).trim() || null,
          observaciones: asString(mapped.observaciones).trim() || null,
          activo: parseBoolean(mapped.activo, true),
          empresaId,
        }
      })
      .filter(Boolean)

    if (dryRun) {
      return NextResponse.json({ success: true, data: { module: moduleParam, totalRows: rows.length, toCreate: data.length, errors, warnings } })
    }

    const result = await prisma.proveedor.createMany({
      data: data as never,
      skipDuplicates: true,
    })

    return NextResponse.json({ success: true, data: { module: moduleParam, created: result.count, totalRows: rows.length, errors, warnings } })
  }

  if (moduleParam === 'materiales') {
    const aliases = {
      nombre: ['nombre', 'material'],
      tipo: ['tipo', 'tipo_material'],
      tipoProducto: ['tipoproducto', 'tipo_producto', 'tipo_de_producto', 'modalidad', 'clase', 'producto_tipo'],
      categoria: ['categoria'],
      imagenUrl: ['imagenurl', 'imagen_url', 'imagen', 'foto', 'foto_url', 'urlimagen', 'url_imagen', 'image', 'imageurl', 'image_url'],
      ancho: ['ancho'],
      largo: ['largo'],
      espesor: ['espesor'],
      color: ['color'],
      precioM2: ['preciom2', 'precio_m2'],
      precioMetro: ['preciometro', 'precio_metro', 'precio_ml'],
      precioUnidad: ['preciounidad', 'precio_unidad'],
      precioCompra: ['preciocompra', 'precio_compra'],
      stockActual: ['stockactual', 'stock_actual'],
      stockMinimo: ['stockminimo', 'stock_minimo'],
      unidadMedida: ['unidadmedida', 'unidad_medida', 'unidad'],
      proveedor: ['proveedor'],
      observaciones: ['observaciones', 'notas'],
      activo: ['activo', 'estado'],
    } as const

    const data = rows
      .map((r, i) => ({ idx: i + 2, mapped: mapRow(r, aliases) }))
      .map(({ idx, mapped }) => {
        const nombre = asString(mapped.nombre).trim()
        const tipo = asString(mapped.tipo || 'OTRO').trim().toUpperCase()
        if (!nombre) {
          errors.push({ row: idx, error: 'Falta campo requerido: nombre' })
          return null
        }

        const unidadMedida = resolveUnidadMedida(mapped.unidadMedida, mapped.tipoProducto)

        return {
          nombre,
          tipo,
          categoria: asString(mapped.categoria).trim() || null,
          imagenUrl: asString(mapped.imagenUrl).trim() || null,
          ancho: mapped.ancho === undefined ? null : parseNumber(mapped.ancho, 0) || null,
          largo: mapped.largo === undefined ? null : parseNumber(mapped.largo, 0) || null,
          espesor: mapped.espesor === undefined ? null : parseNumber(mapped.espesor, 0) || null,
          color: asString(mapped.color).trim() || null,
          precioM2: mapped.precioM2 === undefined ? null : parseNumber(mapped.precioM2, 0) || null,
          precioMetro: mapped.precioMetro === undefined ? null : parseNumber(mapped.precioMetro, 0) || null,
          precioUnidad: mapped.precioUnidad === undefined ? null : parseNumber(mapped.precioUnidad, 0) || null,
          precioCompra: mapped.precioCompra === undefined ? null : parseNumber(mapped.precioCompra, 0) || null,
          stockActual: parseNumber(mapped.stockActual, 0),
          stockMinimo: parseNumber(mapped.stockMinimo, 0),
          unidadMedida,
          proveedor: asString(mapped.proveedor).trim() || null,
          observaciones: asString(mapped.observaciones).trim() || null,
          activo: parseBoolean(mapped.activo, true),
          empresaId,
        }
      })
      .filter(Boolean)

    if (dryRun) {
      return NextResponse.json({ success: true, data: { module: moduleParam, totalRows: rows.length, toCreate: data.length, errors, warnings } })
    }

    const result = await prisma.material.createMany({
      data: data as never,
    })

    return NextResponse.json({ success: true, data: { module: moduleParam, created: result.count, totalRows: rows.length, errors, warnings } })
  }

  if (moduleParam === 'compras') {
    const aliases = {
      fechaCompra: ['fecha', 'fecha_compra', 'fechacompra'],
      proveedorNombre: ['proveedor', 'proveedornombre', 'proveedor_nombre'],
      numeroFactura: ['numero_factura', 'factura', 'nrofactura', 'numeroFactura'],
      subtotalSinIva: ['subtotal', 'subtotal_sin_iva', 'subtotalsiniva'],
      iva: ['iva', 'impuesto', 'tax'],
      total: ['total', 'valor_total'],
      sede: ['sede'],
      observaciones: ['observaciones', 'notas'],
    } as const

    type CompraRow = {
      fechaCompra: Date
      proveedorNombre: string
      numeroFactura: string | null
      subtotalSinIva: number
      iva: number
      descuentoTotal: number
      subtotalConIva: number
      total: number
      sede: string | null
      observaciones: string | null
    }

    const data: CompraRow[] = rows
      .map((r, i) => ({ idx: i + 2, mapped: mapRow(r, aliases) }))
      .map(({ idx, mapped }) => {
        const proveedorNombre = asString(mapped.proveedorNombre).trim()
        if (!proveedorNombre) {
          errors.push({ row: idx, error: 'Falta campo requerido: proveedorNombre' })
          return null
        }

        const subtotalSinIva = parseNumber(mapped.subtotalSinIva, 0)
        const iva = parseNumber(mapped.iva, 0)
        const total = parseNumber(mapped.total, subtotalSinIva + iva)

        const fechaRaw = asString(mapped.fechaCompra).trim()
        const fechaCompra = fechaRaw ? new Date(fechaRaw) : new Date()

        return {
          fechaCompra,
          proveedorNombre,
          numeroFactura: asString(mapped.numeroFactura).trim() || null,
          subtotalSinIva,
          iva,
          descuentoTotal: 0,
          subtotalConIva: subtotalSinIva + iva,
          total,
          sede: asString(mapped.sede).trim() || null,
          observaciones: asString(mapped.observaciones).trim() || null,
        }
      })
      .filter((x): x is CompraRow => x !== null)

    if (dryRun) {
      return NextResponse.json({ success: true, data: { module: moduleParam, totalRows: rows.length, toCreate: data.length, errors, warnings } })
    }

    let created = 0
    for (const row of data) {
      const compra = await prisma.compra.create({
        data: {
          fechaCompra: row.fechaCompra,
          proveedorNombre: row.proveedorNombre,
          numeroFactura: row.numeroFactura,
          subtotalSinIva: row.subtotalSinIva,
          iva: row.iva,
          descuentoTotal: row.descuentoTotal,
          subtotalConIva: row.subtotalConIva,
          total: row.total,
          sede: row.sede,
          observaciones: row.observaciones,
          autorizado: false,
          userId,
          empresaId,
          items: {
            create: [
              {
                descripcion: (row.numeroFactura ? `Factura ${row.numeroFactura}` : 'Compra importada') as string,
                cantidad: 1,
                precioUnitario: (row.total as number) || 0,
                subtotalSinIva: (row.subtotalSinIva as number) || 0,
                iva: (row.iva as number) || 0,
                total: (row.total as number) || 0,
                orden: 0,
              },
            ],
          },
        },
        select: { id: true },
      })
      if (compra?.id) created += 1
    }

    return NextResponse.json({ success: true, data: { module: moduleParam, created, totalRows: rows.length, errors, warnings } })
  }

  // ordenes
  {
    const aliases = {
      fecha: ['fecha', 'fecha_orden'],
      clienteNombre: ['cliente', 'cliente_nombre', 'nombre_cliente'],
      clienteDocumento: ['cliente_documento', 'documento', 'nit', 'cc'],
      subtotal: ['subtotal'],
      iva: ['iva'],
      total: ['total'],
      observaciones: ['observaciones', 'notas'],
    } as const

    const data = rows
      .map((r, i) => ({ idx: i + 2, mapped: mapRow(r, aliases) }))
      .map(({ idx, mapped }) => {
        const clienteNombre = asString(mapped.clienteNombre).trim()
        const clienteDocumento = asString(mapped.clienteDocumento).trim()
        if (!clienteNombre || !clienteDocumento) {
          errors.push({ row: idx, error: 'Faltan campos requeridos: clienteNombre, clienteDocumento' })
          return null
        }

        const subtotal = parseNumber(mapped.subtotal, 0)
        const iva = parseNumber(mapped.iva, 0)
        const total = parseNumber(mapped.total, subtotal + iva)

        const fechaRaw = asString(mapped.fecha).trim()
        const fecha = fechaRaw ? new Date(fechaRaw) : new Date()

        return {
          fecha,
          clienteNombre,
          clienteDocumento,
          subtotal,
          iva,
          total,
          observaciones: asString(mapped.observaciones).trim() || null,
        }
      })
      .filter(Boolean) as Array<{
      fecha: Date
      clienteNombre: string
      clienteDocumento: string
      subtotal: number
      iva: number
      total: number
      observaciones: string | null
    }>

    if (dryRun) {
      return NextResponse.json({ success: true, data: { module: moduleParam, totalRows: rows.length, toCreate: data.length, errors, warnings } })
    }

    const empresaIdForUser = empresaId
    let created = 0
    for (const row of data) {
      const numero = await prisma.$transaction(async (tx) => {
        const last = await tx.ordenTrabajo.findFirst({ orderBy: { createdAt: 'desc' }, select: { numero: true } })
        let seq = 1
        if (last?.numero) {
          const parts = last.numero.split('-')
          const maybe = parts[1] ? Number.parseInt(parts[1], 10) : NaN
          if (Number.isFinite(maybe)) seq = maybe + 1
        }
        const next = `ORD-${String(seq).padStart(5, '0')}`

        const cliente = await tx.cliente.upsert({
          where: { documento: row.clienteDocumento },
          create: {
            nombre: row.clienteNombre,
            tipoDocumento: 'NIT',
            documento: row.clienteDocumento,
            empresaId: empresaIdForUser,
          },
          update: { nombre: row.clienteNombre },
          select: { id: true },
        })

        await tx.ordenTrabajo.create({
          data: {
            numero: next,
            fecha: row.fecha,
            clienteId: cliente.id,
            vendedorId: userId,
            subtotal: row.subtotal,
            descuento: 0,
            iva: row.iva,
            total: row.total,
            estado: 'PENDIENTE',
            observaciones: row.observaciones,
          },
          select: { id: true },
        })

        return next
      })
      if (numero) created += 1
    }

    return NextResponse.json({ success: true, data: { module: moduleParam, created, totalRows: rows.length, errors, warnings } })
  }
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { module } = await context.params
  return NextResponse.json({
    success: true,
    data: {
      module,
      supported: ['clientes', 'proveedores', 'materiales', 'compras', 'ordenes'],
      formats: ['csv', 'xlsx'],
    },
  })
}
