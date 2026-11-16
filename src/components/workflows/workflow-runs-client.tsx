"use client"

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type WorkflowRunItem = {
  id: string
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  triggerKind: string
  startedAt: string
  finishedAt: string | null
  errorMessage: string | null
  _count: { steps: number }
}

type WorkflowRunStepItem = {
  id: string
  nodeId: string
  nodeKind: string
  status: string
  durationMs: number
  errorMessage: string | null
  inputJson: unknown
  outputJson: unknown
  startedAt: string
}

type WorkflowRunDetail = WorkflowRunItem & {
  triggerPayloadJson: unknown
  outputJson: unknown
  steps: WorkflowRunStepItem[]
  workflow: { name: string }
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

const STATUS_BADGE: Record<string, string> = {
  RUNNING: 'bg-amber-100 text-amber-800',
  SUCCEEDED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value ?? '')
  }
}

export function WorkflowRunsClient({ workflowId }: { workflowId: string }) {
  const [runs, setRuns] = useState<WorkflowRunItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<WorkflowRunDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/${workflowId}/runs`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<WorkflowRunItem[]>
      if (!json.success || !json.data) {
        setFeedback(json.error || 'No se pudieron cargar las ejecuciones.')
        return
      }
      setRuns(json.data)
      setFeedback(null)
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleDetail(runId: string) {
    if (detail?.id === runId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/workflows/runs/${runId}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<WorkflowRunDetail>
      setDetail(json.data ?? null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Historial</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Ejecuciones</h2>
        </div>
        <Button variant="outline" className="h-9 rounded-xl" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />Recargar
        </Button>
      </div>

      {feedback ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{feedback}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Cargando ejecuciones…</p>
      ) : runs.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Todavía no hay ejecuciones. Ejecuta el workflow o llama a su webhook.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {runs.map((run) => {
            const expanded = detail?.id === run.id
            return (
              <div key={run.id} className="overflow-hidden rounded-2xl border border-slate-200">
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                  onClick={() => void toggleDetail(run.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${STATUS_BADGE[run.status] ?? 'bg-slate-100 text-slate-700'}`}>{run.status}</span>
                    <span className="text-sm font-medium text-slate-700">{run.triggerKind}</span>
                    <span className="text-xs text-slate-500">{formatDate(run.startedAt)}</span>
                    <span className="text-xs text-slate-500">· {run._count.steps} pasos</span>
                  </div>
                  {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </button>

                {expanded ? (
                  <div className="border-t border-slate-100 px-4 py-3">
                    {detailLoading ? (
                      <p className="text-sm text-slate-500">Cargando detalle…</p>
                    ) : detail ? (
                      <div className="space-y-3">
                        {detail.errorMessage ? (
                          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{detail.errorMessage}</p>
                        ) : null}
                        <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-600">Payload recibido</summary>
                          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-700">{formatJson(detail.triggerPayloadJson)}</pre>
                        </details>
                        <div className="space-y-2">
                          {detail.steps.map((step, index) => (
                            <div key={step.id} className="rounded-xl border border-slate-200 px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-slate-800">{index + 1}. {step.nodeKind}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${step.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{step.status}</span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{step.durationMs} ms</p>
                              {step.errorMessage ? <p className="mt-1 text-xs text-rose-600">{step.errorMessage}</p> : null}
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-slate-500">Entrada / Salida</summary>
                                <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-700">{formatJson({ input: step.inputJson, output: step.outputJson })}</pre>
                              </details>
                            </div>
                          ))}
                        </div>
                        <details className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-600">Resultado final</summary>
                          <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-700">{formatJson(detail.outputJson)}</pre>
                        </details>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
