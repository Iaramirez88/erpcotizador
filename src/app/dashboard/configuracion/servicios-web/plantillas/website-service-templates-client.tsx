'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type WebsiteServiceMessageTemplate = {
  id: string
  nombre: string
  descripcion: string | null
  serviceKind: string
  triggerKind: string
  daysBefore: number
  emailSubjectTemplate: string
  emailBodyTemplate: string
  whatsappTemplate: string
  isEmailEnabled: boolean
  isWhatsAppEnabled: boolean
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

type TemplatesResponse = {
  ok: boolean
  error?: string
  templates?: WebsiteServiceMessageTemplate[]
}

type TemplateForm = {
  nombre: string
  descripcion: string
  serviceKind: string
  triggerKind: string
  daysBefore: string
  emailSubjectTemplate: string
  emailBodyTemplate: string
  whatsappTemplate: string
  isEmailEnabled: boolean
  isWhatsAppEnabled: boolean
  isActive: boolean
  isDefault: boolean
}

const REMINDER_VARIABLES = [
  '{{empresa_nombre}}',
  '{{servicio_nombre}}',
  '{{contacto_nombre}}',
  '{{contacto_email}}',
  '{{contacto_telefono}}',
  '{{website_url}}',
  '{{domain_name}}',
  '{{hosted_at}}',
  '{{dias_restantes}}',
  '{{componentes_por_vencer}}',
  '{{componentes_detalle}}',
  '{{fechas_vencimiento}}',
]

const EMPTY_FORM: TemplateForm = {
  nombre: '',
  descripcion: '',
  serviceKind: 'WEBSITE_SERVICE',
  triggerKind: 'EXPIRATION_REMINDER',
  daysBefore: '30',
  emailSubjectTemplate: 'Tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días',
  emailBodyTemplate: ['Hola {{contacto_nombre}},', '', 'Te recordamos que tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días.', '', 'Componentes por vencer:', '{{componentes_detalle}}', '', 'Fechas de vencimiento: {{fechas_vencimiento}}.', '', 'Si deseas renovarlo, responde este mensaje y con gusto te ayudamos.', '', 'Equipo {{empresa_nombre}}'].join('\n'),
  whatsappTemplate: ['Hola {{contacto_nombre}}, te recordamos que tu servicio web {{servicio_nombre}} vence en {{dias_restantes}} días.', 'Componentes por vencer: {{componentes_por_vencer}}.', '{{componentes_detalle}}', 'Fechas: {{fechas_vencimiento}}.', 'Si deseas renovarlo, respóndenos por este medio.', 'Equipo {{empresa_nombre}}'].join('\n'),
  isEmailEnabled: true,
  isWhatsAppEnabled: true,
  isActive: true,
  isDefault: true,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function WebsiteServiceTemplatesClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<WebsiteServiceMessageTemplate[]>([])
  const [editing, setEditing] = useState<WebsiteServiceMessageTemplate | null>(null)
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/servicios-web/templates', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as TemplatesResponse | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudieron cargar las plantillas automáticas.')
        return
      }
      setTemplates(json.templates ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const activeTemplates = useMemo(() => templates.filter((template) => template.isActive), [templates])

  function openCreateDialog() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, isDefault: templates.length === 0 })
    setDialogOpen(true)
  }

  function openEditDialog(template: WebsiteServiceMessageTemplate) {
    setEditing(template)
    setForm({
      nombre: template.nombre,
      descripcion: template.descripcion ?? '',
      serviceKind: template.serviceKind,
      triggerKind: template.triggerKind,
      daysBefore: String(template.daysBefore),
      emailSubjectTemplate: template.emailSubjectTemplate,
      emailBodyTemplate: template.emailBodyTemplate,
      whatsappTemplate: template.whatsappTemplate,
      isEmailEnabled: template.isEmailEnabled,
      isWhatsAppEnabled: template.isWhatsAppEnabled,
      isActive: template.isActive,
      isDefault: template.isDefault,
    })
    setDialogOpen(true)
  }

  async function saveTemplate() {
    if (!form.nombre.trim()) {
      alert('El nombre de la plantilla es obligatorio.')
      return
    }

    setSaving(true)
    try {
      const url = editing ? `/api/servicios-web/templates/${editing.id}` : '/api/servicios-web/templates'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo guardar la plantilla.')
        return
      }
      setDialogOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function deleteTemplate(template: WebsiteServiceMessageTemplate) {
    if (!window.confirm(`Se eliminará la plantilla ${template.nombre}.`)) return
    setDeletingId(template.id)
    try {
      const res = await fetch(`/api/servicios-web/templates/${template.id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!res.ok || !json?.ok) {
        alert(json?.error || 'No se pudo eliminar la plantilla.')
        return
      }
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,_#fffdf8_0%,_#f4fbff_55%,_#eef8f1_100%)] p-5 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.35)] md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Centro de mensajes</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Plantillas automáticas</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Crea múltiples plantillas para recordatorios y otros servicios. La plantilla marcada como predeterminada será la que use la automatización.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar
          </Button>
          <Button className="rounded-xl" onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva plantilla
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Total</div><div className="mt-2 text-2xl font-semibold text-slate-950">{templates.length}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Activas</div><div className="mt-2 text-2xl font-semibold text-emerald-700">{activeTemplates.length}</div></CardContent></Card>
        <Card className="rounded-[24px]"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-500">Predeterminada</div><div className="mt-2 text-sm font-semibold text-slate-950">{templates.find((template) => template.isDefault)?.nombre || 'Sin asignar'}</div></CardContent></Card>
      </div>

      <Card className="rounded-[26px] border-slate-200 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle>Variables disponibles</CardTitle>
          <CardDescription>Estas variables se reemplazan automáticamente al enviar el mensaje.</CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {REMINDER_VARIABLES.map((variable) => (
              <span key={variable} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">{variable}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? <p className="text-sm text-slate-500">Cargando plantillas...</p> : null}
        {!loading && templates.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">No hay plantillas creadas todavía.</p> : null}
        {templates.map((template) => (
          <Card key={template.id} className="rounded-[24px] border-slate-200">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {template.nombre}
                    {template.isDefault ? <span className="rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-800">Predeterminada</span> : null}
                    {!template.isActive ? <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Inactiva</span> : null}
                  </CardTitle>
                  <CardDescription>{template.descripcion || 'Sin descripción.'}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={() => openEditDialog(template)}>Editar</Button>
                  <Button variant="outline" className="rounded-xl text-rose-700 hover:text-rose-800" onClick={() => void deleteTemplate(template)} disabled={deletingId === template.id}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deletingId === template.id ? 'Eliminando...' : 'Eliminar'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <p><span className="font-medium text-slate-900">Disparador:</span> {template.triggerKind} · {template.daysBefore} días antes</p>
              <p><span className="font-medium text-slate-900">Canales:</span> {template.isEmailEnabled ? 'Email' : ''}{template.isEmailEnabled && template.isWhatsAppEnabled ? ' + ' : ''}{template.isWhatsAppEnabled ? 'WhatsApp' : ''}</p>
              <p><span className="font-medium text-slate-900">Última edición:</span> {formatDate(template.updatedAt)}</p>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asunto de correo</p>
                <p className="mt-1 text-sm text-slate-800">{template.emailSubjectTemplate}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
            <DialogDescription>Define el tipo de mensaje, el disparador y los textos para email y WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[72vh] gap-4 overflow-y-auto py-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Nombre</Label>
              <Input value={form.nombre} onChange={(e) => setForm((current) => ({ ...current, nombre: e.target.value }))} placeholder="Recordatorio 30 días" />
            </div>
            <div className="grid gap-2">
              <Label>Días antes</Label>
              <Input type="number" min="1" value={form.daysBefore} onChange={(e) => setForm((current) => ({ ...current, daysBefore: e.target.value }))} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm((current) => ({ ...current, descripcion: e.target.value }))} rows={2} placeholder="Para qué se usa esta plantilla" />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de servicio</Label>
              <Input value={form.serviceKind} onChange={(e) => setForm((current) => ({ ...current, serviceKind: e.target.value }))} placeholder="WEBSITE_SERVICE" />
            </div>
            <div className="grid gap-2">
              <Label>Evento disparador</Label>
              <Input value={form.triggerKind} onChange={(e) => setForm((current) => ({ ...current, triggerKind: e.target.value }))} placeholder="EXPIRATION_REMINDER" />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Asunto del correo</Label>
              <Input value={form.emailSubjectTemplate} onChange={(e) => setForm((current) => ({ ...current, emailSubjectTemplate: e.target.value }))} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Plantilla del correo</Label>
              <Textarea value={form.emailBodyTemplate} onChange={(e) => setForm((current) => ({ ...current, emailBodyTemplate: e.target.value }))} rows={9} />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label>Plantilla de WhatsApp</Label>
              <Textarea value={form.whatsappTemplate} onChange={(e) => setForm((current) => ({ ...current, whatsappTemplate: e.target.value }))} rows={8} />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input type="checkbox" checked={form.isEmailEnabled} onChange={(e) => setForm((current) => ({ ...current, isEmailEnabled: e.target.checked }))} />
              <span>Habilitar email</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input type="checkbox" checked={form.isWhatsAppEnabled} onChange={(e) => setForm((current) => ({ ...current, isWhatsAppEnabled: e.target.checked }))} />
              <span>Habilitar WhatsApp</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))} />
              <span>Plantilla activa</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((current) => ({ ...current, isDefault: e.target.checked }))} />
              <span>Usar como predeterminada</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => void saveTemplate()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}