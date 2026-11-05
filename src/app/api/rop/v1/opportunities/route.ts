import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createRopOpportunityForUser } from '@/lib/rop'
import { requireRopAccess } from '@/lib/rop-access'

export const runtime = 'nodejs'

const requestSchema = z.object({
  title: z.string().trim().min(5).max(180),
  descriptionPublic: z.string().trim().max(4000).nullable().optional(),
  requirementsPrivate: z.string().trim().max(8000).nullable().optional(),
  categoryId: z.string().trim().min(1),
  subcategoryId: z.string().trim().min(1),
  serviceCatalogId: z.string().trim().min(1),
  location: z.object({
    countryCode: z.string().trim().length(2),
    region: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().max(120).nullable().optional(),
  }),
  expectedQuantity: z.number().min(0).max(999999999).nullable().optional(),
  dueAt: z.string().trim().min(1).nullable().optional(),
  visibilityLevel: z.enum(['PRIVATE', 'CLUSTER', 'NETWORK']),
  sourceType: z.enum(['MANUAL', 'CRM', 'PURCHASE', 'OPS_SIGNAL', 'API']),
  sourceRef: z.string().trim().max(180).nullable().optional(),
})

type ValidationIssue = { code: string; path: PropertyKey[]; message: string }

const CATALOG_FIELDS = new Set(['categoryId', 'subcategoryId', 'serviceCatalogId'])

const FIELD_LABELS: Record<string, string> = {
  title: 'el título',
  descriptionPublic: 'la descripción visible',
  requirementsPrivate: 'los requisitos privados',
  categoryId: 'la categoría',
  subcategoryId: 'la subcategoría',
  serviceCatalogId: 'el servicio',
  location: 'la ubicación',
  expectedQuantity: 'la cantidad esperada',
  dueAt: 'la fecha objetivo',
  visibilityLevel: 'la visibilidad',
  sourceType: 'el origen',
  sourceRef: 'la referencia de origen',
}

function buildValidationMessage(issues: readonly ValidationIssue[]) {
  const first = issues[0]
  if (!first) return 'Body inválido.'

  const field = String(first.path[0] ?? '')
  const label = FIELD_LABELS[field]

  if (CATALOG_FIELDS.has(field)) {
    return 'Debes seleccionar categoría, subcategoría y servicio del catálogo ROP antes de publicar.'
  }

  if (first.code === 'too_small') {
    return label ? `Revisa ${label}: ${first.message}` : first.message
  }

  return label ? `El dato de ${label} no es válido: ${first.message}` : first.message
}

const KNOWN_DOMAIN_ERRORS: Record<string, string> = {
  INVALID_OPPORTUNITY_SERVICE_RELATION:
    'El servicio seleccionado ya no está disponible en el catálogo ROP. Recarga la página y vuelve a elegir categoría, subcategoría y servicio.',
}

async function resolveUserAccess() {
  const access = await requireRopAccess('CREATE')
  if (!access.ok) return { error: access.response }
  return { userId: access.userId }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveUserAccess()
    if ('error' in context) return context.error

    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_BODY',
            message: buildValidationMessage(parsed.error.issues),
          },
          meta: { version: 'v1', timestamp: new Date().toISOString() },
        },
        { status: 400 }
      )
    }

    const data = await createRopOpportunityForUser(context.userId, parsed.data)
    return NextResponse.json({ data, meta: { version: 'v1', timestamp: new Date().toISOString() }, error: null }, { status: 201 })
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'No se pudo publicar la necesidad.'
    const knownMessage = KNOWN_DOMAIN_ERRORS[rawMessage]
    const message = knownMessage ?? rawMessage
    const status = rawMessage.startsWith('INVALID_') || Boolean(knownMessage) ? 400 : 500

    return NextResponse.json(
      {
        error: {
          code: status === 400 ? 'ROP_OPPORTUNITY_INVALID' : 'ROP_OPPORTUNITY_POST_FAILED',
          message,
        },
        meta: { version: 'v1', timestamp: new Date().toISOString() },
      },
      { status }
    )
  }
}