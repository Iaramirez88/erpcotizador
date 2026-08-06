'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSurfaceCallout } from '@/components/dashboard/nomina-surface-callout'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import type { PayrollEmployeeRow } from '@/lib/payroll'
import type { PayrollBenefitOfferingRow, PayrollBenefitRequestRow } from '@/lib/payroll-operations'
import { Switch } from '@/components/ui/switch'
import { nominaHref } from '@/lib/nomina-routes'
import { formatCurrency } from '@/lib/utils'

const EMPTY_FORM = {
  employeeId: '',
  type: 'PUNTOS',
  title: '',
  description: '',
  planName: '',
  vendorName: '',
  status: 'SOLICITADA',
  pointsCost: '0',
  amount: '',
  requestedAt: '',
}

const EMPTY_OFFERING_FORM = {
  title: '',
  kind: 'PLAN',
  category: 'SALUD',
  vendorName: '',
  status: 'ACTIVO',
  pricingModel: 'PUNTOS',
  pointsCost: '0',
  employerCost: '',
  employeeCopay: '',
  discountRate: '',
  spotlight: true,
  description: '',
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function NominaBeneficiosPage() {
  const [rows, setRows] = useState<PayrollBenefitRequestRow[]>([])
  const [offerings, setOfferings] = useState<PayrollBenefitOfferingRow[]>([])
  const [employees, setEmployees] = useState<PayrollEmployeeRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [offeringDialogOpen, setOfferingDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [offeringForm, setOfferingForm] = useState(EMPTY_OFFERING_FORM)
  const [saving, setSaving] = useState(false)
  const [savingOffering, setSavingOffering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offeringError, setOfferingError] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.beneficios', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'HR admin',
        title: 'Benefits Management',
        description: 'RRHH backoffice for benefit requests and catalog offers that later become visible in the employee portal and service experience.',
        actions: { create: 'Create benefit request', save: 'Save changes', add: 'Create request', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Benefit request', description: 'Store the benefit type, plan, vendor, value and approval status for the employee.' },
        offeringActions: { create: 'Create catalog offer', save: 'Save offer', add: 'Create offer', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        offeringDialog: { title: 'Catalog offer', description: 'Store a real benefit plan or discount pack with pricing, spotlight and vendor information.' },
      }
    : {
        eyebrow: 'RRHH admin',
        title: 'Gestión de Beneficios',
        description: 'Backoffice de RRHH para gestionar solicitudes y catálogo de beneficios que luego consume el colaborador desde su portal y su experiencia de servicio.',
        actions: { create: 'Crear solicitud de beneficio', save: 'Guardar cambios', add: 'Crear solicitud', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Solicitud de beneficio', description: 'Guarda tipo de beneficio, plan, aliado, valor y estado de aprobación para el colaborador.' },
        offeringActions: { create: 'Crear oferta de catálogo', save: 'Guardar oferta', add: 'Crear oferta', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        offeringDialog: { title: 'Oferta de catálogo', description: 'Guarda un plan o pack real con pricing, visibilidad destacada y aliado comercial.' },
      }

  async function load() {
    const [benefitsRes, offeringsRes, employeesRes] = await Promise.all([
      fetch('/api/nomina/beneficios', { cache: 'no-store' }),
      fetch('/api/nomina/beneficios/ofertas', { cache: 'no-store' }),
      fetch('/api/nomina/empleados', { cache: 'no-store' }),
    ])
    const [benefitsJson, offeringsJson, employeesJson] = await Promise.all([
      benefitsRes.json().catch(() => null),
      offeringsRes.json().catch(() => null),
      employeesRes.json().catch(() => null),
    ])
    const nextEmployees = (employeesJson?.data as PayrollEmployeeRow[] | undefined) ?? []
    setRows((benefitsJson?.data as PayrollBenefitRequestRow[] | undefined) ?? [])
    setOfferings((offeringsJson?.data as PayrollBenefitOfferingRow[] | undefined) ?? [])
    setEmployees(nextEmployees)
    setForm((current) => ({ ...current, employeeId: current.employeeId || nextEmployees[0]?.id || '' }))
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm({ ...EMPTY_FORM, employeeId: employees[0]?.id || '', requestedAt: new Date().toISOString().slice(0, 10) })
    setDialogOpen(true)
  }

  function openCreateOffering() {
    setEditingOfferingId(null)
    setOfferingError(null)
    setOfferingForm(EMPTY_OFFERING_FORM)
    setOfferingDialogOpen(true)
  }

  function openEditOffering(item: PayrollBenefitOfferingRow) {
    setEditingOfferingId(item.id)
    setOfferingError(null)
    setOfferingForm({
      title: item.title,
      kind: item.kind,
      category: item.category,
      vendorName: item.vendorName ?? '',
      status: item.status,
      pricingModel: item.pricingModel,
      pointsCost: String(item.pointsCost),
      employerCost: item.employerCost != null ? String(item.employerCost) : '',
      employeeCopay: item.employeeCopay != null ? String(item.employeeCopay) : '',
      discountRate: item.discountRate != null ? String(item.discountRate) : '',
      spotlight: item.spotlight,
      description: item.description,
    })
    setOfferingDialogOpen(true)
  }

  function openEdit(item: PayrollBenefitRequestRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      employeeId: item.employeeId,
      type: item.type,
      title: item.title,
      description: item.description,
      planName: item.planName ?? '',
      vendorName: item.vendorName ?? '',
      status: item.status,
      pointsCost: String(item.pointsCost),
      amount: item.amount != null ? String(item.amount) : '',
      requestedAt: item.requestedAt.slice(0, 10),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      pointsCost: Number(form.pointsCost || 0),
      amount: form.amount ? Number(form.amount) : null,
    }
    const res = await fetch('/api/nomina/beneficios', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save request' : 'No fue posible guardar la solicitud'))
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    await load()
    setSaving(false)
  }

  async function handleSaveOffering() {
    setSavingOffering(true)
    setOfferingError(null)
    const payload = {
      ...(editingOfferingId ? { id: editingOfferingId } : {}),
      ...offeringForm,
      pointsCost: Number(offeringForm.pointsCost || 0),
      employerCost: offeringForm.employerCost ? Number(offeringForm.employerCost) : null,
      employeeCopay: offeringForm.employeeCopay ? Number(offeringForm.employeeCopay) : null,
      discountRate: offeringForm.discountRate ? Number(offeringForm.discountRate) : null,
    }
    const res = await fetch('/api/nomina/beneficios/ofertas', {
      method: editingOfferingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setOfferingError(json?.error ?? (language === 'en' ? 'Unable to save offer' : 'No fue posible guardar la oferta'))
      setSavingOffering(false)
      return
    }
    setOfferingDialogOpen(false)
    setEditingOfferingId(null)
    setOfferingForm(EMPTY_OFFERING_FORM)
    await load()
    setSavingOffering(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm(language === 'en' ? 'Delete this benefit request?' : '¿Eliminar esta solicitud de beneficio?')) return
    const res = await fetch('/api/nomina/beneficios', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete request' : 'No fue posible eliminar la solicitud'))
      return
    }
    await load()
  }

  async function handleDeleteOffering(id: string) {
    if (!window.confirm(language === 'en' ? 'Delete this catalog offer?' : '¿Eliminar esta oferta de catálogo?')) return
    const res = await fetch('/api/nomina/beneficios/ofertas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setOfferingError(json?.error ?? (language === 'en' ? 'Unable to delete offer' : 'No fue posible eliminar la oferta'))
      return
    }
    await load()
  }

  const payrollAdvances = rows.filter((item) => item.type === 'ADELANTO')
  const otherBenefits = rows.filter((item) => item.type !== 'ADELANTO')
  const activePlans = offerings.filter((item) => item.kind === 'PLAN')
  const activePacks = offerings.filter((item) => item.kind === 'PACK')

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View employee portal' : 'Ver portal del colaborador'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('servicio-colaborador')}>{language === 'en' ? 'Open service center' : 'Abrir servicio al colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Requested' : 'Solicitadas', value: rows.filter((item) => item.status === 'SOLICITADA').length, hint: language === 'en' ? 'Pending approval' : 'Pendientes de aprobación', tone: 'amber' },
          { label: language === 'en' ? 'Delivered' : 'Entregadas', value: rows.filter((item) => item.status === 'ENTREGADA').length, hint: language === 'en' ? 'Already granted' : 'Ya otorgadas', tone: 'teal' },
          { label: language === 'en' ? 'Catalog offers' : 'Ofertas catálogo', value: offerings.length, hint: language === 'en' ? 'Plans and packs available' : 'Planes y packs disponibles', tone: 'sky' },
        ]}
      />

      <NominaSubnav />

      <NominaSurfaceCallout
        adminTitle={language === 'en' ? 'This backoffice defines catalog offers and approvals.' : 'Este backoffice define catálogo y aprobaciones.'}
        adminDescription={language === 'en' ? 'RRHH controls which benefit plans, advances and discounts become available or delivered.' : 'RRHH controla qué planes, adelantos y descuentos quedan disponibles o entregados.'}
        employeeTitle={language === 'en' ? 'The collaborator only sees visible benefits and personal requests.' : 'El colaborador solo ve beneficios visibles y sus solicitudes personales.'}
        employeeDescription={language === 'en' ? 'Portal visibility, status and delivery here determine what appears in self-service.' : 'La visibilidad, el estado y la entrega aquí determinan lo que aparece en autoservicio.'}
        primaryHref={nominaHref('portal-empleado')}
        primaryLabel={language === 'en' ? 'Open collaborator portal' : 'Abrir portal del colaborador'}
        secondaryHref={nominaHref('servicio-colaborador')}
        secondaryLabel={language === 'en' ? 'Open service cases' : 'Abrir casos de servicio'}
      />

      <div className="flex justify-end gap-2">
        <DataViewToggle mode={mode} onChange={setMode} />
        <Button variant="outline" className="rounded-xl" onClick={openCreateOffering}>{copy.offeringActions.create}</Button>
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Tabs defaultValue="benefits" className="space-y-4">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 rounded-2xl">
          <TabsTrigger value="benefits">{language === 'en' ? 'Benefits' : 'Beneficios'}</TabsTrigger>
          <TabsTrigger value="advances">{language === 'en' ? 'Advances' : 'Adelantos'}</TabsTrigger>
          <TabsTrigger value="catalog">{language === 'en' ? 'Catalog' : 'Catálogo'}</TabsTrigger>
        </TabsList>
        <TabsContent value="benefits">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{language === 'en' ? 'Points, plans and discount packs' : 'Puntos, planes y packs de descuentos'}</CardTitle>
              <CardDescription>{language === 'en' ? 'Operational request list with plan, vendor and delivery state.' : 'Bandeja operativa de solicitudes con plan, aliado y estado de entrega.'}</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
              {otherBenefits.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.title}</div>
                      <div className="text-sm text-slate-500">{item.employeeName}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{item.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div>{language === 'en' ? 'Type' : 'Tipo'}: {item.type}</div>
                    <div>{language === 'en' ? 'Plan' : 'Plan'}: {item.planName ?? '—'}</div>
                    <div>{language === 'en' ? 'Vendor' : 'Aliado'}: {item.vendorName ?? '—'}</div>
                    <div>{language === 'en' ? 'Points' : 'Puntos'}: {item.pointsCost}</div>
                    <div>{language === 'en' ? 'Amount' : 'Valor'}: {item.amount != null ? formatCurrency(item.amount) : '—'}</div>
                    <div>{language === 'en' ? 'Requested' : 'Solicitada'}: {formatDate(item.requestedAt, locale)}</div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="advances">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{language === 'en' ? 'Payroll advances' : 'Adelantos de nómina'}</CardTitle>
              <CardDescription>{language === 'en' ? 'Requests that anticipate already-worked salary and need approval.' : 'Solicitudes que anticipan salario ya trabajado y requieren aprobación.'}</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2' : 'space-y-3'}>
              {payrollAdvances.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-sky-200 bg-sky-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.employeeName}</div>
                      <div className="text-sm text-slate-500">{item.title}</div>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800">{item.status}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div>{language === 'en' ? 'Plan' : 'Plan'}: {item.planName ?? '—'}</div>
                    <div>{language === 'en' ? 'Amount' : 'Valor'}: {item.amount != null ? formatCurrency(item.amount) : '—'}</div>
                    <div>{language === 'en' ? 'Requested' : 'Solicitada'}: {formatDate(item.requestedAt, locale)}</div>
                    <div>{language === 'en' ? 'Approved' : 'Aprobada'}: {formatDate(item.approvedAt, locale)}</div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="catalog">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{language === 'en' ? 'Benefit plans and discount packs' : 'Planes de beneficios y packs de descuentos'}</CardTitle>
              <CardDescription>{language === 'en' ? 'Real catalog available for future requests, with pricing, spotlight and vendor traceability.' : 'Catálogo real disponible para futuras solicitudes, con pricing, destaque y trazabilidad del aliado.'}</CardDescription>
            </CardHeader>
            <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
              {offerings.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.title}</div>
                      <div className="text-sm text-slate-500">{item.vendorName ?? '—'}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{item.status}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                  <div className="mt-3 space-y-1 text-sm text-slate-600">
                    <div>{language === 'en' ? 'Kind' : 'Tipo'}: {item.kind}</div>
                    <div>{language === 'en' ? 'Category' : 'Categoría'}: {item.category}</div>
                    <div>{language === 'en' ? 'Pricing' : 'Pricing'}: {item.pricingModel}</div>
                    <div>{language === 'en' ? 'Points' : 'Puntos'}: {item.pointsCost}</div>
                    <div>{language === 'en' ? 'Employer cost' : 'Costo empresa'}: {item.employerCost != null ? formatCurrency(item.employerCost) : '—'}</div>
                    <div>{language === 'en' ? 'Employee copay' : 'Copago colaborador'}: {item.employeeCopay != null ? formatCurrency(item.employeeCopay) : '—'}</div>
                    <div>{language === 'en' ? 'Discount rate' : 'Descuento'}: {item.discountRate != null ? `${item.discountRate}%` : '—'}</div>
                    <div>{language === 'en' ? 'Spotlight' : 'Destacado'}: {item.spotlight ? (language === 'en' ? 'Yes' : 'Sí') : 'No'}</div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => openEditOffering(item)}>{copy.offeringActions.edit}</Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleDeleteOffering(item.id)}>{copy.offeringActions.remove}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-[26px] border-slate-200">
              <CardHeader>
                <CardTitle>{language === 'en' ? 'Active plans' : 'Planes activos'}</CardTitle>
                <CardDescription>{language === 'en' ? 'Benefits with recurring or structured coverage.' : 'Beneficios con cobertura recurrente o estructurada.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activePlans.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <div className="font-medium text-slate-950">{item.title}</div>
                    <div>{item.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="rounded-[26px] border-slate-200">
              <CardHeader>
                <CardTitle>{language === 'en' ? 'Active packs' : 'Packs activos'}</CardTitle>
                <CardDescription>{language === 'en' ? 'Discount bundles and partner-backed offers.' : 'Combos de descuentos y ofertas respaldadas por aliados.'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {activePacks.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <div className="font-medium text-slate-950">{item.title}</div>
                    <div>{item.description}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.dialog.title}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Employee' : 'Empleado'}</Label><Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Type' : 'Tipo'}</Label><Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUNTOS">{language === 'en' ? 'Points' : 'Puntos'}</SelectItem><SelectItem value="ADELANTO">{language === 'en' ? 'Payroll advance' : 'Adelanto'}</SelectItem><SelectItem value="DESCUENTO">{language === 'en' ? 'Discount pack' : 'Descuento'}</SelectItem><SelectItem value="SALUD">{language === 'en' ? 'Health plan' : 'Plan de salud'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SOLICITADA">{language === 'en' ? 'Requested' : 'Solicitada'}</SelectItem><SelectItem value="APROBADA">{language === 'en' ? 'Approved' : 'Aprobada'}</SelectItem><SelectItem value="RECHAZADA">{language === 'en' ? 'Rejected' : 'Rechazada'}</SelectItem><SelectItem value="ENTREGADA">{language === 'en' ? 'Delivered' : 'Entregada'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Plan' : 'Plan'}</Label><Input value={form.planName} onChange={(event) => setForm((current) => ({ ...current, planName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Vendor' : 'Aliado'}</Label><Input value={form.vendorName} onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Points cost' : 'Costo en puntos'}</Label><Input type="number" value={form.pointsCost} onChange={(event) => setForm((current) => ({ ...current, pointsCost: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Amount' : 'Valor'}</Label><Input type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Requested at' : 'Fecha solicitud'}</Label><Input type="date" value={form.requestedAt} onChange={(event) => setForm((current) => ({ ...current, requestedAt: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Description' : 'Descripción'}</Label><Textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{copy.actions.cancel}</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingId ? copy.actions.save : copy.actions.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={offeringDialogOpen} onOpenChange={setOfferingDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.offeringDialog.title}</DialogTitle>
            <DialogDescription>{copy.offeringDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={offeringForm.title} onChange={(event) => setOfferingForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Kind' : 'Tipo'}</Label><Select value={offeringForm.kind} onValueChange={(value) => setOfferingForm((current) => ({ ...current, kind: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PLAN">{language === 'en' ? 'Plan' : 'Plan'}</SelectItem><SelectItem value="PACK">{language === 'en' ? 'Pack' : 'Pack'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Category' : 'Categoría'}</Label><Select value={offeringForm.category} onValueChange={(value) => setOfferingForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SALUD">{language === 'en' ? 'Health' : 'Salud'}</SelectItem><SelectItem value="DESCUENTOS">{language === 'en' ? 'Discounts' : 'Descuentos'}</SelectItem><SelectItem value="FINANCIERO">{language === 'en' ? 'Financial' : 'Financiero'}</SelectItem><SelectItem value="BIENESTAR">{language === 'en' ? 'Wellbeing' : 'Bienestar'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Vendor' : 'Aliado'}</Label><Input value={offeringForm.vendorName} onChange={(event) => setOfferingForm((current) => ({ ...current, vendorName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={offeringForm.status} onValueChange={(value) => setOfferingForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVO">{language === 'en' ? 'Active' : 'Activo'}</SelectItem><SelectItem value="PAUSADO">{language === 'en' ? 'Paused' : 'Pausado'}</SelectItem><SelectItem value="BORRADOR">{language === 'en' ? 'Draft' : 'Borrador'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Pricing model' : 'Modelo de pricing'}</Label><Select value={offeringForm.pricingModel} onValueChange={(value) => setOfferingForm((current) => ({ ...current, pricingModel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PUNTOS">{language === 'en' ? 'Points' : 'Puntos'}</SelectItem><SelectItem value="COPAGO">{language === 'en' ? 'Copay' : 'Copago'}</SelectItem><SelectItem value="NOMINA">{language === 'en' ? 'Payroll' : 'Nómina'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Points cost' : 'Costo en puntos'}</Label><Input type="number" value={offeringForm.pointsCost} onChange={(event) => setOfferingForm((current) => ({ ...current, pointsCost: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Employer cost' : 'Costo empresa'}</Label><Input type="number" value={offeringForm.employerCost} onChange={(event) => setOfferingForm((current) => ({ ...current, employerCost: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Employee copay' : 'Copago colaborador'}</Label><Input type="number" value={offeringForm.employeeCopay} onChange={(event) => setOfferingForm((current) => ({ ...current, employeeCopay: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Discount rate' : 'Porcentaje descuento'}</Label><Input type="number" value={offeringForm.discountRate} onChange={(event) => setOfferingForm((current) => ({ ...current, discountRate: event.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 md:col-span-2"><div><Label>{language === 'en' ? 'Spotlight' : 'Destacado'}</Label><p className="text-xs text-slate-500">{language === 'en' ? 'Show this offer as a highlighted catalog option.' : 'Muestra esta oferta como opción destacada dentro del catálogo.'}</p></div><Switch checked={offeringForm.spotlight} onCheckedChange={(checked) => setOfferingForm((current) => ({ ...current, spotlight: checked }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Description' : 'Descripción'}</Label><Textarea rows={3} value={offeringForm.description} onChange={(event) => setOfferingForm((current) => ({ ...current, description: event.target.value }))} /></div>
          </div>
          {offeringError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{offeringError}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferingDialogOpen(false)}>{copy.offeringActions.cancel}</Button>
            <Button onClick={() => void handleSaveOffering()} disabled={savingOffering}>{savingOffering ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingOfferingId ? copy.offeringActions.save : copy.offeringActions.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}