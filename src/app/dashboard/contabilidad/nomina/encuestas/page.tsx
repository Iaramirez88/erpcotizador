'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useI18n } from '@/components/providers/i18n-provider'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { NominaSubnav } from '@/components/dashboard/nomina-subnav'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { nominaHref } from '@/lib/nomina-routes'
import type { PayrollSurveyCampaignRow } from '@/lib/payroll'

const EMPTY_FORM = {
  title: '',
  category: 'CLIMA',
  status: 'BORRADOR',
  anonymous: true,
  audience: '',
  channel: 'PORTAL',
  questionsCount: '0',
  invitedCount: '0',
  responsesCount: '0',
  averageScore: '',
  opensAt: '',
  closesAt: '',
  summary: '',
  notes: '',
}

function formatDate(value: string | null, locale: string) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return value
  }
}

function statusClass(status: string) {
  if (status === 'ACTIVA') return 'rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-800'
  if (status === 'CERRADA') return 'rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800'
  if (status === 'PROGRAMADA') return 'rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800'
  return 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700'
}

export default function NominaEncuestasPage() {
  const [rows, setRows] = useState<PayrollSurveyCampaignRow[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { mode, setMode } = useDataViewMode('nomina.encuestas', 'grid')
  const { language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'

  const copy = language === 'en'
    ? {
        eyebrow: 'Survey admin',
        title: 'Surveys',
        description: 'RRHH survey backoffice for climate, onboarding and benefits feedback, while answers belong to the separated collaborator experience.',
        actions: { create: 'Create survey', save: 'Save changes', add: 'Create survey', cancel: 'Cancel', edit: 'Edit', remove: 'Delete' },
        dialog: { title: 'Survey campaign', description: 'Store the campaign, audience, timing, anonymity settings and response metrics.' },
      }
    : {
        eyebrow: 'Encuestas RRHH',
        title: 'Encuestas',
        description: 'Backoffice de encuestas RRHH para clima, onboarding y beneficios, dejando la respuesta del colaborador en una experiencia separada.',
        actions: { create: 'Crear encuesta', save: 'Guardar cambios', add: 'Crear encuesta', cancel: 'Cancelar', edit: 'Editar', remove: 'Eliminar' },
        dialog: { title: 'Campaña de encuesta', description: 'Guarda la campaña, audiencia, fechas, anonimato y métricas de participación.' },
      }

  async function load() {
    const res = await fetch('/api/nomina/encuestas', { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as { data?: PayrollSurveyCampaignRow[] } | null
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

  function openEdit(item: PayrollSurveyCampaignRow) {
    setEditingId(item.id)
    setError(null)
    setForm({
      title: item.title,
      category: item.category,
      status: item.status,
      anonymous: item.anonymous,
      audience: item.audience,
      channel: item.channel,
      questionsCount: String(item.questionsCount),
      invitedCount: String(item.invitedCount),
      responsesCount: String(item.responsesCount),
      averageScore: item.averageScore != null ? String(item.averageScore) : '',
      opensAt: item.opensAt?.slice(0, 10) ?? '',
      closesAt: item.closesAt?.slice(0, 10) ?? '',
      summary: item.summary ?? '',
      notes: item.notes ?? '',
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      questionsCount: Number(form.questionsCount || 0),
      invitedCount: Number(form.invitedCount || 0),
      responsesCount: Number(form.responsesCount || 0),
      averageScore: form.averageScore ? Number(form.averageScore) : null,
    }
    const res = await fetch('/api/nomina/encuestas', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to save survey' : 'No fue posible guardar la encuesta'))
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
    if (!window.confirm(language === 'en' ? 'Delete this survey campaign?' : '¿Eliminar esta campaña?')) return
    const res = await fetch('/api/nomina/encuestas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (!res.ok || !json?.ok) {
      setError(json?.error ?? (language === 'en' ? 'Unable to delete survey' : 'No fue posible eliminar la encuesta'))
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
              <Link href={nominaHref('gestion-personas')}>{language === 'en' ? 'Open people station' : 'Abrir estación people'}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl bg-white/90">
              <Link href={nominaHref('portal-empleado')}>{language === 'en' ? 'View collaborator portal' : 'Ver portal del colaborador'}</Link>
            </Button>
          </>
        }
        stats={[
          { label: language === 'en' ? 'Active' : 'Activas', value: rows.filter((item) => item.status === 'ACTIVA').length, hint: language === 'en' ? 'Collecting feedback' : 'Recogiendo feedback', tone: 'sky' },
          { label: language === 'en' ? 'Scheduled' : 'Programadas', value: rows.filter((item) => item.status === 'PROGRAMADA').length, hint: language === 'en' ? 'Pending launch' : 'Pendientes de apertura', tone: 'amber' },
          { label: language === 'en' ? 'Closed' : 'Cerradas', value: rows.filter((item) => item.status === 'CERRADA').length, hint: language === 'en' ? 'With final results' : 'Con resultados finales', tone: 'teal' },
        ]}
      />

      <NominaSubnav />

      <div className="flex justify-end gap-2">
        <DataViewToggle mode={mode} onChange={setMode} />
        <Button className="rounded-xl" onClick={openCreate}>{copy.actions.create}</Button>
      </div>

      <Card className="rounded-[26px] border-slate-200">
        <CardHeader>
          <CardTitle>{language === 'en' ? 'Survey campaigns' : 'Campañas de encuestas'}</CardTitle>
          <CardDescription>{language === 'en' ? 'Administrative survey tray to configure audiences and timing before the collaborator answers in a separated surface.' : 'Bandeja administrativa para configurar audiencia y fechas antes de que el colaborador responda en una superficie separada.'}</CardDescription>
        </CardHeader>
        <CardContent className={mode === 'grid' ? 'grid gap-3 md:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
          {rows.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <div className="text-sm text-slate-500">{item.category}</div>
                </div>
                <span className={statusClass(item.status)}>{item.status}</span>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-600">
                <div>{language === 'en' ? 'Audience' : 'Audiencia'}: {item.audience}</div>
                <div>{language === 'en' ? 'Channel' : 'Canal'}: {item.channel}</div>
                <div>{language === 'en' ? 'Anonymous' : 'Anónima'}: {item.anonymous ? (language === 'en' ? 'Yes' : 'Sí') : 'No'}</div>
                <div>{language === 'en' ? 'Questions' : 'Preguntas'}: {item.questionsCount}</div>
                <div>{language === 'en' ? 'Invited' : 'Invitados'}: {item.invitedCount}</div>
                <div>{language === 'en' ? 'Responses' : 'Respuestas'}: {item.responsesCount}</div>
                <div>{language === 'en' ? 'Average' : 'Promedio'}: {item.averageScore ?? '—'}</div>
                <div>{language === 'en' ? 'Open' : 'Apertura'}: {formatDate(item.opensAt ?? null, locale)}</div>
                <div>{language === 'en' ? 'Close' : 'Cierre'}: {formatDate(item.closesAt ?? null, locale)}</div>
              </div>
              {item.summary ? <p className="mt-3 text-sm text-slate-600">{item.summary}</p> : null}
              {item.notes ? <div className="mt-3 text-sm text-slate-500">{item.notes}</div> : null}
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => openEdit(item)}>{copy.actions.edit}</Button>
                <Button variant="outline" className="rounded-xl" onClick={() => void handleDelete(item.id)}>{copy.actions.remove}</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-[28px]">
          <DialogHeader>
            <DialogTitle>{copy.dialog.title}</DialogTitle>
            <DialogDescription>{copy.dialog.description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2"><Label>{language === 'en' ? 'Title' : 'Título'}</Label><Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Category' : 'Categoría'}</Label><Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CLIMA">{language === 'en' ? 'Climate' : 'Clima'}</SelectItem><SelectItem value="ONBOARDING">Onboarding</SelectItem><SelectItem value="BENEFICIOS">{language === 'en' ? 'Benefits' : 'Beneficios'}</SelectItem><SelectItem value="LIDERAZGO">{language === 'en' ? 'Leadership' : 'Liderazgo'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Status' : 'Estado'}</Label><Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="BORRADOR">{language === 'en' ? 'Draft' : 'Borrador'}</SelectItem><SelectItem value="PROGRAMADA">{language === 'en' ? 'Scheduled' : 'Programada'}</SelectItem><SelectItem value="ACTIVA">{language === 'en' ? 'Active' : 'Activa'}</SelectItem><SelectItem value="CERRADA">{language === 'en' ? 'Closed' : 'Cerrada'}</SelectItem></SelectContent></Select></div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"><div><Label>{language === 'en' ? 'Anonymous responses' : 'Respuestas anónimas'}</Label><p className="text-xs text-slate-500">{language === 'en' ? 'Hide respondent identity.' : 'Oculta la identidad del encuestado.'}</p></div><Switch checked={form.anonymous} onCheckedChange={(checked) => setForm((current) => ({ ...current, anonymous: checked }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Audience' : 'Audiencia'}</Label><Input value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Channel' : 'Canal'}</Label><Select value={form.channel} onValueChange={(value) => setForm((current) => ({ ...current, channel: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PORTAL">Portal</SelectItem><SelectItem value="EMAIL">Email</SelectItem><SelectItem value="PRESENCIAL">{language === 'en' ? 'In person' : 'Presencial'}</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Questions' : 'Preguntas'}</Label><Input type="number" value={form.questionsCount} onChange={(event) => setForm((current) => ({ ...current, questionsCount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Invited' : 'Invitados'}</Label><Input type="number" value={form.invitedCount} onChange={(event) => setForm((current) => ({ ...current, invitedCount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Responses' : 'Respuestas'}</Label><Input type="number" value={form.responsesCount} onChange={(event) => setForm((current) => ({ ...current, responsesCount: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Average score' : 'Score promedio'}</Label><Input type="number" step="0.1" value={form.averageScore} onChange={(event) => setForm((current) => ({ ...current, averageScore: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Open at' : 'Apertura'}</Label><Input type="date" value={form.opensAt} onChange={(event) => setForm((current) => ({ ...current, opensAt: event.target.value }))} /></div>
            <div className="grid gap-2"><Label>{language === 'en' ? 'Close at' : 'Cierre'}</Label><Input type="date" value={form.closesAt} onChange={(event) => setForm((current) => ({ ...current, closesAt: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Summary' : 'Resumen'}</Label><Textarea rows={3} value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} /></div>
            <div className="grid gap-2 md:col-span-2"><Label>{language === 'en' ? 'Notes' : 'Notas'}</Label><Textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
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
