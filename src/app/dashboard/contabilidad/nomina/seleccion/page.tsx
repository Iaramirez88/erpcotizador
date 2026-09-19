'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaCompactTable, NominaStatusBadge } from '@/components/dashboard/nomina-compact-table'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollRecruitmentCandidateRow } from '@/lib/payroll'
import { formatCurrency } from '@/lib/utils'

const EMPTY_FORM = {
  openingTitle: '',
  department: '',
  locationLabel: '',
  candidateName: '',
  candidateEmail: '',
  candidatePhone: '',
  source: 'REFERIDO',
  stage: 'SCREENING',
  status: 'ACTIVO',
  score: '0',
  salaryExpectation: '',
  expectedStartDate: '',
  interviewerNotes: '',
  decisionSummary: '',
  resumeUrl: '',
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

export default function NominaSeleccionPage() {
  const [rows, setRows] = useState<PayrollRecruitmentCandidateRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Recruiting admin',
        title: 'Recruiting',
        description: 'RRHH recruiting backoffice for openings, candidate stages and hiring readiness before the person enters onboarding and the collaborator experience.',
        actions: { create: 'Create candidate', save: 'Save changes', add: 'Create candidate', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Candidate pipeline', description: 'Store the opening, candidate profile, stage, salary expectation and interviewer notes.' },
      }
    : {
        eyebrow: 'Selección RRHH',
        title: 'Selección',
        description: 'Backoffice de selección RRHH para vacantes, etapas y alistamiento de contratación antes de pasar al onboarding y a la experiencia del colaborador.',
        actions: { create: 'Crear candidato', save: 'Guardar cambios', add: 'Crear candidato', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Pipeline de candidato', description: 'Guarda la vacante, el perfil del candidato, la etapa, la aspiración salarial y las notas de entrevista.' },
      }

  async function load() {
    const res = await fetch('/api/nomina/seleccion', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { data?: PayrollRecruitmentCandidateRow[] } | null
    setRows(json?.data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setError(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(item: PayrollRecruitmentCandidateRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      openingTitle: item.openingTitle,
      department: item.department,
      locationLabel: item.locationLabel ?? '',
      candidateName: item.candidateName,
      candidateEmail: item.candidateEmail ?? '',
      candidatePhone: item.candidatePhone ?? '',
      source: item.source,
      stage: item.stage,
      status: item.status,
      score: String(item.score),
      salaryExpectation: item.salaryExpectation != null ? String(item.salaryExpectation) : '',
      expectedStartDate: item.expectedStartDate?.slice(0, 10) ?? '',
      interviewerNotes: item.interviewerNotes ?? '',
      decisionSummary: item.decisionSummary ?? '',
      resumeUrl: item.resumeUrl ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      score: Number(form.score || 0),
      salaryExpectation: form.salaryExpectation ? Number(form.salaryExpectation) : null,
    }
    const res = await fetch('/api/nomina/seleccion', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save candidate' : 'No fue posible guardar el candidato'))
      setSaving(false)
      return
    }
    setDialogOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm(language === 'en' ? 'Delete this candidate?' : '¿Eliminar este candidato?')) return
    const res = await fetch('/api/nomina/seleccion', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete candidate' : 'No fue posible eliminar el candidato'))
      return
    }
    await load()
  }

  return (
    <div className="space-y-4">
      <ErpPageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={
          <>
            <Button asChild className="rounded-2xl">
              <Link href={nominaHref('onboarding')}>{language === 'en' ? 'Open onboarding' : 'Abrir onboarding'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Active' : 'Activos', value: rows.filter((item) => item.status === 'ACTIVO').length, hint: language === 'en' ? 'Open pipeline' : 'Pipeline abierto', tone: 'sky' },
          { label: language === 'en' ? 'Interviews' : 'Entrevistas', value: rows.filter((item) => item.stage === 'ENTREVISTA').length, hint: language === 'en' ? 'In assessment' : 'En evaluación', tone: 'amber' },
          { label: language === 'en' ? 'Finalists' : 'Finalistas', value: rows.filter((item) => item.status === 'FINALISTA').length, hint: language === 'en' ? 'Ready for offer' : 'Listos para oferta', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end">
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Candidate pipeline' : 'Pipeline de candidatos'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Administrative recruiting tray to qualify candidates before they move into onboarding and employee setup.' : 'Bandeja administrativa de selección para calificar candidatos antes de pasarlos a onboarding y alta laboral.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <NominaCompactTable rows={rows} minWidth="1080px" emptyMessage={language === 'en' ? 'No candidates yet.' : 'No hay candidatos todavía.'} columns={[
            { key: 'candidate', label: language === 'en' ? 'Candidate / opening' : 'Candidato / vacante', className: 'max-w-[260px]', render: (item) => <><div className="truncate font-medium text-slate-950">{item.candidateName}</div><div className="truncate text-xs text-slate-700">{item.openingTitle}</div><div className="truncate text-xs text-slate-400">{item.candidateEmail ?? item.candidatePhone ?? '—'}</div></> },
            { key: 'area', label: language === 'en' ? 'Area / location' : 'Área / ubicación', render: (item) => <><div>{item.department}</div><div className="text-xs text-slate-500">{item.locationLabel ?? '—'}</div></> },
            { key: 'pipeline', label: language === 'en' ? 'Stage / source' : 'Etapa / fuente', render: (item) => <><div>{item.stage.replaceAll('_', ' ')}</div><div className="text-xs text-slate-500">{item.source.replaceAll('_', ' ')}</div></> },
            { key: 'score', label: 'Score', className: 'text-center font-semibold tabular-nums', headerClassName: 'text-center', render: (item) => item.score },
            { key: 'owner', label: language === 'en' ? 'Recruiter' : 'Responsable', className: 'max-w-[170px]', render: (item) => <div className="truncate">{item.ownerName ?? '—'}</div> },
            { key: 'terms', label: language === 'en' ? 'Start / expectation' : 'Ingreso / aspiración', className: 'whitespace-nowrap', render: (item) => <><div>{formatDate(item.expectedStartDate ?? null, locale)}</div><div className="text-xs text-slate-500">{item.salaryExpectation != null ? formatCurrency(item.salaryExpectation) : '—'}</div></> },
            { key: 'status', label: language === 'en' ? 'Status' : 'Estado', render: (item) => <NominaStatusBadge status={item.status} /> },
            { key: 'actions', label: language === 'en' ? 'Actions' : 'Acciones', headerClassName: 'text-right', render: (item) => <div className="flex justify-end gap-1.5"><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => openEdit(item)}>{copy.actions.edit}</Button><Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button></div> },
          ]} />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.dialog.title}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>{language === 'en' ? 'Opening title' : 'Vacante'}</Label><Input value={form.openingTitle} onChange={(event) => setForm((current) => ({ ...current, openingTitle: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Department' : 'Área'}</Label><Input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Candidate name' : 'Candidato'}</Label><Input value={form.candidateName} onChange={(event) => setForm((current) => ({ ...current, candidateName: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Location' : 'Ubicación'}</Label><Input value={form.locationLabel} onChange={(event) => setForm((current) => ({ ...current, locationLabel: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>Email</Label><Input value={form.candidateEmail} onChange={(event) => setForm((current) => ({ ...current, candidateEmail: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Phone' : 'Teléfono'}</Label><Input value={form.candidatePhone} onChange={(event) => setForm((current) => ({ ...current, candidatePhone: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Source' : 'Fuente'}</Label><Select value={form.source} onValueChange={(value) => setForm((current) => ({ ...current, source: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="REFERIDO">{language === 'en' ? 'Referral' : 'Referido'}</SelectItem><SelectItem value="LINKEDIN">LinkedIn</SelectItem><SelectItem value="BOLSA_EMPLEO">{language === 'en' ? 'Job board' : 'Bolsa de empleo'}</SelectItem><SelectItem value="BASE_INTERNA">{language === 'en' ? 'Internal base' : 'Base interna'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Stage' : 'Etapa'}</Label><Select value={form.stage} onValueChange={(value) => setForm((current) => ({ ...current, stage: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SCREENING">Screening</SelectItem><SelectItem value="ENTREVISTA">{language === 'en' ? 'Interview' : 'Entrevista'}</SelectItem><SelectItem value="PRUEBA">{language === 'en' ? 'Assessment' : 'Prueba'}</SelectItem><SelectItem value="OFERTA">{language === 'en' ? 'Offer' : 'Oferta'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVO">{language === 'en' ? 'Active' : 'Activo'}</SelectItem><SelectItem value="FINALISTA">{language === 'en' ? 'Finalist' : 'Finalista'}</SelectItem><SelectItem value="DESCARTADO">{language === 'en' ? 'Rejected' : 'Descartado'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>Score</Label><Input type="number" value={form.score} onChange={(event) => setForm((current) => ({ ...current, score: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Salary expectation' : 'Aspiración salarial'}</Label><Input type="number" value={form.salaryExpectation} onChange={(event) => setForm((current) => ({ ...current, salaryExpectation: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Expected start' : 'Ingreso esperado'}</Label><Input type="date" value={form.expectedStartDate} onChange={(event) => setForm((current) => ({ ...current, expectedStartDate: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Interviewer notes' : 'Notas de entrevista'}</Label><Textarea rows={3} value={form.interviewerNotes} onChange={(event) => setForm((current) => ({ ...current, interviewerNotes: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Decision summary' : 'Resumen de decisión'}</Label><Textarea rows={3} value={form.decisionSummary} onChange={(event) => setForm((current) => ({ ...current, decisionSummary: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Resume URL' : 'URL de hoja de vida'}</Label><Input value={form.resumeUrl} onChange={(event) => setForm((current) => ({ ...current, resumeUrl: event.target.value }))} /></div>
          </div>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{copy.actions.cancel}</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>{saving ? (language === 'en' ? 'Saving...' : 'Guardando...') : editingId ? copy.actions.save : copy.actions.add}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
