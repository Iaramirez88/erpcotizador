'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSurfaceCallout } from '@/components/dashboard/nomina-surface-callout'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useI18n } from '@/components/providers/i18n-provider'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollContractRow, PayrollEmployeeRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

type SedeOption = {
  id: string
  nombre: string
}

type CostCenterOption = {
  id: string
  code: string
  name: string
}

const EMPTY_EMPLOYEE_FORM = {
  code: '',
  sedeId: '',
  costCenterId: '',
  firstName: '',
  middleName: '',
  lastName: '',
  secondLastName: '',
  documentType: 'CC',
  documentNumber: '',
  jobTitle: '',
  hireDate: '',
  retirementDate: '',
  status: 'ACTIVE',
  personalEmail: '',
  phone: '',
  city: '',
  address: '',
  epsEntity: '',
  pensionEntity: '',
  arlEntity: '',
  arlRiskClass: '',
  bankName: '',
  bankAccountType: '',
  bankAccountNumber: '',
  notes: '',
}

const EMPTY_CONTRACT_FORM = {
  employeeId: '',
  sedeId: '',
  costCenterId: '',
  contractType: 'INDEFINIDO',
  frequency: 'QUINCENAL',
  startDate: '',
  endDate: '',
  baseSalary: '',
  status: 'ACTIVE',
  payrollGroup: '',
  renewalReminderDays: '15',
  adminOnlyReminder: true,
  extensionEndDate: '',
  extensionReason: '',
  notes: '',
}

export default function NominaEmpleadosPage() {
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [contracts, setContracts] = useState<PayrollContractRow[]>([])
  const [sedes, setSedes] = useState<SedeOption[]>([])
  const [costCenters, setCostCenters] = useState<CostCenterOption[]>([])
  const [search, setSearch] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)
  const [editingContractId, setEditingContractId] = useState<string | null>(null)
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [contractDialogOpen, setContractDialogOpen] = useState(false)
  const [savingEmployee, setSavingEmployee] = useState(false)
  const [savingContract, setSavingContract] = useState(false)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [contractError, setContractError] = useState<string | null>(null)
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE_FORM)
  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT_FORM)
  const { mode, setMode } = useDataViewMode('nomina.empleados', 'list')
  const { language } = useI18n()

  const copy = language === 'en'
    ? {
      eyebrow: 'HR admin',
      title: 'Employees and contracts',
      description: 'Administrative workspace for RRHH: employee records, employment lifecycle, contracts, salary and social security details.',
        stats: {
          active: 'Active',
          activeHint: 'Employees in payroll cycle',
          suspended: 'Suspended',
          suspendedHint: 'Current employment issue',
          retired: 'Retired',
          retiredHint: 'With history and settlement',
        },
        banner: {
          text: 'Administrative action center for RRHH. Create the employee first, then the contract, and maintain branch, cost center and work details from the same screen.',
          createContract: 'Create contract',
          createEmployee: 'Create employee',
        },
        directory: {
          title: 'Workforce directory',
          description: 'Search by name, document, role or cost center.',
          searchPlaceholder: 'Search employee...',
          empty: 'No employees created yet.',
          expiringTitle: 'Contracts close to expiration',
          expiringDescription: 'This tray only shows active contracts that are already within their configured alert threshold.',
          expiringEmpty: 'No contracts are currently within their configured expiration alert window.',
          expiringBadge: 'days left',
          expiringAdminsOnly: 'Admin-only alert',
          expiringModuleUsers: 'Alert visible to authorized users',
          openContract: 'Open contract',
        },
        detail: {
          emptyTitle: 'Work detail',
          emptyDescription: 'Select an employee to view details.',
          noSelection: 'No selection.',
          editEmployee: 'Edit employee',
          deleteEmployee: 'Delete employee',
          employment: 'Employment',
          start: 'Start',
          end: 'End',
          active: 'Active',
          contract: 'Contract',
          noContract: 'No contract',
          frequency: 'Frequency',
          noFrequency: 'No frequency',
          socialSecurity: 'Social security',
          pension: 'Pension',
          bankAccount: 'Bank account',
          accounting: 'Accounting and operational allocation',
          branch: 'Branch',
          costCenter: 'Cost center',
          salary: 'Salary',
          activeContract: 'Active contract',
          noActiveContract: 'This employee does not have an active contract yet.',
          editContract: 'Edit contract',
          deleteContract: 'Delete contract',
          createContract: 'Create contract for this employee',
          alerts: 'Management alerts',
          noAlerts: 'No active alerts',
          personalEmail: 'Personal email',
          phone: 'Phone',
          city: 'City',
          address: 'Address',
          eps: 'EPS',
          arl: 'ARL',
        },
        errors: {
          saveEmployee: 'Unable to save employee',
          deleteEmployee: 'Unable to delete employee',
          saveContract: 'Unable to save contract',
          deleteContract: 'Unable to delete contract',
        },
        confirms: {
          deleteEmployee: (name: string) => `Delete ${name}? Only allowed if there is no history.`,
          deleteContract: (name: string) => `Delete ${name}'s contract?`,
        },
        employeeDialog: {
          createTitle: 'Create employee',
          editTitle: 'Edit employee',
          description: 'Register or correct the employee profile and accounting allocation.',
          code: 'Code',
          optional: 'Optional',
          status: 'Status',
          branch: 'Branch',
          selectBranch: 'Select branch',
          costCenter: 'Cost center',
          noCostCenter: 'No cost center',
          firstName: 'First name',
          middleName: 'Middle name',
          lastName: 'Last name',
          secondLastName: 'Second last name',
          documentType: 'Document type',
          documentNumber: 'Document number',
          jobTitle: 'Role',
          hireDate: 'Hire date',
          retirementDate: 'Retirement date',
          bankName: 'Bank',
          bankAccountType: 'Account type',
          bankAccountTypePlaceholder: 'Savings / Checking',
          bankAccountNumber: 'Account number',
          notes: 'Notes',
        },
        contractDialog: {
          createTitle: 'Create contract',
          editTitle: 'Edit contract',
          description: 'Attach contractual, salary and accounting details to the employee.',
          employee: 'Employee',
          selectEmployee: 'Select employee',
          branch: 'Branch',
          selectBranch: 'Select branch',
          costCenter: 'Cost center',
          noCostCenter: 'No cost center',
          contractType: 'Contract type',
          frequency: 'Frequency',
          startDate: 'Start date',
          endDate: 'End date',
          baseSalary: 'Base salary',
          status: 'Status',
          payrollGroup: 'Payroll group',
          reminderDays: 'Alert days before expiration',
          reminderDaysHelp: 'Defines how many days in advance the system should notify before the contract expires.',
          adminOnlyReminder: 'Notify only administrators',
          adminOnlyReminderHelp: 'Keep the reminder restricted to admin users and global administrators.',
          notes: 'Notes',
        },
        actions: {
          cancel: 'Cancel',
          save: 'Save changes',
          addEmployee: 'Create employee',
          addContract: 'Create contract',
        },
      }
    : {
      eyebrow: 'RRHH admin',
      title: 'Empleados y contratos',
      description: 'Superficie administrativa de RRHH para gestionar hoja de vida, ciclo laboral, contrato, salario, afiliaciones y estructura operativa.',
        stats: {
          active: 'Activos',
          activeHint: 'Empleados en ciclo de pago',
          suspended: 'Suspendidos',
          suspendedHint: 'Novedad laboral vigente',
          retired: 'Retirados',
          retiredHint: 'Con historial y liquidación',
        },
        banner: {
          text: 'Centro de acción para RRHH. Primero crea el empleado, luego su contrato, y desde aquí corrige sede, centro de costo y datos laborales.',
          createContract: 'Crear contrato',
          createEmployee: 'Crear empleado',
        },
        directory: {
          title: 'Directorio laboral',
          description: 'Busca por nombre, documento, cargo o centro de costo.',
          searchPlaceholder: 'Buscar empleado...',
          empty: 'No hay empleados creados todavía.',
          expiringTitle: 'Contratos próximos a vencer',
          expiringDescription: 'Esta bandeja solo muestra contratos activos que ya entraron en su umbral configurado de alerta.',
          expiringEmpty: 'No hay contratos dentro de la ventana configurada de vencimiento.',
          expiringBadge: 'días restantes',
          expiringAdminsOnly: 'Alerta solo administrativa',
          expiringModuleUsers: 'Alerta visible para usuarios autorizados',
          openContract: 'Abrir contrato',
        },
        detail: {
          emptyTitle: 'Detalle laboral',
          emptyDescription: 'Selecciona un empleado para ver su detalle.',
          noSelection: 'Sin selección.',
          editEmployee: 'Editar empleado',
          deleteEmployee: 'Eliminar empleado',
          employment: 'Vinculación',
          start: 'Ingreso',
          end: 'Retiro',
          active: 'Activo',
          contract: 'Contrato',
          noContract: 'Sin contrato',
          frequency: 'Frecuencia',
          noFrequency: 'Sin frecuencia',
          socialSecurity: 'Seguridad social',
          pension: 'Pensión',
          bankAccount: 'Cuenta bancaria',
          accounting: 'Ubicación contable y operativa',
          branch: 'Sede',
          costCenter: 'Centro de costo',
          salary: 'Salario',
          activeContract: 'Contrato activo',
          noActiveContract: 'Este colaborador aún no tiene contrato activo.',
          editContract: 'Editar contrato',
          deleteContract: 'Eliminar contrato',
          createContract: 'Crear contrato para este empleado',
          alerts: 'Alertas de gestión',
          noAlerts: 'Sin alertas activas',
          personalEmail: 'Email personal',
          phone: 'Teléfono',
          city: 'Ciudad',
          address: 'Dirección',
          eps: 'EPS',
          arl: 'ARL',
        },
        errors: {
          saveEmployee: 'No fue posible guardar el empleado',
          deleteEmployee: 'No fue posible eliminar el empleado',
          saveContract: 'No fue posible guardar el contrato',
          deleteContract: 'No fue posible eliminar el contrato',
        },
        confirms: {
          deleteEmployee: (name: string) => `Eliminar a ${name}? Solo se puede si no tiene historial.`,
          deleteContract: (name: string) => `Eliminar el contrato de ${name}?`,
        },
        employeeDialog: {
          createTitle: 'Crear empleado',
          editTitle: 'Editar empleado',
          description: 'Registra o corrige la ficha laboral y la ubicación contable del colaborador.',
          code: 'Código',
          optional: 'Opcional',
          status: 'Estado',
          branch: 'Sede',
          selectBranch: 'Selecciona sede',
          costCenter: 'Centro de costo',
          noCostCenter: 'Sin centro',
          firstName: 'Primer nombre',
          middleName: 'Segundo nombre',
          lastName: 'Primer apellido',
          secondLastName: 'Segundo apellido',
          documentType: 'Tipo documento',
          documentNumber: 'Número documento',
          jobTitle: 'Cargo',
          hireDate: 'Fecha ingreso',
          retirementDate: 'Fecha retiro',
          bankName: 'Banco',
          bankAccountType: 'Tipo cuenta',
          bankAccountTypePlaceholder: 'Ahorros / Corriente',
          bankAccountNumber: 'Número cuenta',
          notes: 'Notas',
        },
        contractDialog: {
          createTitle: 'Crear contrato',
          editTitle: 'Editar contrato',
          description: 'Asocia la información contractual, salarial y contable al empleado.',
          employee: 'Empleado',
          selectEmployee: 'Selecciona empleado',
          branch: 'Sede',
          selectBranch: 'Selecciona sede',
          costCenter: 'Centro de costo',
          noCostCenter: 'Sin centro',
          contractType: 'Tipo contrato',
          frequency: 'Frecuencia',
          startDate: 'Fecha inicio',
          endDate: 'Fecha fin',
          baseSalary: 'Salario base',
          status: 'Estado',
          payrollGroup: 'Grupo nómina',
          reminderDays: 'Días de alerta antes del vencimiento',
          reminderDaysHelp: 'Define cuántos días antes debe avisar el sistema que el contrato está por vencer.',
          adminOnlyReminder: 'Notificar solo a administradores',
          adminOnlyReminderHelp: 'Mantiene el aviso restringido a usuarios administradores y administradores globales.',
          notes: 'Notas',
        },
        actions: {
          cancel: 'Cancelar',
          save: 'Guardar cambios',
          addEmployee: 'Crear empleado',
          addContract: 'Crear contrato',
        },
      }

  const employeeStatusLabel = {
    ACTIVE: language === 'en' ? 'Active' : 'Activo',
    SUSPENDED: language === 'en' ? 'Suspended' : 'Suspendido',
    RETIRED: language === 'en' ? 'Retired' : 'Retirado',
  } as const

  const contractStatusLabel = {
    ACTIVE: language === 'en' ? 'Active' : 'Activo',
    SUSPENDED: language === 'en' ? 'Suspended' : 'Suspendido',
    FINALIZED: language === 'en' ? 'Finalized' : 'Finalizado',
  } as const

  const frequencyLabel = {
    QUINCENAL: language === 'en' ? 'Biweekly' : 'Quincenal',
    MENSUAL: language === 'en' ? 'Monthly' : 'Mensual',
    SEMANAL: language === 'en' ? 'Weekly' : 'Semanal',
    JORNAL: language === 'en' ? 'Day-rate' : 'Jornal',
  } as const

  const contractTypeLabel = {
    INDEFINIDO: language === 'en' ? 'Open-ended' : 'Indefinido',
    FIJO: language === 'en' ? 'Fixed-term' : 'Fijo',
    OBRA_LABOR: language === 'en' ? 'Work order' : 'Obra o labor',
    APRENDIZAJE: language === 'en' ? 'Apprenticeship' : 'Aprendizaje',
    PRESTACION: language === 'en' ? 'Contractor' : 'Prestación',
  } as const

  async function load() {
    const [employeesRes, contractsRes, sedesRes, centersRes] = await Promise.all([
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
      fetch('/api/nomina/contratos', { cache: 'no-store' }),
      fetch('/api/sedes', { cache: 'no-store' }),
      fetch('/api/contabilidad/centros-de-costo', { cache: 'no-store' }),
    ])

    const [employeesJson, contractsJson, sedesJson, centersJson] = await Promise.all([
      employeesRes.json().catch(() => null),
      contractsRes.json().catch(() => null),
      sedesRes.json().catch(() => null),
      centersRes.json().catch(() => null),
    ])

    const nextEmployees = (employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? []
    const nextContracts = (contractsJson?.data as PayrollContractRow[] | undefined) ?? []
    const nextSedes = (sedesJson?.data as SedeOption[] | undefined) ?? []
    const nextCenters = (centersJson?.data as CostCenterOption[] | undefined) ?? []

    setEmployees(nextEmployees)
    setContracts(nextContracts)
    setSedes(nextSedes)
    setCostCenters(nextCenters)
    setSelectedEmployeeId((current) => (current && nextEmployees.some((item) => item.id === current) ? current : nextEmployees[0]?.id ?? null))
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return employees
    return employees.filter((employee) => {
      const haystack = [employee.fullName, employee.document, employee.role, employee.sede, employee.costCenter].join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [employees, search])

  const expiringContracts = useMemo(() => {
    const visibleEmployeeIds = new Set(filteredEmployees.map((employee) => employee.id))
    return contracts
      .filter((contract) => contract.status === 'ACTIVE' && contract.expiresSoon && visibleEmployeeIds.has(contract.employeeId))
      .sort((left, right) => (left.daysToExpiration ?? Number.MAX_SAFE_INTEGER) - (right.daysToExpiration ?? Number.MAX_SAFE_INTEGER))
  }, [contracts, filteredEmployees])

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? filteredEmployees[0] ?? null
  const selectedContract = contracts.find((contract) => contract.id === selectedEmployee?.activeContractId) ?? contracts.find((contract) => contract.employeeId === selectedEmployee?.id && contract.status === 'ACTIVE') ?? null

  function openCreateEmployee() {
    setEditingEmployeeId(null)
    setEmployeeError(null)
    setEmployeeForm({ ...EMPTY_EMPLOYEE_FORM, sedeId: sedes[0]?.id ?? '' })
    setEmployeeDialogOpen(true)
  }

  function openEditEmployee(employee: PayrollEmployeeRow) {
    setEditingEmployeeId(employee.id)
    setEmployeeError(null)
    setEmployeeForm({
      code: employee.code,
      sedeId: employee.sedeId,
      costCenterId: employee.costCenterId ?? '',
      firstName: employee.firstName,
      middleName: employee.middleName ?? '',
      lastName: employee.lastName,
      secondLastName: employee.secondLastName ?? '',
      documentType: employee.documentType,
      documentNumber: employee.documentNumber,
      jobTitle: employee.role,
      hireDate: employee.startDate.slice(0, 10),
      retirementDate: employee.endDate?.slice(0, 10) ?? '',
      status: employee.status,
      personalEmail: employee.personalEmail ?? '',
      phone: employee.phone ?? '',
      city: employee.city ?? '',
      address: employee.address ?? '',
      epsEntity: employee.epsEntity ?? '',
      pensionEntity: employee.pensionEntity ?? '',
      arlEntity: employee.arlEntity ?? '',
      arlRiskClass: employee.arlRiskClass === 'Sin clase ARL' ? '' : employee.arlRiskClass,
      bankName: employee.bankName ?? '',
      bankAccountType: employee.bankAccountType ?? '',
      bankAccountNumber: employee.bankAccountNumber ?? '',
      notes: employee.notes ?? '',
    })
    setEmployeeDialogOpen(true)
  }

  function openCreateContract(employeeId?: string) {
    setEditingContractId(null)
    setContractError(null)
    setContractForm({
      ...EMPTY_CONTRACT_FORM,
      employeeId: employeeId ?? selectedEmployee?.id ?? employees[0]?.id ?? '',
      sedeId: selectedEmployee?.sedeId ?? sedes[0]?.id ?? '',
      costCenterId: selectedEmployee?.costCenterId ?? '',
      startDate: selectedEmployee?.startDate?.slice(0, 10) ?? '',
      renewalReminderDays: '15',
      adminOnlyReminder: true,
    })
    setContractDialogOpen(true)
  }

  function openEditContract(contract: PayrollContractRow) {
    setEditingContractId(contract.id)
    setContractError(null)
    setContractForm({
      employeeId: contract.employeeId,
      sedeId: contract.sedeId,
      costCenterId: contract.costCenterId ?? '',
      contractType: contract.contractType,
      frequency: contract.frequency,
      startDate: contract.startDate.slice(0, 10),
      endDate: contract.endDate?.slice(0, 10) ?? '',
      baseSalary: String(contract.salary),
      status: contract.status,
      payrollGroup: contract.payrollGroup ?? '',
      renewalReminderDays: String(contract.renewalReminderDays ?? 15),
      adminOnlyReminder: contract.adminOnlyReminder ?? true,
      extensionEndDate: contract.endDate?.slice(0, 10) ?? '',
      extensionReason: contract.lastExtensionReason ?? '',
      notes: contract.notes ?? '',
    })
    setContractDialogOpen(true)
  }

  async function handleSaveEmployee() {
    setSavingEmployee(true)
    setEmployeeError(null)

    const method = editingEmployeeId ? 'PUT' : 'POST'
    const payload = {
      ...(editingEmployeeId ? { id: editingEmployeeId } : {}),
      ...employeeForm,
      costCenterId: employeeForm.costCenterId || null,
      retirementDate: employeeForm.retirementDate || null,
      bankAccountType: employeeForm.bankAccountType || null,
    }

    const res = await fetch('/api/nomina/empleados', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setEmployeeError(json?.error ?? copy.errors.saveEmployee)
      setSavingEmployee(false)
      return
    }

    setEmployeeDialogOpen(false)
    setEditingEmployeeId(null)
    setEmployeeForm(EMPTY_EMPLOYEE_FORM)
    await load()
    setSavingEmployee(false)
  }

  async function handleDeleteEmployee(employee: PayrollEmployeeRow) {
    if (!window.confirm(copy.confirms.deleteEmployee(employee.fullName))) return

    const res = await fetch('/api/nomina/empleados', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: employee.id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setEmployeeError(json?.error ?? copy.errors.deleteEmployee)
      return
    }

    await load()
  }

  async function handleSaveContract() {
    setSavingContract(true)
    setContractError(null)

    const method = editingContractId ? 'PUT' : 'POST'
    const payload = {
      ...(editingContractId ? { id: editingContractId } : {}),
      ...contractForm,
      costCenterId: contractForm.costCenterId || null,
      endDate: contractForm.endDate || null,
      baseSalary: Number(contractForm.baseSalary),
      renewalReminderDays: Number(contractForm.renewalReminderDays || 15),
      adminOnlyReminder: contractForm.adminOnlyReminder,
      extensionEndDate: contractForm.extensionEndDate || null,
      extensionReason: contractForm.extensionReason || null,
    }

    const res = await fetch('/api/nomina/contratos', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setContractError(json?.error ?? copy.errors.saveContract)
      setSavingContract(false)
      return
    }

    setContractDialogOpen(false)
    setEditingContractId(null)
    setContractForm(EMPTY_CONTRACT_FORM)
    await load()
    setSavingContract(false)
  }

  async function handleDeleteContract(contract: PayrollContractRow) {
    if (!window.confirm(copy.confirms.deleteContract(contract.employeeName))) return

    const res = await fetch('/api/nomina/contratos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contract.id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setContractError(json?.error ?? copy.errors.deleteContract)
      return
    }

    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={<span data-tour="nomina-empleados-title">{copy.title}</span>}
        description={copy.description}
        stats={[
          { label: copy.stats.active, value: employees.filter((employee) => employee.status === 'ACTIVE').length, hint: copy.stats.activeHint, tone: 'sky' },
          { label: copy.stats.suspended, value: employees.filter((employee) => employee.status === 'SUSPENDED').length, hint: copy.stats.suspendedHint, tone: 'amber' },
          { label: copy.stats.retired, value: employees.filter((employee) => employee.status === 'RETIRED').length, hint: copy.stats.retiredHint, tone: 'neutral' },
        ]}
      />

      <NominaSubnav />

      <NominaSurfaceCallout
        adminTitle={language === 'en' ? 'Employee records and contracts are managed here.' : 'Aquí se gestionan fichas laborales y contratos.'}
        adminDescription={language === 'en' ? 'RRHH updates employment data, salary structure, affiliations and accounting assignment from this workspace.' : 'RRHH actualiza datos laborales, estructura salarial, afiliaciones y asignación contable desde esta estación.'}
        employeeTitle={language === 'en' ? 'The collaborator only sees approved personal data in the portal.' : 'El colaborador solo ve sus datos aprobados en el portal.'}
        employeeDescription={language === 'en' ? 'Contact changes and self-service requests happen in the employee portal, not in this admin tray.' : 'Los cambios de contacto y solicitudes de autoservicio ocurren en el portal del colaborador, no en esta bandeja administrativa.'}
        primaryHref={nominaHref('portal-empleado')}
        primaryLabel={language === 'en' ? 'Open collaborator portal' : 'Abrir portal del colaborador'}
        secondaryHref={nominaHref('servicio-colaborador')}
        secondaryLabel={language === 'en' ? 'Go to service center' : 'Ir a servicio al colaborador'}
      />

      <Card className="rounded-[24px] border-sky-200 bg-sky-50/70">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-700">
          <div>{copy.banner.text}</div>
          <div className="flex flex-wrap gap-2" data-tour="nomina-empleados-actions">
            <Button variant="outline" className="rounded-xl bg-white/80" onClick={() => openCreateContract()}>
              {copy.banner.createContract}
            </Button>
            <Button className="rounded-xl" onClick={openCreateEmployee}>
              {copy.banner.createEmployee}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <Card className="rounded-[26px] border-slate-200" data-tour="nomina-empleados-list">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{copy.directory.title}</CardTitle>
                <DataViewToggle mode={mode} onChange={setMode} />
              </div>
              <CardDescription>{copy.directory.description}</CardDescription>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.directory.searchPlaceholder} className="mt-2 rounded-xl" />
            </CardHeader>
            <CardContent className="space-y-3">
              {!filteredEmployees.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">{copy.directory.empty}</div> : null}
              {mode === 'grid'
                ? <div className="grid gap-3 md:grid-cols-2">{filteredEmployees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className={selectedEmployee?.id === employee.id ? 'w-full rounded-[22px] border border-sky-300 bg-sky-50/70 p-4 text-left' : 'w-full rounded-[22px] border border-slate-200 bg-white p-4 text-left'}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-950">{employee.fullName}</p>
                          <p className="text-sm text-slate-500">{employee.role} · {employee.document}</p>
                        </div>
                        <span className={employee.status === 'ACTIVE' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : employee.status === 'SUSPENDED' ? 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800' : 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'}>{employeeStatusLabel[employee.status as keyof typeof employeeStatusLabel] ?? employee.status}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600">
                        <div>{employee.sede}</div>
                        <div>{employee.contractType ? (contractTypeLabel[employee.contractType as keyof typeof contractTypeLabel] ?? employee.contractType) : copy.detail.noContract} · {employee.frequency ? (frequencyLabel[employee.frequency as keyof typeof frequencyLabel] ?? employee.frequency) : copy.detail.noFrequency}</div>
                        <div>{copy.contractDialog.baseSalary}: {formatCurrency(employee.salary)}</div>
                      </div>
                    </button>
                  ))}</div>
                : filteredEmployees.map((employee) => (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className={selectedEmployee?.id === employee.id ? 'w-full rounded-[18px] border border-sky-300 bg-sky-50/70 px-4 py-3 text-left' : 'w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-left'}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{employee.fullName}</p>
                          <p className="truncate text-xs text-slate-500">{employee.role} · {employee.document}</p>
                        </div>
                        <span className={employee.status === 'ACTIVE' ? 'rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800' : employee.status === 'SUSPENDED' ? 'rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800' : 'rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700'}>{employeeStatusLabel[employee.status as keyof typeof employeeStatusLabel] ?? employee.status}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                        <div>{employee.sede}</div>
                        <div>{employee.contractType ? (contractTypeLabel[employee.contractType as keyof typeof contractTypeLabel] ?? employee.contractType) : copy.detail.noContract}</div>
                        <div>{formatCurrency(employee.salary)}</div>
                      </div>
                    </button>
                  ))}
            </CardContent>
          </Card>

          <Card className="rounded-[26px] border-amber-200 bg-amber-50/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{copy.directory.expiringTitle}</CardTitle>
                <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900">{expiringContracts.length}</span>
              </div>
              <CardDescription>{copy.directory.expiringDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!expiringContracts.length ? <div className="rounded-2xl border border-dashed border-amber-200 bg-white/80 p-4 text-sm text-slate-500">{copy.directory.expiringEmpty}</div> : null}
              {expiringContracts.map((contract) => (
                <button
                  key={contract.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(contract.employeeId)}
                  className={selectedEmployee?.id === contract.employeeId ? 'w-full rounded-[20px] border border-amber-300 bg-white px-4 py-3 text-left shadow-sm' : 'w-full rounded-[20px] border border-amber-200 bg-white/90 px-4 py-3 text-left'}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{contract.employeeName}</div>
                      <div className="text-sm text-slate-600">{contractTypeLabel[contract.contractType as keyof typeof contractTypeLabel] ?? contract.contractType} · {frequencyLabel[contract.frequency as keyof typeof frequencyLabel] ?? contract.frequency}</div>
                      <div className="mt-1 text-xs text-slate-500">{contract.sede} · {contract.costCenter}</div>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">{contract.daysToExpiration ?? 0} {copy.directory.expiringBadge}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">Umbral: {contract.renewalReminderDays} día(s)</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">Vence: {contract.endDate ? contract.endDate.slice(0, 10) : 'Sin fecha final'}</span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1">{contract.adminOnlyReminder ? copy.directory.expiringAdminsOnly : copy.directory.expiringModuleUsers}</span>
                  </div>
                  <div className="mt-3 text-sm font-medium text-amber-900">{copy.directory.openContract}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{selectedEmployee?.fullName ?? copy.detail.emptyTitle}</CardTitle>
            <CardDescription>{selectedEmployee ? `${selectedEmployee.role} · ${selectedEmployee.code}` : copy.detail.emptyDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            {selectedEmployee ? (
              <>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => openEditEmployee(selectedEmployee)}>{copy.detail.editEmployee}</Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => void handleDeleteEmployee(selectedEmployee)}>{copy.detail.deleteEmployee}</Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.detail.employment}</div>
                    <div className="mt-2 space-y-1">
                      <div><span className="font-medium text-slate-900">{copy.detail.start}:</span> {selectedEmployee.startDate}</div>
                      <div><span className="font-medium text-slate-900">{copy.detail.end}:</span> {selectedEmployee.endDate || copy.detail.active}</div>
                      <div><span className="font-medium text-slate-900">{copy.detail.contract}:</span> {selectedEmployee.contractType ? (contractTypeLabel[selectedEmployee.contractType as keyof typeof contractTypeLabel] ?? selectedEmployee.contractType) : copy.detail.noContract}</div>
                      <div><span className="font-medium text-slate-900">{copy.detail.frequency}:</span> {selectedEmployee.frequency ? (frequencyLabel[selectedEmployee.frequency as keyof typeof frequencyLabel] ?? selectedEmployee.frequency) : copy.detail.noFrequency}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.detail.socialSecurity}</div>
                    <div className="mt-2 space-y-1">
                      <div><span className="font-medium text-slate-900">{copy.detail.eps}:</span> {selectedEmployee.eps}</div>
                      <div><span className="font-medium text-slate-900">{copy.detail.pension}:</span> {selectedEmployee.pension}</div>
                      <div><span className="font-medium text-slate-900">{copy.detail.arl}:</span> {selectedEmployee.arlRiskClass}</div>
                      <div><span className="font-medium text-slate-900">{copy.detail.bankAccount}:</span> {selectedEmployee.bankAccount}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">Horas extra</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{selectedEmployee.overtimeHours} h</div>
                    <div className="text-sm text-slate-600">{selectedEmployee.overtimeMinutes} minutos acumulados desde asistencia.</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Vacaciones</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{selectedEmployee.vacation.availableDays} días</div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      <div>Ganados: {selectedEmployee.vacation.earnedDays} días / {selectedEmployee.vacation.earnedHours} horas</div>
                      <div>Tomados: {selectedEmployee.vacation.takenDays} días / {selectedEmployee.vacation.takenHours} horas</div>
                      <div>Disponibles: {selectedEmployee.vacation.availableHours} horas</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.detail.accounting}</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div><span className="font-medium text-slate-900">{copy.detail.branch}:</span> {selectedEmployee.sede}</div>
                    <div><span className="font-medium text-slate-900">{copy.detail.costCenter}:</span> {selectedEmployee.costCenter}</div>
                    <div><span className="font-medium text-slate-900">{copy.detail.salary}:</span> {formatCurrency(selectedEmployee.salary)}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.detail.activeContract}</div>
                      <div className="mt-1 text-sm text-slate-600">{selectedContract ? `${contractTypeLabel[selectedContract.contractType as keyof typeof contractTypeLabel] ?? selectedContract.contractType} · ${frequencyLabel[selectedContract.frequency as keyof typeof frequencyLabel] ?? selectedContract.frequency} · ${formatCurrency(selectedContract.salary)}` : copy.detail.noActiveContract}</div>
                      {selectedContract ? <div className="mt-2 grid gap-1 text-sm text-slate-500"><div>Prórrogas registradas: {selectedContract.extensionCount}</div><div>Recordatorio administrativo: {selectedContract.renewalReminderDays} días antes</div><div>Destino de alerta: {selectedContract.adminOnlyReminder ? 'Solo administradores' : 'Usuarios autorizados del módulo'}</div><div>Vencimiento: {selectedContract.endDate ? `${selectedContract.endDate.slice(0, 10)}${selectedContract.daysToExpiration != null ? ` · ${selectedContract.daysToExpiration} día(s)` : ''}` : 'Sin fecha final'}</div>{selectedContract.lastExtensionDate ? <div>Última prórroga: {selectedContract.lastExtensionDate.slice(0, 10)}{selectedContract.lastExtensionReason ? ` · ${selectedContract.lastExtensionReason}` : ''}</div> : null}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedContract ? <Button variant="outline" className="rounded-xl" onClick={() => openEditContract(selectedContract)}>{copy.detail.editContract}</Button> : null}
                      {selectedContract ? <Button variant="outline" className="rounded-xl" onClick={() => void handleDeleteContract(selectedContract)}>{copy.detail.deleteContract}</Button> : null}
                      <Button className="rounded-xl" onClick={() => openCreateContract(selectedEmployee.id)}>{copy.detail.createContract}</Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.detail.alerts}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedEmployee.alerts.map((alert) => (
                      <span key={alert} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                        {alert}
                      </span>
                    ))}
                    {!selectedEmployee.alerts.length ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">{copy.detail.noAlerts}</span> : null}
                  </div>
                </div>
              </>
            ) : (
              <div>{copy.detail.noSelection}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingEmployeeId ? copy.employeeDialog.editTitle : copy.employeeDialog.createTitle}</DialogTitle>
            <DialogDescription>{copy.employeeDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>{copy.employeeDialog.code}</Label><Input value={employeeForm.code} onChange={(event) => setEmployeeForm((current) => ({ ...current, code: event.target.value }))} placeholder={copy.employeeDialog.optional} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.status}</Label><Select value={employeeForm.status} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">{employeeStatusLabel.ACTIVE}</SelectItem><SelectItem value="SUSPENDED">{employeeStatusLabel.SUSPENDED}</SelectItem><SelectItem value="RETIRED">{employeeStatusLabel.RETIRED}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.branch}</Label><Select value={employeeForm.sedeId} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, sedeId: value }))}><SelectTrigger><SelectValue placeholder={copy.employeeDialog.selectBranch} /></SelectTrigger><SelectContent>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.costCenter}</Label><Select value={employeeForm.costCenterId || '__none__'} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, costCenterId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder={copy.employeeDialog.noCostCenter} /></SelectTrigger><SelectContent><SelectItem value="__none__">{copy.employeeDialog.noCostCenter}</SelectItem>{costCenters.map((center) => <SelectItem key={center.id} value={center.id}>{center.code} - {center.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.firstName}</Label><Input value={employeeForm.firstName} onChange={(event) => setEmployeeForm((current) => ({ ...current, firstName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.middleName}</Label><Input value={employeeForm.middleName} onChange={(event) => setEmployeeForm((current) => ({ ...current, middleName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.lastName}</Label><Input value={employeeForm.lastName} onChange={(event) => setEmployeeForm((current) => ({ ...current, lastName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.secondLastName}</Label><Input value={employeeForm.secondLastName} onChange={(event) => setEmployeeForm((current) => ({ ...current, secondLastName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.documentType}</Label><Select value={employeeForm.documentType} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, documentType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CC">CC</SelectItem><SelectItem value="CE">CE</SelectItem><SelectItem value="TI">TI</SelectItem><SelectItem value="NIT">NIT</SelectItem><SelectItem value="PP">PP</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.documentNumber}</Label><Input value={employeeForm.documentNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, documentNumber: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.jobTitle}</Label><Input value={employeeForm.jobTitle} onChange={(event) => setEmployeeForm((current) => ({ ...current, jobTitle: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.hireDate}</Label><Input type="date" value={employeeForm.hireDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, hireDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.retirementDate}</Label><Input type="date" value={employeeForm.retirementDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, retirementDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.personalEmail}</Label><Input value={employeeForm.personalEmail} onChange={(event) => setEmployeeForm((current) => ({ ...current, personalEmail: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.phone}</Label><Input value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.city}</Label><Input value={employeeForm.city} onChange={(event) => setEmployeeForm((current) => ({ ...current, city: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.address}</Label><Input value={employeeForm.address} onChange={(event) => setEmployeeForm((current) => ({ ...current, address: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.eps}</Label><Input value={employeeForm.epsEntity} onChange={(event) => setEmployeeForm((current) => ({ ...current, epsEntity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.pension}</Label><Input value={employeeForm.pensionEntity} onChange={(event) => setEmployeeForm((current) => ({ ...current, pensionEntity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.detail.arl}</Label><Input value={employeeForm.arlEntity} onChange={(event) => setEmployeeForm((current) => ({ ...current, arlEntity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'ARL class' : 'Clase ARL'}</Label><Input value={employeeForm.arlRiskClass} onChange={(event) => setEmployeeForm((current) => ({ ...current, arlRiskClass: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.bankName}</Label><Input value={employeeForm.bankName} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.employeeDialog.bankAccountType}</Label><Input value={employeeForm.bankAccountType} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankAccountType: event.target.value }))} placeholder={copy.employeeDialog.bankAccountTypePlaceholder} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.employeeDialog.bankAccountNumber}</Label><Input value={employeeForm.bankAccountNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankAccountNumber: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.employeeDialog.notes}</Label><Textarea value={employeeForm.notes} onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
          </div>
          {employeeError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{employeeError}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>{copy.actions.cancel}</Button>
            <Button onClick={() => void handleSaveEmployee()} disabled={savingEmployee}>{savingEmployee ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingEmployeeId ? copy.actions.save : copy.actions.addEmployee}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingContractId ? copy.contractDialog.editTitle : copy.contractDialog.createTitle}</DialogTitle>
            <DialogDescription>{copy.contractDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{copy.contractDialog.employee}</Label><Select value={contractForm.employeeId} onValueChange={(value) => setContractForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder={copy.contractDialog.selectEmployee} /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.branch}</Label><Select value={contractForm.sedeId} onValueChange={(value) => setContractForm((current) => ({ ...current, sedeId: value }))}><SelectTrigger><SelectValue placeholder={copy.contractDialog.selectBranch} /></SelectTrigger><SelectContent>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.costCenter}</Label><Select value={contractForm.costCenterId || '__none__'} onValueChange={(value) => setContractForm((current) => ({ ...current, costCenterId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder={copy.contractDialog.noCostCenter} /></SelectTrigger><SelectContent><SelectItem value="__none__">{copy.contractDialog.noCostCenter}</SelectItem>{costCenters.map((center) => <SelectItem key={center.id} value={center.id}>{center.code} - {center.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.contractType}</Label><Select value={contractForm.contractType} onValueChange={(value) => setContractForm((current) => ({ ...current, contractType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INDEFINIDO">{contractTypeLabel.INDEFINIDO}</SelectItem><SelectItem value="FIJO">{contractTypeLabel.FIJO}</SelectItem><SelectItem value="OBRA_LABOR">{contractTypeLabel.OBRA_LABOR}</SelectItem><SelectItem value="APRENDIZAJE">{contractTypeLabel.APRENDIZAJE}</SelectItem><SelectItem value="PRESTACION">{contractTypeLabel.PRESTACION}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.frequency}</Label><Select value={contractForm.frequency} onValueChange={(value) => setContractForm((current) => ({ ...current, frequency: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="QUINCENAL">{frequencyLabel.QUINCENAL}</SelectItem><SelectItem value="MENSUAL">{frequencyLabel.MENSUAL}</SelectItem><SelectItem value="SEMANAL">{frequencyLabel.SEMANAL}</SelectItem><SelectItem value="JORNAL">{frequencyLabel.JORNAL}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.startDate}</Label><Input type="date" value={contractForm.startDate} onChange={(event) => setContractForm((current) => ({ ...current, startDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.endDate}</Label><Input type="date" value={contractForm.endDate} onChange={(event) => setContractForm((current) => ({ ...current, endDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.baseSalary}</Label><Input type="number" value={contractForm.baseSalary} onChange={(event) => setContractForm((current) => ({ ...current, baseSalary: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.status}</Label><Select value={contractForm.status} onValueChange={(value) => setContractForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">{contractStatusLabel.ACTIVE}</SelectItem><SelectItem value="SUSPENDED">{contractStatusLabel.SUSPENDED}</SelectItem><SelectItem value="FINALIZED">{contractStatusLabel.FINALIZED}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{copy.contractDialog.reminderDays}</Label><Input type="number" min="1" value={contractForm.renewalReminderDays} onChange={(event) => setContractForm((current) => ({ ...current, renewalReminderDays: event.target.value }))} /><div className="text-xs text-slate-500">{copy.contractDialog.reminderDaysHelp}</div></div>
            <div className="grid gap-2"><Label>Prórroga hasta</Label><Input type="date" value={contractForm.extensionEndDate} onChange={(event) => setContractForm((current) => ({ ...current, extensionEndDate: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Motivo de prórroga</Label><Input value={contractForm.extensionReason} onChange={(event) => setContractForm((current) => ({ ...current, extensionReason: event.target.value }))} placeholder="Ej. continuidad operativa, renovación comercial" /></div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label>{copy.contractDialog.adminOnlyReminder}</Label>
                  <div className="text-xs text-slate-500">{copy.contractDialog.adminOnlyReminderHelp}</div>
                </div>
                <Switch checked={contractForm.adminOnlyReminder} onCheckedChange={(checked) => setContractForm((current) => ({ ...current, adminOnlyReminder: checked }))} />
              </div>
            </div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.contractDialog.payrollGroup}</Label><Input value={contractForm.payrollGroup} onChange={(event) => setContractForm((current) => ({ ...current, payrollGroup: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{copy.contractDialog.notes}</Label><Textarea value={contractForm.notes} onChange={(event) => setContractForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
          </div>
          {contractError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{contractError}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>{copy.actions.cancel}</Button>
            <Button onClick={() => void handleSaveContract()} disabled={savingContract}>{savingContract ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingContractId ? copy.actions.save : copy.actions.addContract}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}