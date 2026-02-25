import { NextRequest, NextResponse } from 'next/server'
import { requireApiAccess } from '@/lib/api-rbac'
import { AccessLevel, AccountingEventType, ModuleKey } from '@prisma/client'
import { generateJournalEntryFromRule } from '@/lib/accounting/engine'

export const runtime = 'nodejs'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isEventType(value: string): value is AccountingEventType {
  return (
    value === 'POS_INVOICE' ||
    value === 'POS_RETURN' ||
    value === 'COMPRA' ||
    value === 'COMPRA_PAGO' ||
    value === 'DIAN_DOCUMENT' ||
    value === 'MANUAL'
  )
}

export async function POST(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.CONTABILIDAD, AccessLevel.WRITE)
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const eventTypeRaw = asString(body.eventType).trim()
  const referenceType = asString(body.referenceType).trim()
  const referenceId = asString(body.referenceId).trim()
  const memo = asString(body.memo).trim() || ''
  const description = asString(body.description).trim() || memo || `${referenceType} ${referenceId}`

  const dateRaw = asString(body.date).trim()
  const date = dateRaw ? new Date(dateRaw) : new Date()
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ ok: false, error: 'date inválida (usa ISO 8601)' }, { status: 400 })
  }

  if (!isEventType(eventTypeRaw)) {
    return NextResponse.json({ ok: false, error: 'eventType inválido' }, { status: 400 })
  }
  if (!referenceType || !referenceId) {
    return NextResponse.json({ ok: false, error: 'referenceType y referenceId son requeridos' }, { status: 400 })
  }

  const amounts = (body.amounts ?? {}) as Record<string, unknown>

  const amount = (key: string) => {
    const v = amounts[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const n = Number(v)
      if (Number.isFinite(n)) return n
    }
    return 0
  }

  try {
    const entry = await generateJournalEntryFromRule({
      empresaId: access.empresaId,
      userId: access.userId,
      eventType: eventTypeRaw,
      referenceType,
      referenceId,
      date,
      description,
      amounts: {
        SUBTOTAL: amount('SUBTOTAL'),
        IVA: amount('IVA'),
        DESCUENTO: amount('DESCUENTO'),
        RETENCION: amount('RETENCION'),
        RETEICA: amount('RETEICA'),
        AUTORETENCION: amount('AUTORETENCION'),
        TOTAL: amount('TOTAL'),
      },
    })

    return NextResponse.json({ ok: true, data: entry })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error generando asiento'
    // Errors from engine are business errors, return 400
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
