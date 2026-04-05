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
  sedeId: string
  costCenterId?: string | null
  fullName: string
  firstName: string
  middleName?: string | null
  lastName: string
  secondLastName?: string | null
  documentType: string
  documentNumber: string
  document: string
  role: string
  sede: string
  costCenter: string
  contractType: PayrollContractType | null
  activeContractId?: string | null
  frequency: PayrollFrequency | null
  salary: number
  status: PayrollEmployeeStatus
  startDate: string
  endDate?: string | null
  personalEmail?: string | null
  phone?: string | null
  city?: string | null
  address?: string | null
  eps: string
  epsEntity?: string | null
  pension: string
  pensionEntity?: string | null
  arlEntity?: string | null
  arlRiskClass: string
  bankAccount: string
  bankName?: string | null
  bankAccountType?: string | null
  bankAccountNumber?: string | null
  notes?: string | null
  alerts: string[]
}

export type PayrollContractRow = {
  id: string
  employeeId: string
  sedeId: string
  costCenterId?: string | null
  employeeName: string
  contractType: PayrollContractType
  status: PayrollContractStatus
  frequency: PayrollFrequency
  startDate: string
  endDate?: string | null
  salary: number
  variableSalary: boolean
  integralSalary: boolean
  transportationAllowance: boolean
  payrollGroup?: string | null
  notes?: string | null
  sede: string
  costCenter: string
}

export type PayrollPeriodRow = {
  id: string
  code: string
  sedeId?: string | null
  label: string
  frequency: PayrollFrequency
  status: PayrollPeriodStatus
  range: string
  startsAt: string
  endsAt: string
  paymentDate: string
  employeesCount: number
  grossTotal: number
  deductionsTotal: number
  netTotal: number
  socialSecurityTotal: number
  parafiscalesTotal: number
  notes?: string | null
  accountingStatus: 'PENDIENTE' | 'CONTABILIZADA'
}

export type PayrollNoveltyRow = {
  id: string
  employeeId: string
  contractId?: string | null
  periodId?: string | null
  employeeName: string
  type: PayrollNoveltyType
  periodLabel: string
  detail: string
  amount?: number
  quantity?: number
  days?: number
  status: PayrollNoveltyStatus
  source: string
  occurredOn?: string | null
  startsAt?: string | null
  endsAt?: string | null
  supportNumber?: string | null
}

export type PayrollSettlementRow = {
  id: string
  employeeId: string
  contractId?: string | null
  periodId?: string | null
  employeeName: string
  reason: PayrollSettlementReason
  retirementDate: string
  liquidationDate?: string | null
  paymentDate?: string | null
  workedDays: number
  total: number
  status: PayrollSettlementStatus
  notes?: string | null
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