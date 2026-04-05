import type { AccountingPeriodStatus, AccountingVoucherStatus, AccountingVoucherType } from '@prisma/client'
import { formatDateShort } from '@/lib/utils'

export type AccountingPeriodRow = {
  id: string
  code: string
  label: string
  status: AccountingPeriodStatus
  range: string
  closedAt: string | null
  lockedAt: string | null
  vouchersCount: number
}

export type AccountingVoucherRow = {
  id: string
  code: string
  voucherType: AccountingVoucherType
  status: AccountingVoucherStatus
  periodLabel: string
  date: string
  description: string
  thirdPartyName: string | null
  totalDebit: number
  totalCredit: number
  linesCount: number
}

export function buildAccountingRange(startsAt: Date | string, endsAt: Date | string) {
  return `${formatDateShort(startsAt)} al ${formatDateShort(endsAt)}`
}

export function nextAccountingPeriodCode(sequence: number, year = new Date().getFullYear()) {
  return `PER-${year}-${String(sequence).padStart(3, '0')}`
}

export function nextAccountingVoucherCode(type: AccountingVoucherType, sequence: number) {
  const prefixMap: Record<AccountingVoucherType, string> = {
    DIARIO: 'CD',
    INGRESO: 'CI',
    EGRESO: 'CE',
    AJUSTE: 'AJ',
    CIERRE: 'CC',
    APERTURA: 'CA',
  }

  return `${prefixMap[type]}-${String(sequence).padStart(6, '0')}`
}