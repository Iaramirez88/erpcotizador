'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
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
      setEmployeeError(json?.error ?? 'No fue posible guardar el empleado')
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
    if (!window.confirm(`Eliminar a ${employee.fullName}? Solo se puede si no tiene historial.`)) return

    const res = await fetch('/api/nomina/empleados', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: employee.id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setEmployeeError(json?.error ?? 'No fue posible eliminar el empleado')
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
    }

    const res = await fetch('/api/nomina/contratos', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setContractError(json?.error ?? 'No fue posible guardar el contrato')
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
    if (!window.confirm(`Eliminar el contrato de ${contract.employeeName}?`)) return

    const res = await fetch('/api/nomina/contratos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contract.id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null

    if (!res.ok || !json?.ok) {
      setContractError(json?.error ?? 'No fue posible eliminar el contrato')
      return
    }

    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title={<span data-tour="nomina-empleados-title">Empleados y contratos</span>}
        description="Base laboral del módulo: hoja de vida, fecha de ingreso, retiro, cargo, centro de costo, contrato, salario y afiliaciones."
        stats={[
          { label: 'Activos', value: employees.filter((employee) => employee.status === 'ACTIVE').length, hint: 'Empleados en ciclo de pago', tone: 'sky' },
          { label: 'Suspendidos', value: employees.filter((employee) => employee.status === 'SUSPENDED').length, hint: 'Novedad laboral vigente', tone: 'amber' },
          { label: 'Retirados', value: employees.filter((employee) => employee.status === 'RETIRED').length, hint: 'Con historial y liquidación', tone: 'neutral' },
        ]}
      />

      <NominaSubnav />

      <Card className="rounded-[24px] border-sky-200 bg-sky-50/70">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-700">
          <div>Primero crea el empleado, luego su contrato. Desde esta pantalla también puedes corregir sede, centro de costo y datos laborales.</div>
          <div className="flex flex-wrap gap-2" data-tour="nomina-empleados-actions">
            <Button variant="outline" className="rounded-xl bg-white/80" onClick={() => openCreateContract()}>
              Crear contrato
            </Button>
            <Button className="rounded-xl" onClick={openCreateEmployee}>
              Crear empleado
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[26px] border-slate-200" data-tour="nomina-empleados-list">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Directorio laboral</CardTitle>
              <DataViewToggle mode={mode} onChange={setMode} />
            </div>
            <CardDescription>Busca por nombre, documento, cargo o centro de costo.</CardDescription>
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empleado..." className="mt-2 rounded-xl" />
          </CardHeader>
          <CardContent className="space-y-3">
            {!filteredEmployees.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">No hay empleados creados todavía.</div> : null}
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
                      <span className={employee.status === 'ACTIVE' ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800' : employee.status === 'SUSPENDED' ? 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800' : 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'}>{employee.status}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-600">
                      <div>{employee.sede}</div>
                      <div>{employee.contractType ?? 'Sin contrato'} · {employee.frequency ?? 'Sin frecuencia'}</div>
                      <div>Salario base: {formatCurrency(employee.salary)}</div>
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
                      <span className={employee.status === 'ACTIVE' ? 'rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800' : employee.status === 'SUSPENDED' ? 'rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800' : 'rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700'}>{employee.status}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-600 sm:grid-cols-3">
                      <div>{employee.sede}</div>
                      <div>{employee.contractType ?? 'Sin contrato'}</div>
                      <div>{formatCurrency(employee.salary)}</div>
                    </div>
                  </button>
                ))}
          </CardContent>
        </Card>

        <Card className="rounded-[26px] border-slate-200">
          <CardHeader>
            <CardTitle>{selectedEmployee?.fullName ?? 'Detalle laboral'}</CardTitle>
            <CardDescription>{selectedEmployee ? `${selectedEmployee.role} · ${selectedEmployee.code}` : 'Selecciona un empleado para ver su detalle.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            {selectedEmployee ? (
              <>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => openEditEmployee(selectedEmployee)}>Editar empleado</Button>
                  <Button variant="outline" className="rounded-xl" onClick={() => void handleDeleteEmployee(selectedEmployee)}>Eliminar empleado</Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vinculación</div>
                    <div className="mt-2 space-y-1">
                      <div><span className="font-medium text-slate-900">Ingreso:</span> {selectedEmployee.startDate}</div>
                      <div><span className="font-medium text-slate-900">Retiro:</span> {selectedEmployee.endDate || 'Activo'}</div>
                      <div><span className="font-medium text-slate-900">Contrato:</span> {selectedEmployee.contractType ?? 'Sin contrato'}</div>
                      <div><span className="font-medium text-slate-900">Frecuencia:</span> {selectedEmployee.frequency ?? 'Sin frecuencia'}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Seguridad social</div>
                    <div className="mt-2 space-y-1">
                      <div><span className="font-medium text-slate-900">EPS:</span> {selectedEmployee.eps}</div>
                      <div><span className="font-medium text-slate-900">Pensión:</span> {selectedEmployee.pension}</div>
                      <div><span className="font-medium text-slate-900">ARL:</span> {selectedEmployee.arlRiskClass}</div>
                      <div><span className="font-medium text-slate-900">Cuenta bancaria:</span> {selectedEmployee.bankAccount}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ubicación contable y operativa</div>
                  <div className="mt-2 grid gap-2 md:grid-cols-3">
                    <div><span className="font-medium text-slate-900">Sede:</span> {selectedEmployee.sede}</div>
                    <div><span className="font-medium text-slate-900">Centro de costo:</span> {selectedEmployee.costCenter}</div>
                    <div><span className="font-medium text-slate-900">Salario:</span> {formatCurrency(selectedEmployee.salary)}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Contrato activo</div>
                      <div className="mt-1 text-sm text-slate-600">{selectedContract ? `${selectedContract.contractType} · ${selectedContract.frequency} · ${formatCurrency(selectedContract.salary)}` : 'Este colaborador aún no tiene contrato activo.'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedContract ? <Button variant="outline" className="rounded-xl" onClick={() => openEditContract(selectedContract)}>Editar contrato</Button> : null}
                      {selectedContract ? <Button variant="outline" className="rounded-xl" onClick={() => void handleDeleteContract(selectedContract)}>Eliminar contrato</Button> : null}
                      <Button className="rounded-xl" onClick={() => openCreateContract(selectedEmployee.id)}>Crear contrato para este empleado</Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Alertas de gestión</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedEmployee.alerts.map((alert) => (
                      <span key={alert} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                        {alert}
                      </span>
                    ))}
                    {!selectedEmployee.alerts.length ? <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">Sin alertas activas</span> : null}
                  </div>
                </div>
              </>
            ) : (
              <div>Sin selección.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingEmployeeId ? 'Editar empleado' : 'Crear empleado'}</DialogTitle>
            <DialogDescription>Registra o corrige la ficha laboral y la ubicación contable del colaborador.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>Código</Label><Input value={employeeForm.code} onChange={(event) => setEmployeeForm((current) => ({ ...current, code: event.target.value }))} placeholder="Opcional" /></div>
            <div className="grid gap-2"><Label>Estado</Label><Select value={employeeForm.status} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Activo</SelectItem><SelectItem value="SUSPENDED">Suspendido</SelectItem><SelectItem value="RETIRED">Retirado</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Sede</Label><Select value={employeeForm.sedeId} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, sedeId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona sede" /></SelectTrigger><SelectContent>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Centro de costo</Label><Select value={employeeForm.costCenterId || '__none__'} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, costCenterId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Sin centro" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin centro</SelectItem>{costCenters.map((center) => <SelectItem key={center.id} value={center.id}>{center.code} - {center.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Primer nombre</Label><Input value={employeeForm.firstName} onChange={(event) => setEmployeeForm((current) => ({ ...current, firstName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Segundo nombre</Label><Input value={employeeForm.middleName} onChange={(event) => setEmployeeForm((current) => ({ ...current, middleName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Primer apellido</Label><Input value={employeeForm.lastName} onChange={(event) => setEmployeeForm((current) => ({ ...current, lastName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Segundo apellido</Label><Input value={employeeForm.secondLastName} onChange={(event) => setEmployeeForm((current) => ({ ...current, secondLastName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Tipo documento</Label><Select value={employeeForm.documentType} onValueChange={(value) => setEmployeeForm((current) => ({ ...current, documentType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CC">CC</SelectItem><SelectItem value="CE">CE</SelectItem><SelectItem value="TI">TI</SelectItem><SelectItem value="NIT">NIT</SelectItem><SelectItem value="PP">PP</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Número documento</Label><Input value={employeeForm.documentNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, documentNumber: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Cargo</Label><Input value={employeeForm.jobTitle} onChange={(event) => setEmployeeForm((current) => ({ ...current, jobTitle: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha ingreso</Label><Input type="date" value={employeeForm.hireDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, hireDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha retiro</Label><Input type="date" value={employeeForm.retirementDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, retirementDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Email personal</Label><Input value={employeeForm.personalEmail} onChange={(event) => setEmployeeForm((current) => ({ ...current, personalEmail: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Teléfono</Label><Input value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Ciudad</Label><Input value={employeeForm.city} onChange={(event) => setEmployeeForm((current) => ({ ...current, city: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Dirección</Label><Input value={employeeForm.address} onChange={(event) => setEmployeeForm((current) => ({ ...current, address: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>EPS</Label><Input value={employeeForm.epsEntity} onChange={(event) => setEmployeeForm((current) => ({ ...current, epsEntity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Pensión</Label><Input value={employeeForm.pensionEntity} onChange={(event) => setEmployeeForm((current) => ({ ...current, pensionEntity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>ARL</Label><Input value={employeeForm.arlEntity} onChange={(event) => setEmployeeForm((current) => ({ ...current, arlEntity: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Clase ARL</Label><Input value={employeeForm.arlRiskClass} onChange={(event) => setEmployeeForm((current) => ({ ...current, arlRiskClass: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Banco</Label><Input value={employeeForm.bankName} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Tipo cuenta</Label><Input value={employeeForm.bankAccountType} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankAccountType: event.target.value }))} placeholder="Ahorros / Corriente" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Número cuenta</Label><Input value={employeeForm.bankAccountNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, bankAccountNumber: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Notas</Label><Textarea value={employeeForm.notes} onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
          </div>
          {employeeError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{employeeError}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveEmployee()} disabled={savingEmployee}>{savingEmployee ? 'Guardando...' : editingEmployeeId ? 'Guardar cambios' : 'Crear empleado'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{editingContractId ? 'Editar contrato' : 'Crear contrato'}</DialogTitle>
            <DialogDescription>Asocia la información contractual, salarial y contable al empleado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>Empleado</Label><Select value={contractForm.employeeId} onValueChange={(value) => setContractForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona empleado" /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Sede</Label><Select value={contractForm.sedeId} onValueChange={(value) => setContractForm((current) => ({ ...current, sedeId: value }))}><SelectTrigger><SelectValue placeholder="Selecciona sede" /></SelectTrigger><SelectContent>{sedes.map((sede) => <SelectItem key={sede.id} value={sede.id}>{sede.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Centro de costo</Label><Select value={contractForm.costCenterId || '__none__'} onValueChange={(value) => setContractForm((current) => ({ ...current, costCenterId: value === '__none__' ? '' : value }))}><SelectTrigger><SelectValue placeholder="Sin centro" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin centro</SelectItem>{costCenters.map((center) => <SelectItem key={center.id} value={center.id}>{center.code} - {center.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>Tipo contrato</Label><Select value={contractForm.contractType} onValueChange={(value) => setContractForm((current) => ({ ...current, contractType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INDEFINIDO">Indefinido</SelectItem><SelectItem value="FIJO">Fijo</SelectItem><SelectItem value="OBRA_LABOR">Obra o labor</SelectItem><SelectItem value="APRENDIZAJE">Aprendizaje</SelectItem><SelectItem value="PRESTACION">Prestación</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Frecuencia</Label><Select value={contractForm.frequency} onValueChange={(value) => setContractForm((current) => ({ ...current, frequency: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="QUINCENAL">Quincenal</SelectItem><SelectItem value="MENSUAL">Mensual</SelectItem><SelectItem value="SEMANAL">Semanal</SelectItem><SelectItem value="JORNAL">Jornal</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Fecha inicio</Label><Input type="date" value={contractForm.startDate} onChange={(event) => setContractForm((current) => ({ ...current, startDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Fecha fin</Label><Input type="date" value={contractForm.endDate} onChange={(event) => setContractForm((current) => ({ ...current, endDate: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Salario base</Label><Input type="number" value={contractForm.baseSalary} onChange={(event) => setContractForm((current) => ({ ...current, baseSalary: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Estado</Label><Select value={contractForm.status} onValueChange={(value) => setContractForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Activo</SelectItem><SelectItem value="SUSPENDED">Suspendido</SelectItem><SelectItem value="FINALIZED">Finalizado</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>Grupo nómina</Label><Input value={contractForm.payrollGroup} onChange={(event) => setContractForm((current) => ({ ...current, payrollGroup: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Notas</Label><Textarea value={contractForm.notes} onChange={(event) => setContractForm((current) => ({ ...current, notes: event.target.value }))} rows={3} /></div>
          </div>
          {contractError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{contractError}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setContractDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void handleSaveContract()} disabled={savingContract}>{savingContract ? 'Guardando...' : editingContractId ? 'Guardar cambios' : 'Crear contrato'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}