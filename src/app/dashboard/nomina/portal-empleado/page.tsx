'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarDays, FileText, Gift, ShieldAlert, Stethoscope, UserRound } from 'lucide-react'
import { ErpPageHero, ErpSectionHeading } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { useDashboardAccess } from '@/components/dashboard/dashboard-access-context'
import { formatCurrency } from '@/lib/utils'
import { nominaHref } from '@/lib/nomina-routes'

type PortalData = {
  user: { name: string | null; email: string | null }
  employee: null | {
    fullName: string
    role: string
    document: string
    sede: string
    costCenter: string
    personalEmail: string | null
    phone: string | null
    city: string | null
    address: string | null
    notes: string | null
    salary: number
    vacation: { earnedDays: number; takenDays: number; availableDays: number }
  }
  payslips: Array<{ id: string; periodLabel: string; paymentDate: string; netPay: number; signed: boolean; fileUrl?: string | null }>
  documents: Array<{ id: string; title: string; category: string; status: string; signatureStatus: string; fileUrl?: string | null }>
  benefits: Array<{ id: string; title: string; description: string; status: string; vendorName?: string | null; amount?: number | null; pointsCost: number }>
  novelties: Array<{ id: string; type: string; detail: string; status: string; startsAt?: string | null; endsAt?: string | null; days?: number | null; supportUrl?: string | null }>
  complaints: Array<{ id: string; title: string; category: string; severity: string; status: string; anonymousReport: boolean; createdAt: string; summary: string }>
  offers: Array<{ id: string; title: string; category: string; vendorName?: string | null; description: string; pointsCost: number; employeeCopay?: number | null; discountRate?: number | null }>
}

const EMPTY_PROFILE = {
  personalEmail: '',
  phone: '',
  city: '',
  address: '',
  jobTitle: '',
  notes: '',
}

const EMPTY_LEAVE = {
  detail: '',
  occurredOn: '',
  startsAt: '',
  endsAt: '',
  days: '',
  file: null as File | null,
}

const EMPTY_COMPLAINT = {
  title: '',
  category: 'ETICA',
  severity: 'MEDIA',
  confidentialityLevel: 'ALTA',
  accusedArea: '',
  occurredAt: '',
  summary: '',
  evidenceSummary: '',
  notes: '',
  anonymousReport: false,
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function NominaPortalEmpleadoPage() {
  const { canAccessPayrollAdmin } = useDashboardAccess()
  const [data, setData] = useState<PortalData | null>(null)
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE)
  const [leaveForm, setLeaveForm] = useState(EMPTY_LEAVE)
  const [complaintForm, setComplaintForm] = useState(EMPTY_COMPLAINT)
  const [profileSaving, setProfileSaving] = useState(false)
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [complaintSaving, setComplaintSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/nomina/portal', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: PortalData; error?: string } | null
    if (!res.ok || !json?.success || !json.data) {
      setError(json?.error ?? 'No fue posible cargar el portal del empleado.')
      return
    }
    setData(json.data)
    setError(null)
    if (json.data.employee) {
      setProfileForm({
        personalEmail: json.data.employee.personalEmail ?? '',
        phone: json.data.employee.phone ?? '',
        city: json.data.employee.city ?? '',
        address: json.data.employee.address ?? '',
        jobTitle: json.data.employee.role ?? '',
        notes: json.data.employee.notes ?? '',
      })
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const payslips = data?.payslips ?? []
  const documents = data?.documents ?? []
  const benefits = data?.benefits ?? []
  const novelties = data?.novelties ?? []
  const complaints = data?.complaints ?? []
  const offers = data?.offers ?? []

  const pendingBenefits = useMemo(() => benefits.filter((item) => item.status !== 'ENTREGADA').length, [benefits])
  const incapacityHistory = useMemo(() => novelties.filter((item) => item.type === 'INCAPACIDAD'), [novelties])

  async function saveProfile() {
    setProfileSaving(true)
    setMessage(null)
    setError(null)
    const res = await fetch('/api/nomina/portal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileForm),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: PortalData; error?: string } | null
    if (!res.ok || !json?.success || !json.data) {
      setError(json?.error ?? 'No fue posible guardar tu perfil.')
      setProfileSaving(false)
      return
    }
    setData(json.data)
    setMessage('Tu información fue actualizada.')
    setProfileSaving(false)
  }

  async function submitIncapacity() {
    setLeaveSaving(true)
    setMessage(null)
    setError(null)
    const form = new FormData()
    form.set('action', 'incapacidad')
    form.set('detail', leaveForm.detail)
    form.set('occurredOn', leaveForm.occurredOn)
    form.set('startsAt', leaveForm.startsAt)
    form.set('endsAt', leaveForm.endsAt)
    form.set('days', leaveForm.days)
    if (leaveForm.file) form.set('file', leaveForm.file)

    const res = await fetch('/api/nomina/portal', { method: 'POST', body: form })
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: PortalData; error?: string } | null
    if (!res.ok || !json?.success || !json.data) {
      setError(json?.error ?? 'No fue posible radicar la incapacidad.')
      setLeaveSaving(false)
      return
    }
    setData(json.data)
    setLeaveForm(EMPTY_LEAVE)
    setMessage('La incapacidad fue radicada correctamente.')
    setLeaveSaving(false)
  }

  async function submitComplaint() {
    setComplaintSaving(true)
    setMessage(null)
    setError(null)
    const res = await fetch('/api/nomina/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'denuncia', ...complaintForm }),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; data?: PortalData; error?: string } | null
    if (!res.ok || !json?.success || !json.data) {
      setError(json?.error ?? 'No fue posible enviar la denuncia.')
      setComplaintSaving(false)
      return
    }
    setData(json.data)
    setComplaintForm(EMPTY_COMPLAINT)
    setMessage('La denuncia fue enviada al canal confidencial.')
    setComplaintSaving(false)
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow={canAccessPayrollAdmin ? 'Portal del colaborador' : 'Autoservicio'}
        title="Portal del empleado"
        description={canAccessPayrollAdmin
          ? 'Vista personal separada del backoffice para revisar la experiencia del colaborador sin mezclarla con la operación de RRHH.'
          : 'Cada colaborador ve solo su propia información: contacto, desprendibles, vacaciones, incapacidades, beneficios y denuncias confidenciales.'}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref()}>{canAccessPayrollAdmin ? 'Volver a RRHH' : 'Ir a mi resumen'}</Link>
            </Button>
            {canAccessPayrollAdmin ? (
              <Button asChild variant="outline" className="rounded-2xl bg-white/90">
                <Link href={nominaHref('reportes')}>Ver documentos RRHH</Link>
              </Button>
            ) : null}
          </>
        }
        stats={[
          { label: 'Vacaciones', value: data?.employee?.vacation.availableDays ?? 0, hint: 'Días disponibles', tone: 'teal' },
          { label: 'Desprendibles', value: payslips.length, hint: 'Historial reciente', tone: 'sky' },
          { label: 'Beneficios', value: pendingBenefits, hint: 'Solicitudes activas', tone: 'amber' },
        ]}
      />

      <NominaSubnav />

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!data?.employee ? (
        <Card className="rounded-[28px] border-slate-200">
          <CardHeader>
            <CardTitle>No hay perfil laboral asociado</CardTitle>
            <CardDescription>Tu usuario está autenticado, pero todavía no tiene una ficha de empleado vinculada en nómina.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('servicio-colaborador')}>Solicitar vinculación</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserRound className="h-4 w-4 text-sky-700" /> Mi perfil</CardTitle>
                <CardDescription>Edita solo la información de contacto y tu perfil profesional visible para RRHH.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Correo de contacto</Label>
                  <Input value={profileForm.personalEmail} onChange={(event) => setProfileForm((current) => ({ ...current, personalEmail: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input value={profileForm.city} onChange={(event) => setProfileForm((current) => ({ ...current, city: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Cargo o enfoque profesional</Label>
                  <Input value={profileForm.jobTitle} onChange={(event) => setProfileForm((current) => ({ ...current, jobTitle: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Dirección</Label>
                  <Input value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Información profesional adicional</Label>
                  <Textarea rows={4} value={profileForm.notes} onChange={(event) => setProfileForm((current) => ({ ...current, notes: event.target.value }))} />
                </div>
                <div className="md:col-span-2 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{data.employee.fullName}</div>
                    <div className="text-slate-500">{data.employee.document} · {data.employee.sede} · {data.employee.costCenter}</div>
                  </div>
                  <Button className="rounded-2xl" disabled={profileSaving} onClick={() => void saveProfile()}>{profileSaving ? 'Guardando...' : 'Guardar cambios'}</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-emerald-700" /> Vacaciones y saldo</CardTitle>
                  <CardDescription>Estimación visible para el colaborador a partir de antigüedad y días registrados.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Ganados</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{data.employee.vacation.earnedDays}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Tomados</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-950">{data.employee.vacation.takenDays}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Disponibles</div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-700">{data.employee.vacation.availableDays}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Gift className="h-4 w-4 text-violet-700" /> Beneficios y descuentos</CardTitle>
                  <CardDescription>Solicitudes personales y catálogo visible para el colaborador.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {benefits.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                      <div className="mt-2 text-sm text-slate-600">{item.vendorName ?? 'Beneficio interno'} · {item.status}</div>
                    </div>
                  ))}
                  {offers.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-4">
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <div className="mt-1 text-sm text-slate-500">{item.description}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <ErpSectionHeading title="Desprendibles y documentos" description="Recibos recientes y documentos visibles en el portal." />
              </CardHeader>
              <CardContent className="space-y-3">
                {payslips.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-950">{item.periodLabel}</div>
                      <div className="text-sm text-slate-500">{formatDate(item.paymentDate)} · {formatCurrency(item.netPay)}</div>
                    </div>
                    <div className="text-sm text-slate-600">{item.signed ? 'Firmado' : 'Pendiente'}</div>
                  </div>
                ))}
                {documents.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <div className="font-medium text-slate-950">{item.title}</div>
                      <div className="text-sm text-slate-500">{item.category} · {item.signatureStatus}</div>
                    </div>
                    {item.fileUrl ? <Link href={item.fileUrl} className="text-sm font-medium text-sky-700">Abrir</Link> : <span className="text-sm text-slate-500">Sin archivo</span>}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4 text-rose-700" /> Subir incapacidad</CardTitle>
                <CardDescription>Radica tu novedad médica con fechas, detalle y soporte PDF o imagen.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Motivo o detalle</Label>
                  <Textarea rows={3} value={leaveForm.detail} onChange={(event) => setLeaveForm((current) => ({ ...current, detail: event.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha inicio</Label>
                    <Input type="date" value={leaveForm.startsAt} onChange={(event) => setLeaveForm((current) => ({ ...current, startsAt: event.target.value, occurredOn: current.occurredOn || event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha fin</Label>
                    <Input type="date" value={leaveForm.endsAt} onChange={(event) => setLeaveForm((current) => ({ ...current, endsAt: event.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Días reconocidos</Label>
                    <Input value={leaveForm.days} onChange={(event) => setLeaveForm((current) => ({ ...current, days: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Soporte</Label>
                    <Input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setLeaveForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} />
                  </div>
                </div>
                <Button className="w-full rounded-2xl" disabled={leaveSaving} onClick={() => void submitIncapacity()}>{leaveSaving ? 'Enviando...' : 'Radicar incapacidad'}</Button>
                <div className="space-y-2">
                  {incapacityHistory.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-600">
                      <div className="font-medium text-slate-900">{item.detail}</div>
                      <div>{item.startsAt ? formatDate(item.startsAt) : 'Sin fecha'} a {item.endsAt ? formatDate(item.endsAt) : 'Sin fecha'} · {item.status}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-amber-700" /> Canal de denuncias</CardTitle>
                <CardDescription>Formulario breve, confidencial y trazable para ética, acoso, fraude o conflictos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Título del caso</Label>
                  <Input value={complaintForm.title} onChange={(event) => setComplaintForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Categoría</Label>
                    <Input value={complaintForm.category} onChange={(event) => setComplaintForm((current) => ({ ...current, category: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Severidad</Label>
                    <Input value={complaintForm.severity} onChange={(event) => setComplaintForm((current) => ({ ...current, severity: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Área involucrada</Label>
                  <Input value={complaintForm.accusedArea} onChange={(event) => setComplaintForm((current) => ({ ...current, accusedArea: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>¿Qué ocurrió?</Label>
                  <Textarea rows={4} value={complaintForm.summary} onChange={(event) => setComplaintForm((current) => ({ ...current, summary: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Evidencia o contexto adicional</Label>
                  <Textarea rows={3} value={complaintForm.evidenceSummary} onChange={(event) => setComplaintForm((current) => ({ ...current, evidenceSummary: event.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Enviar como anónimo</div>
                    <div className="text-xs text-slate-500">Oculta tu identidad en la radicación inicial.</div>
                  </div>
                  <Switch checked={complaintForm.anonymousReport} onCheckedChange={(checked) => setComplaintForm((current) => ({ ...current, anonymousReport: checked }))} />
                </div>
                <Button className="w-full rounded-2xl" disabled={complaintSaving} onClick={() => void submitComplaint()}>{complaintSaving ? 'Enviando...' : 'Enviar denuncia'}</Button>
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_45px_-32px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-slate-700" /> Historial personal</CardTitle>
                <CardDescription>Seguimiento de tus reportes y solicitudes visibles dentro del portal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {complaints.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="font-medium text-slate-950">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.category} · {item.status} · {formatDate(item.createdAt)}</div>
                    <div className="mt-2 text-sm text-slate-600">{item.summary}</div>
                  </div>
                ))}
                {complaints.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Aún no has radicado denuncias desde este portal.</div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}