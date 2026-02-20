import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, Prisma } from '@prisma/client'

export const runtime = 'nodejs'

type ConfigDropdownDelegateCompat = {
  findFirst: (args: unknown) => Promise<unknown>
  findMany: (args: unknown) => Promise<unknown>
  create: (args: unknown) => Promise<{ id: string; key: string; nombre: string; descripcion: string | null; updatedAt: Date }>
}

type ConfigDropdownItemDelegateCompat = {
  createMany: (args: unknown) => Promise<unknown>
}

const prismaCompat = prisma as unknown as {
  configDropdown: ConfigDropdownDelegateCompat
  configDropdownItem: ConfigDropdownItemDelegateCompat
}

function errorToMessage(error: unknown, fallback: string) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'No se pudo inicializar Prisma (revisa la conexión a la base de datos).'
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') return 'Las tablas de dropdowns no existen en la base de datos (ejecuta migraciones).'
    if (error.code === 'P1001') return 'No se pudo conectar a la base de datos.'
    if (error.code === 'P2002') return 'Ya existe un dropdown con ese key.'
    return `${fallback} (Prisma ${error.code})`
  }
  if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`
  }
  return fallback
}

function asString(value: unknown) {
  return String(value ?? '').trim()
}

function asInt(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(num)) return fallback
  return Math.trunc(num)
}

function toKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
}

async function ensureUniqueDropdownKey(empresaId: string, baseKey: string) {
  const normalized = toKey(baseKey)
  let candidate = normalized

  // Evita bucles largos por colisiones repetidas.
  for (let i = 0; i < 50; i += 1) {
    const exists = await prismaCompat.configDropdown.findFirst({ where: { empresaId, key: candidate }, select: { id: true } })
    if (!exists) return candidate
    candidate = `${normalized}_${i + 2}`
  }

  return `${normalized}_${Date.now().toString(36)}`
}

async function getEmpresaIdFromSedeId(sedeId: string): Promise<string | null> {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'READ')
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const includeItems = request.nextUrl.searchParams.get('includeItems') === '1'

  try {
    const dropdowns = await prismaCompat.configDropdown.findMany({
      where: { empresaId },
      orderBy: [{ nombre: 'asc' }],
      select: {
        id: true,
        key: true,
        nombre: true,
        descripcion: true,
        updatedAt: true,
        items: includeItems
          ? {
              orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
              select: { id: true, value: true, label: true, meta: true, sortOrder: true, activo: true, updatedAt: true },
            }
          : false,
      },
    })

    return NextResponse.json({ ok: true, data: dropdowns })
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorToMessage(error, 'Error al cargar dropdowns') }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONFIG, 'WRITE')
  if (!access.ok) return access.response

  const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
  if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const nombre = asString(body.nombre)
  const descripcion = body.descripcion === undefined ? null : asString(body.descripcion) || null

  if (!nombre) return NextResponse.json({ ok: false, error: 'nombre es requerido' }, { status: 400 })

  const keyInput = asString(body.key)
  const desiredKey = toKey(keyInput || nombre)
  if (!desiredKey) return NextResponse.json({ ok: false, error: 'key es requerido' }, { status: 400 })
  const key = await ensureUniqueDropdownKey(empresaId, desiredKey)

  try {
    const created = await prismaCompat.configDropdown.create({
      data: { empresaId, key, nombre, descripcion },
      select: { id: true, key: true, nombre: true, descripcion: true, updatedAt: true },
    })

    const seedItems = Array.isArray(body.seedItems) ? (body.seedItems as unknown[]) : []
    if (seedItems.length) {
      const mapped = seedItems
        .map((it) => {
          if (!it || typeof it !== 'object') return null
          const obj = it as Record<string, unknown>
          const value = asString(obj.value)
          const label = asString(obj.label)
          if (!value || !label) return null
          const sortOrder = asInt(obj.sortOrder, 0)
          const activo = obj.activo === undefined ? true : Boolean(obj.activo)
          const meta = obj.meta && typeof obj.meta === 'object' ? obj.meta : undefined
          return { dropdownId: created.id, value, label, meta, sortOrder, activo }
        })
        .filter(Boolean) as Array<{ dropdownId: string; value: string; label: string; meta?: unknown; sortOrder: number; activo: boolean }>

      if (mapped.length) {
        // createMany soporta JSON en Postgres; mantenemos tipado laxo para meta.
        await prismaCompat.configDropdownItem.createMany({ data: mapped as never, skipDuplicates: true })
      }
    }

    return NextResponse.json({ ok: true, data: created })
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorToMessage(error, 'Error al crear dropdown') }, { status: 500 })
  }
}
