import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey } from '@prisma/client'
import type { CustomProductKind, Prisma, TipoMaterial } from '@prisma/client'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function asNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeUnidadMedida(value: unknown): 'm2' | 'ml' | 'unidad' {
  const u = asString(value).trim().toLowerCase()
  if (u === 'm2' || u === 'm²') return 'm2'
  if (u === 'ml' || u === 'm' || u === 'metro') return 'ml'
  return 'unidad'
}

const CUSTOM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
type CustomStatus = (typeof CUSTOM_STATUSES)[number]

const TIPOS_MATERIAL = [
  'VINILO',
  'LONA',
  'BANNER',
  'MICROPERFORADO',
  'ONE_WAY',
  'ADHESIVO',
  'PAPEL',
  'CARTULINA',
  'FOAM',
  'ACRILICO',
  'PVC',
  'OTRO',
] as const

function isTipoMaterial(value: unknown): value is TipoMaterial {
  return typeof value === 'string' && (TIPOS_MATERIAL as readonly string[]).includes(value)
}

function isCustomProductRequestStatus(value: string): value is CustomStatus {
  return (CUSTOM_STATUSES as readonly string[]).includes(value)
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.MATERIALES, 'READ')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const myMembership = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId: access.sedeId, userId: access.userId } },
      select: { role: true },
    })
    const canManageRequests = myMembership?.role === 'ADMIN' || myMembership?.role === 'MANAGER'

    const { searchParams } = new URL(req.url)
    const statusRaw = asString(searchParams.get('status')).trim().toUpperCase()
    const status = isCustomProductRequestStatus(statusRaw) ? statusRaw : null

    const where: Prisma.CustomProductRequestWhereInput = { empresaId }
    if (status) where.status = status

    if (!canManageRequests) {
      where.createdByUserId = access.userId
      where.sedeId = access.sedeId
    }

    const data = await prisma.customProductRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        createdByUser: { select: { id: true, name: true, email: true, role: true } },
        approvedByUser: { select: { id: true, name: true, email: true, role: true } },
        terminados: { include: { terminado: { select: { id: true, nombre: true } } } },
        material: { select: { id: true, nombre: true, externalId: true, isCustom: true, customOwnerUserId: true, customSedeId: true } },
      },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error listando custom product requests:', error)
    return NextResponse.json({ success: false, error: 'Error listando solicitudes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZACIONES, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = access.empresaId

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null

    const externalIdRaw = asString(body?.externalId).trim()
    const externalId = externalIdRaw ? externalIdRaw : null

    const nombre = asString(body?.nombre).trim()
    if (!nombre) return NextResponse.json({ success: false, error: 'nombre es requerido' }, { status: 400 })

    const kindRaw = asString(body?.kind).trim().toUpperCase()
    const kind: CustomProductKind | null =
      kindRaw === 'METRAJE' ? 'METRAJE' : kindRaw === 'FISICO' ? 'FISICO' : null
    if (!kind) return NextResponse.json({ success: false, error: 'kind inválido (METRAJE|FISICO)' }, { status: 400 })

    const tipoRaw = body?.tipo
    const tipo: TipoMaterial | null = isTipoMaterial(tipoRaw) ? (tipoRaw as TipoMaterial) : null
    if (!tipo) return NextResponse.json({ success: false, error: 'tipo inválido' }, { status: 400 })

    const unidadMedida = normalizeUnidadMedida(body?.unidadMedida)
    if (kind === 'METRAJE' && unidadMedida === 'unidad') {
      return NextResponse.json({ success: false, error: 'unidadMedida inválida para METRAJE (m2|ml)' }, { status: 400 })
    }
    if (kind === 'FISICO' && unidadMedida !== 'unidad') {
      return NextResponse.json({ success: false, error: 'unidadMedida inválida para FISICO (unidad)' }, { status: 400 })
    }

    const precioM2 = asNumberOrNull(body?.precioM2)
    const precioMetro = asNumberOrNull(body?.precioMetro)
    const precioUnidad = asNumberOrNull(body?.precioUnidad)

    const hasPrice =
      (unidadMedida === 'm2' && typeof precioM2 === 'number' && precioM2 > 0) ||
      (unidadMedida === 'ml' && typeof precioMetro === 'number' && precioMetro > 0) ||
      (unidadMedida === 'unidad' && typeof precioUnidad === 'number' && precioUnidad > 0)

    if (!hasPrice) {
      return NextResponse.json({ success: false, error: 'Debes indicar un precio válido según la unidad de cobro.' }, { status: 400 })
    }

    const terminadosIds = Array.isArray(body?.terminadosIds) ? (body!.terminadosIds as unknown[]) : []
    const terminados = terminadosIds
      .map((x) => asString(x).trim())
      .filter((x) => x)

    const created = await prisma.$transaction(async (tx) => {
      const data = {
          empresaId,
          sedeId: access.sedeId,
          createdByUserId: access.userId,
          externalId,
          nombre,
          kind,
          tipo,
          unidadMedida,
          categoria: asString(body?.categoria).trim() || null,
          proveedor: asString(body?.proveedor).trim() || null,
          observaciones: asString(body?.observaciones).trim() || null,
          ancho: asNumberOrNull(body?.ancho),
          largo: asNumberOrNull(body?.largo),
          precioM2,
          precioMetro,
          precioUnidad,
        } satisfies Record<string, unknown>

      const reqRow = await tx.customProductRequest.create({ data, select: { id: true } })

      // Notificar a ADMINs de la sede (opcional, pero útil para que respondan rápido)
      const adminMemberships = await tx.sedeMembership.findMany({
        where: { sedeId: access.sedeId, role: { in: ['ADMIN', 'MANAGER'] } },
        select: { userId: true },
      })
      const adminIds = Array.from(new Set(adminMemberships.map((m) => m.userId))).filter(Boolean)
      const recipients = adminIds.filter((uid) => uid !== access.userId)
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((uid) => ({
            userId: uid,
            empresaId,
            sedeId: access.sedeId,
            type: 'INFO',
            title: 'Nueva solicitud de producto personalizado',
            body: `${nombre}${externalId ? ` (${externalId})` : ''}. Revisa “Solicitudes personalizados”.`,
          })),
        })
      }

      if (terminados.length) {
        const uniques = Array.from(new Set(terminados))
        // Validar que existan y sean de la empresa
        const existingTerminados = await tx.terminado.findMany({
          where: { empresaId, id: { in: uniques } },
          select: { id: true },
        })
        const okIds = new Set(existingTerminados.map((t) => t.id))
        const toCreate = uniques.filter((id) => okIds.has(id))
        if (toCreate.length) {
          await tx.customProductRequestTerminado.createMany({
            data: toCreate.map((terminadoId) => ({ requestId: reqRow.id, terminadoId })),
            skipDuplicates: true,
          })
        }
      }

      return tx.customProductRequest.findUnique({
        where: { id: reqRow.id },
        include: {
          createdByUser: { select: { id: true, name: true, email: true, role: true } },
          approvedByUser: { select: { id: true, name: true, email: true, role: true } },
          terminados: { include: { terminado: { select: { id: true, nombre: true } } } },
        },
      })
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    console.error('Error creando custom product request:', error)
    return NextResponse.json({ success: false, error: 'Error creando solicitud' }, { status: 500 })
  }
}
