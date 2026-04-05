import type {
  PayrollContractStatus,
  PayrollContractType,
  PayrollEmployeeStatus,
  PayrollFrequency,
  PayrollNoveltyStatus,
  PayrollNoveltyType,
  PayrollPeriodStatus,
  PayrollSettlementReason,
  PayrollSettlementStatus,
} from '@prisma/client'
import { formatDateShort } from '@/lib/utils'

export type DataViewMode = 'list' | 'grid'

export type PayrollEmployeeRow = {
  id: string
  code: string
  fullName: string
  document: string
  role: string
  sede: string
  costCenter: string
  contractType: PayrollContractType | null
  frequency: PayrollFrequency | null
  salary: number
  status: PayrollEmployeeStatus
  startDate: string
  endDate?: string | null
  eps: string
  pension: string
  arlRiskClass: string
  bankAccount: string
  alerts: string[]
}

export type PayrollContractRow = {
  id: string
  employeeId: string
  employeeName: string
  contractType: PayrollContractType
  status: PayrollContractStatus
  frequency: PayrollFrequency
  startDate: string
  endDate?: string | null
  salary: number
  sede: string
  costCenter: string
}

export type PayrollPeriodRow = {
  id: string
  label: string
  frequency: PayrollFrequency
  status: PayrollPeriodStatus
  range: string
  paymentDate: string
  employeesCount: number
  grossTotal: number
  deductionsTotal: number
  netTotal: number
  socialSecurityTotal: number
  parafiscalesTotal: number
  accountingStatus: 'PENDIENTE' | 'CONTABILIZADA'
}

export type PayrollNoveltyRow = {
  id: string
  employeeId: string
  employeeName: string
  type: PayrollNoveltyType
  periodLabel: string
  detail: string
  amount?: number
  days?: number
  status: PayrollNoveltyStatus
  source: string
}

export type PayrollSettlementRow = {
  id: string
  employeeId: string
  employeeName: string
  reason: PayrollSettlementReason
  retirementDate: string
  workedDays: number
  total: number
  status: PayrollSettlementStatus
  accountingStatus: 'PENDIENTE' | 'CONTABILIZADA'
}

export type PayrollPayslipRow = {
  id: string
  employeeName: string
  periodLabel: string
  paymentDate: string
  netPay: number
  signed: boolean
  deliveredBy: 'PORTAL' | 'EMAIL' | 'PDF' | 'FISICO'
}

export function buildPayrollEmployeeFullName(employee: {
  firstName: string
  middleName?: string | null
  lastName: string
  secondLastName?: string | null
}) {
  return [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName].filter(Boolean).join(' ')
}

export function buildPayrollDateRange(startsAt: Date | string, endsAt: Date | string) {
  return `${formatDateShort(startsAt)} al ${formatDateShort(endsAt)}`
}

export function nextPayrollCode(sequence: number) {
  return `NOM-${String(sequence).padStart(4, '0')}`
}