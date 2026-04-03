import crypto from 'crypto'
import { Prisma, PrismaClient, PosInvoiceAuditAction } from '@prisma/client'

type PosInvoiceAuditDbClient = PrismaClient | Prisma.TransactionClient

type CreatePosInvoiceAuditEventArgs = {
  invoiceId: string
  action: PosInvoiceAuditAction | `${PosInvoiceAuditAction}`
  note?: string | null
  before?: Prisma.InputJsonValue | null
  after?: Prisma.InputJsonValue | null
  performedById?: string | null
  createdAt?: Date
  fallbackMode?: 'auto' | 'skip'
}

function getNestedErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const maybeError = error as {
    code?: string
    cause?: { code?: string; originalCode?: string }
    meta?: { driverAdapterError?: { cause?: { code?: string; originalCode?: string } } }
  }

  return (
    maybeError.code ||
    maybeError.cause?.originalCode ||
    maybeError.cause?.code ||
    maybeError.meta?.driverAdapterError?.cause?.originalCode ||
    maybeError.meta?.driverAdapterError?.cause?.code
  )
}

function isPosInvoiceAuditSchemaMismatch(error: unknown) {
  const code = getNestedErrorCode(error)
  if (code === '42704' || code === '22P02') return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('PosInvoiceAuditAction') || message.includes('pos_invoice_audit_events')
}

export async function createPosInvoiceAuditEvent(db: PosInvoiceAuditDbClient, args: CreatePosInvoiceAuditEventArgs) {
  const payload = {
    invoiceId: args.invoiceId,
    action: args.action as PosInvoiceAuditAction,
    note: args.note ?? null,
    before: args.before ?? undefined,
    after: args.after ?? undefined,
    performedById: args.performedById ?? null,
    createdAt: args.createdAt ?? new Date(),
  }

  try {
    await db.posInvoiceAuditEvent.create({ data: payload })
    return true
  } catch (error) {
    if (!isPosInvoiceAuditSchemaMismatch(error)) {
      console.error('POS audit: no se pudo registrar el evento con Prisma:', error)
      return false
    }
  }

  if (args.fallbackMode === 'skip') {
    return false
  }

  try {
    const beforeJson = args.before === undefined ? null : JSON.stringify(args.before ?? null)
    const afterJson = args.after === undefined ? null : JSON.stringify(args.after ?? null)

    await db.$executeRaw`
      INSERT INTO "pos_invoice_audit_events" (
        "id",
        "invoiceId",
        "action",
        "note",
        "before",
        "after",
        "performedById",
        "createdAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${args.invoiceId},
        ${String(args.action)},
        ${args.note ?? null},
        ${beforeJson}::jsonb,
        ${afterJson}::jsonb,
        ${args.performedById ?? null},
        ${args.createdAt ?? new Date()}
      )
    `

    return true
  } catch (fallbackError) {
    console.error('POS audit: tampoco se pudo registrar el evento con SQL fallback:', fallbackError)
    return false
  }
}