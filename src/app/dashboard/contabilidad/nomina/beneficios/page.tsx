'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ImageIcon, Star, Users } from 'lucide-react'
import { useI18n } from '@/components/providers/i18n-provider'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

function CatalogImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return (
    <div className="flex aspect-[16/7] w-full items-center justify-center overflow-hidden bg-slate-100 text-slate-400">
      {src && !failed ? <img src={src} alt={alt} className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <ImageIcon className="h-9 w-9" aria-hidden="true" />}
    </div>
  )
}

function BenefitRequestsTable({ rows, language, locale, onEdit, onDelete }: { rows: PayrollBenefitRequestRow[]; language: string; locale: string; onEdit: (item: PayrollBenefitRequestRow) => void; onDelete: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-3 py-2.5">{language === 'en' ? 'Employee' : 'Colaborador'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Request' : 'Solicitud'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Plan / vendor' : 'Plan / aliado'}</th>
            <th className="px-3 py-2.5 text-right">{language === 'en' ? 'Points' : 'Puntos'}</th>
            <th className="px-3 py-2.5 text-right">{language === 'en' ? 'Amount' : 'Valor'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Requested' : 'Solicitada'}</th>
            <th className="px-3 py-2.5">{language === 'en' ? 'Status' : 'Estado'}</th>
            <th className="px-3 py-2.5 text-right">{language === 'en' ? 'Actions' : 'Acciones'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/70">
              <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-950">{item.employeeName}</td>
              <td className="max-w-[240px] px-3 py-2.5"><div className="truncate text-slate-800">{item.title}</div><div className="truncate text-xs text-slate-500" title={item.description}>{item.type} · {item.description}</div></td>
              <td className="px-3 py-2.5"><div className="text-slate-700">{item.planName ?? '—'}</div><div className="text-xs text-slate-500">{item.vendorName ?? '—'}</div></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{item.pointsCost}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-700">{item.amount != null ? formatCurrency(item.amount) : '—'}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-slate-700"><div>{formatDate(item.requestedAt, locale)}</div>{item.approvedAt ? <div className="text-xs text-slate-500">{language === 'en' ? 'Approved' : 'Aprobada'}: {formatDate(item.approvedAt, locale)}</div> : null}</td>
              <td className="px-3 py-2.5"><span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-700">{item.status}</span></td>
              <td className="px-3 py-2.5"><div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => onEdit(item)}>{language === 'en' ? 'Edit' : 'Editar'}</Button><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => onDelete(item.id)}>{language === 'en' ? 'Delete' : 'Eliminar'}</Button></div></td>
            </tr>
          ))}
          {!rows.length ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{language === 'en' ? 'No requests yet.' : 'No hay solicitudes todavía.'}</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
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
  const [offeringImageFile, setOfferingImageFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offeringError, setOfferingError] = useState<string | null>(null)
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
    setOfferingImageFile(null)
    setOfferingDialogOpen(true)
  }

  function openEditOffering(item: PayrollBenefitOfferingRow) {
    setEditingOfferingId(item.id)
    setOfferingError(null)
    setOfferingImageFile(null)
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
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; createdId?: string } | null
    if (!res.ok || !json?.ok) {
      setOfferingError(json?.error ?? (language === 'en' ? 'Unable to save offer' : 'No fue posible guardar la oferta'))
      setSavingOffering(false)
      return
    }
    const offeringId = editingOfferingId ?? json.createdId
    if (offeringImageFile && offeringId) {
      const imageForm = new FormData()
      imageForm.set('file', offeringImageFile)
      const uploadRes = await fetch(`/api/nomina/beneficios/ofertas/${offeringId}/imagen`, { method: 'POST', body: imageForm })
      const uploadJson = (await uploadRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!uploadRes.ok || !uploadJson?.ok) {
        setOfferingError(uploadJson?.error ?? (language === 'en' ? 'The offer was saved, but its image could not be uploaded.' : 'La oferta se guardó, pero no fue posible subir la imagen.'))
        setSavingOffering(false)
        await load()
        return
      }
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

      <div className="flex justify-end gap-2">
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
            <CardContent>
              <BenefitRequestsTable rows={otherBenefits} language={language} locale={locale} onEdit={openEdit} onDelete={(id) => void handleDelete(id)} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="advances">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{language === 'en' ? 'Payroll advances' : 'Adelantos de nómina'}</CardTitle>
              <CardDescription>{language === 'en' ? 'Requests that anticipate already-worked salary and need approval.' : 'Solicitudes que anticipan salario ya trabajado y requieren aprobación.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <BenefitRequestsTable rows={payrollAdvances} language={language} locale={locale} onEdit={openEdit} onDelete={(id) => void handleDelete(id)} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="catalog">
          <Card className="rounded-[26px] border-slate-200">
            <CardHeader>
              <CardTitle>{language === 'en' ? 'Benefit plans and discount packs' : 'Planes de beneficios y packs de descuentos'}</CardTitle>
              <CardDescription>{language === 'en' ? 'Real catalog available for future requests, with pricing, spotlight and vendor traceability.' : 'Catálogo real disponible para futuras solicitudes, con pricing, destaque y trazabilidad del aliado.'}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {offerings.map((item) => (
                <article key={item.id} className="flex overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm">
                  <div className="flex w-full flex-col">
                    <CatalogImage src={item.imageUrl} alt={item.title} />
                    <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{item.title}</div>
                      <div className="text-sm text-slate-500">{item.vendorName ?? '—'}</div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">{item.status}</span>
                  </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5" aria-label={`${item.rating} ${language === 'en' ? 'stars' : 'estrellas'}`}>
                          {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={star <= item.rating ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 text-slate-300'} />)}
                        </div>
                        {item.rating === 5 && item.usageCount > 0 ? <span className="text-[10px] font-semibold uppercase text-amber-700">{language === 'en' ? 'Most used' : 'Más usado'}</span> : null}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{item.usageCount} {language === 'en' ? 'users' : 'colaboradores'}</div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-600">{item.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                      <div>{language === 'en' ? 'Category' : 'Categoría'}: <span className="font-medium text-slate-800">{item.category}</span></div>
                      <div>{language === 'en' ? 'Pricing' : 'Precio'}: <span className="font-medium text-slate-800">{item.pricingModel}</span></div>
                      <div>{language === 'en' ? 'Points' : 'Puntos'}: <span className="font-medium text-slate-800">{item.pointsCost}</span></div>
                      <div>{language === 'en' ? 'Copay' : 'Copago'}: <span className="font-medium text-slate-800">{item.employeeCopay != null ? formatCurrency(item.employeeCopay) : '—'}</span></div>
                      <div>{language === 'en' ? 'Employer' : 'Empresa'}: <span className="font-medium text-slate-800">{item.employerCost != null ? formatCurrency(item.employerCost) : '—'}</span></div>
                      <div>{language === 'en' ? 'Discount' : 'Descuento'}: <span className="font-medium text-slate-800">{item.discountRate != null ? `${item.discountRate}%` : '—'}</span></div>
                  </div>
                    <div className="mt-auto flex justify-end gap-2 pt-4">
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openEditOffering(item)}>{copy.offeringActions.edit}</Button>
                      <Button size="sm" variant="outline" className="rounded-lg" onClick={() => void handleDeleteOffering(item.id)}>{copy.offeringActions.remove}</Button>
                    </div>
                    </div>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.offeringDialog.title}</DialogTitle>
            <DialogDescription>{copy.offeringDialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <Label>{language === 'en' ? 'Catalog image' : 'Imagen del catálogo'}</Label>
              {editingOfferingId ? <CatalogImage src={offerings.find((item) => item.id === editingOfferingId)?.imageUrl ?? null} alt={offeringForm.title || 'Oferta'} /> : null}
              <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setOfferingImageFile(event.target.files?.[0] ?? null)} />
              <p className="text-xs text-slate-500">{language === 'en' ? 'JPG, PNG or WebP. Maximum 2 MB.' : 'JPG, PNG o WebP. Máximo 2 MB.'}</p>
            </div>
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