import {
  PosPaymentFlow,
  PosPaymentMethod,
  PosPaymentProvider,
  PosPaymentSource,
  PosPaymentStatus,
  type Prisma,
} from '@prisma/client'
import type { BoldPaymentMethod } from '@/lib/bold'

export function normalizePosPaymentFlow(value: unknown): PosPaymentFlow {
  if (typeof value !== 'string') return PosPaymentFlow.CASH
  const normalized = value.trim().toUpperCase()
  if (normalized === PosPaymentFlow.DATAPHONE) return PosPaymentFlow.DATAPHONE
  if (normalized === PosPaymentFlow.QR) return PosPaymentFlow.QR
  if (normalized === PosPaymentFlow.LINK) return PosPaymentFlow.LINK
  return PosPaymentFlow.CASH
}

export function normalizePosPaymentSource(value: unknown): PosPaymentSource {
  if (typeof value !== 'string') return PosPaymentSource.NONE
  const normalized = value.trim().toUpperCase()
  if (normalized === PosPaymentSource.NEQUI) return PosPaymentSource.NEQUI
  if (normalized === PosPaymentSource.DAVIPLATA) return PosPaymentSource.DAVIPLATA
  if (normalized === PosPaymentSource.BANCOLOMBIA) return PosPaymentSource.BANCOLOMBIA
  if (normalized === 'OTRO' || normalized === PosPaymentSource.OTHER) return PosPaymentSource.OTHER
  return PosPaymentSource.NONE
}

export function posPaymentMethodFromFlow(flow: PosPaymentFlow): PosPaymentMethod {
  if (flow === PosPaymentFlow.DATAPHONE) return PosPaymentMethod.CARD
  if (flow === PosPaymentFlow.QR) return PosPaymentMethod.TRANSFER
  if (flow === PosPaymentFlow.LINK) return PosPaymentMethod.OTHER
  return PosPaymentMethod.CASH
}

export function resolveBoldPaymentMethods(flow: PosPaymentFlow, source: PosPaymentSource): BoldPaymentMethod[] {
  if (flow === PosPaymentFlow.DATAPHONE) return ['CREDIT_CARD']

  if (source === PosPaymentSource.NEQUI) return ['NEQUI']
  if (source === PosPaymentSource.BANCOLOMBIA) return ['BOTON_BANCOLOMBIA']
  if (source === PosPaymentSource.DAVIPLATA) return ['PSE']

  if (flow === PosPaymentFlow.QR) return ['NEQUI', 'BOTON_BANCOLOMBIA', 'PSE']

  return ['CREDIT_CARD', 'PSE', 'BOTON_BANCOLOMBIA', 'NEQUI']
}

export type PosFinalizePaymentInput = {
  method: PosPaymentMethod
  amount: number
  note?: string | null
  status?: PosPaymentStatus
  provider?: PosPaymentProvider
  flow?: PosPaymentFlow
  source?: PosPaymentSource
  externalReference?: string | null
  boldPaymentLinkId?: string | null
  boldCheckoutUrl?: string | null
  boldPaymentId?: string | null
  boldEventId?: string | null
  boldType?: string | null
  paidAt?: Date | null
  metadata?: Prisma.InputJsonValue
}