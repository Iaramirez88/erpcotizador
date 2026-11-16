"use client"

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WORKFLOW_TEMPLATES } from '@/lib/workflow-templates'

type WorkflowItem = {
  id: string
  name: string
  description: string | null
  status: string
  webhookToken: string
  trigger: { kind: string }
  _count: { runs: number }
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

const TRIGGER_LABELS: Record<string, string> = {
  WEBHOOK: 'Webhook',
  CRON: 'Programado',
  MANUAL: 'Manual',
  EVENT: 'Evento',
}

export function WorkflowsClient() {
  const [items, setItems] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [name, setName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/workflows', { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<WorkflowItem[]>
      if (!json.success || !json.data) {
        setFeedback(json.error || 'No se pudieron cargar los workflows.')
        return
      }
      setItems(json.data)
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<WorkflowItem>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo crear el workflow.')
        return
      }
      setName('')
      setFeedback(`Workflow "${trimmed}" creado como borrador.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateFromTemplate(template: (typeof WORKFLOW_TEMPLATES)[number]) {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          triggerJson: template.trigger,
          definitionJson: template.definition,
        }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<WorkflowItem>
      if (!json.success) {
        setFeedback(json.error || 'No se pudo crear el workflow.')
        return
      }
      setFeedback(`Workflow "${template.name}" creado desde plantilla.`)
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleRun(id: string) {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/workflows/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<{ runId?: string }>
      setFeedback(json.success === false ? (json.error || 'Fallo la ejecución') : 'Workflow ejecutado.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    setBusy(true)
    setFeedback(null)
    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
      setFeedback('Workflow eliminado.')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyWebhook(item: WorkflowItem) {
    const url = `${window.location.origin}/api/workflows/webhook/${item.webhookToken}`
    await navigator.clipboard.writeText(url)
    setFeedback('URL de webhook copiada.')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.35)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Workflows</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Automatizaciones por API y webhook</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Diseña flujos con disparador webhook y nodos de acción (HTTP request, condiciones, etc.). Módulo en fase de esqueleto.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del workflow" className="h-11 max-w-sm rounded-xl" />
          <Button className="h-11 rounded-xl" onClick={() => void handleCreate()} disabled={busy}>Crear workflow</Button>
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />Recargar
          </Button>
        </div>
        {feedback ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{feedback}</p> : null}
      </div>

      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/40 p-5">
        <p className="text-sm font-semibold text-slate-900">Plantillas de ejemplo</p>
        <p className="mt-1 text-xs text-slate-500">Usa una plantilla para entender qué puede hacer un workflow.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {WORKFLOW_TEMPLATES.map((template) => (
            <div key={template.id} className="rounded-2xl border border-emerald-200 bg-white p-4">
              <p className="font-semibold text-slate-950">{template.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{template.description}</p>
              <Button className="mt-3 h-9 rounded-xl" onClick={() => void handleCreateFromTemplate(template)} disabled={busy}>Usar plantilla</Button>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando workflows…</p>
      ) : items.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Todavía no hay workflows. Crea uno para empezar.
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.3)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {TRIGGER_LABELS[item.trigger.kind] ?? item.trigger.kind} · {item.status} · {item._count.runs} ejecuciones
                  </p>
                  {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" className="h-9 rounded-xl">
                    <Link href={`/dashboard/crm/workflows/${item.id}`}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
                  </Button>
                  <Button variant="outline" className="h-9 rounded-xl" onClick={() => void handleCopyWebhook(item)}>
                    <Copy className="mr-2 h-4 w-4" />Copiar webhook
                  </Button>
                  <Button className="h-9 rounded-xl" onClick={() => void handleRun(item.id)} disabled={busy}>
                    <Play className="mr-2 h-4 w-4" />Ejecutar
                  </Button>
                  <Button variant="outline" className="h-9 rounded-xl text-rose-700 hover:text-rose-700" onClick={() => void handleDelete(item.id)} disabled={busy}>
                    <Trash2 className="mr-2 h-4 w-4" />Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
