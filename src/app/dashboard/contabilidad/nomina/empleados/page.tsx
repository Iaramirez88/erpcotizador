'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollEmployeeRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

export default function NominaEmpleadosPage() {
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [search, setSearch] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.empleados', 'list')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/nomina/empleados', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as { data?: PayrollEmployeeRow[] } | null
      if (cancelled) return
      const nextEmployees = json?.data ?? []
      setEmployees(nextEmployees)
      setSelectedEmployeeId((current) => current ?? nextEmployees[0]?.id ?? null)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return employees
    return employees.filter((employee) => {
      const haystack = [employee.fullName, employee.document, employee.role, employee.sede, employee.costCenter]
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [employees, search])

  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? filteredEmployees[0] ?? null

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow="Nómina"
        title="Empleados y contratos"
        description="Base laboral del módulo: hoja de vida, fecha de ingreso, retiro, cargo, centro de costo, contrato, salario y afiliaciones."
        stats={[
          { label: 'Activos', value: employees.filter((employee) => employee.status === 'ACTIVE').length, hint: 'Empleados en ciclo de pago', tone: 'sky' },
          { label: 'Suspendidos', value: employees.filter((employee) => employee.status === 'SUSPENDED').length, hint: 'Novedad laboral vigente', tone: 'amber' },
          { label: 'Retirados', value: employees.filter((employee) => employee.status === 'RETIRED').length, hint: 'Con historial y liquidación', tone: 'neutral' },
        ]}
      />

      <NominaSubnav />

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[26px] border-slate-200">
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
            {mode === 'grid' ? <div className="grid gap-3 md:grid-cols-2">{filteredEmployees.map((employee) => (
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
            ))}</div> : filteredEmployees.map((employee) => (
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Vinculación</div>
                    <div className="mt-2 space-y-1">
                      <div><span className="font-medium text-slate-900">Ingreso:</span> {selectedEmployee.startDate}</div>
                      <div><span className="font-medium text-slate-900">Retiro:</span> {selectedEmployee.endDate || 'Activo'}</div>
                      <div><span className="font-medium text-slate-900">Contrato:</span> {selectedEmployee.contractType}</div>
                      <div><span className="font-medium text-slate-900">Frecuencia:</span> {selectedEmployee.frequency}</div>
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
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Alertas de gestión</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedEmployee.alerts.map((alert) => (
                      <span key={alert} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900">
                        {alert}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>Sin selección.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}