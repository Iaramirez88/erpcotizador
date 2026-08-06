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
  supportUrl?: string | null
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

export type PayrollEmployeeDocumentRow = {
  id: string
  employeeId: string
  periodId?: string | null
  employeeName: string
  periodLabel: string
  title: string
  category: string
  documentType: string
  status: string
  signatureRequired: boolean
  signatureStatus: string
  visibleInPortal: boolean
  deliveryChannel: string
  fileFormat: string
  requestedAt?: string | null
  deliveredAt?: string | null
  signedAt?: string | null
  expiresAt?: string | null
  notes?: string | null
}

export type PayrollOnboardingJourneyRow = {
  id: string
  employeeId: string
  employeeName: string
  periodId?: string | null
  workflowTemplateId?: string | null
  workflowTemplateName: string | null
  ownerName: string | null
  title: string
  status: string
  phase: string
  progress: number
  employeeRole?: string | null
  locationLabel?: string | null
  welcomeMessage?: string | null
  checklist: Array<{
    id: string
    title: string
    owner: string
    status: string
    dueLabel?: string | null
  }>
  startDate: string
  targetDate?: string | null
  completedAt?: string | null
  notes?: string | null
}

export type PayrollEmployeeServiceCaseRow = {
  id: string
  employeeId: string
  employeeName: string
  periodId?: string | null
  periodLabel: string
  assignedToName: string | null
  resolvedByName: string | null
  title: string
  category: string
  channel: string
  priority: string
  status: string
  portalVisibility: boolean
  employeeRole?: string | null
  summary: string
  resolution?: string | null
  slaHours: number
  requestedAt: string
  firstResponseAt?: string | null
  resolvedAt?: string | null
  notes?: string | null
}

export type PayrollWhistleblowerCaseRow = {
  id: string
  employeeId?: string | null
  employeeName: string | null
  assignedToName: string | null
  resolvedByName: string | null
  title: string
  category: string
  severity: string
  status: string
  anonymousReport: boolean
  confidentialityLevel: string
  reportedChannel: string
  reporterName?: string | null
  reporterEmail?: string | null
  reporterRole?: string | null
  accusedArea?: string | null
  occurredAt?: string | null
  summary: string
  evidenceSummary?: string | null
  resolution?: string | null
  followUpRequired: boolean
  firstResponseAt?: string | null
  resolvedAt?: string | null
  notes?: string | null
}

export type PayrollRecruitmentCandidateRow = {
  id: string
  ownerName: string | null
  openingTitle: string
  department: string
  locationLabel?: string | null
  candidateName: string
  candidateEmail?: string | null
  candidatePhone?: string | null
  source: string
  stage: string
  status: string
  score: number
  salaryExpectation?: number | null
  expectedStartDate?: string | null
  interviewerNotes?: string | null
  decisionSummary?: string | null
  resumeUrl?: string | null
}

export type PayrollSurveyCampaignRow = {
  id: string
  ownerName: string | null
  title: string
  category: string
  status: string
  anonymous: boolean
  audience: string
  channel: string
  questionsCount: number
  invitedCount: number
  responsesCount: number
  averageScore?: number | null
  opensAt?: string | null
  closesAt?: string | null
  summary?: string | null
  notes?: string | null
}

export type PayrollPerformanceReviewRow = {
  id: string
  employeeName: string | null
  ownerName: string | null
  cycleTitle: string
  reviewType: string
  status: string
  managerName?: string | null
  competencyFocus: string
  score?: number | null
  targetScore?: number | null
  dueDate?: string | null
  completedAt?: string | null
  developmentPlan?: string | null
  summary?: string | null
}

export type PayrollTrainingAssignmentRow = {
  id: string
  employeeName: string | null
  ownerName: string | null
  title: string
  category: string
  status: string
  modality: string
  provider?: string | null
  durationHours: number
  dueDate?: string | null
  completedAt?: string | null
  score?: number | null
  certificateUrl?: string | null
  summary?: string | null
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