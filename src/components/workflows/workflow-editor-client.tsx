"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowDown, Copy, Play, Plus, Save, Settings2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { WorkflowNodeKind, WorkflowTriggerKind } from '@prisma/client'
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowTriggerConfig } from '@/lib/workflows'
import { WorkflowCanvas } from '@/components/workflows/workflow-canvas'
import { WorkflowNodeModal } from '@/components/workflows/workflow-node-modal'
import { defaultConfigForKind, NODE_KIND_LABELS, summarizeNodeConfig } from '@/components/workflows/workflow-node-catalog'

type InitialWorkflow = {
  id: string
  name: string
  description: string | null
  status: string
  webhookToken: string
  trigger: WorkflowTriggerConfig
  definition: WorkflowDefinition
}

type JsonResponse<T> = { success?: boolean; data?: T; error?: string }

const ADDABLE_NODE_KINDS: WorkflowNodeKind[] = ['HTTP_REQUEST', 'CONDITION', 'DELAY', 'NOTE', 'ACTION']

function makeNodeId() {
  return `n-${Math.random().toString(36).slice(2, 9)}`
}

export function WorkflowEditorClient({ initialWorkflow }: { initialWorkflow: InitialWorkflow }) {
  const [name, setName] = useState(initialWorkflow.name)
  const [description, setDescription] = useState(initialWorkflow.description ?? '')
  const [status, setStatus] = useState(initialWorkflow.status)
  const [trigger, setTrigger] = useState<WorkflowTriggerConfig>(initialWorkflow.trigger)
  const [nodes, setNodes] = useState<WorkflowNode[]>(initialWorkflow.definition.nodes)
  const [edges, setEdges] = useState<WorkflowEdge[]>(initialWorkflow.definition.edges)
  const [variablesText, setVariablesText] = useState(JSON.stringify(initialWorkflow.definition.variables, null, 2))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'list' | 'canvas'>('list')
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  function parseVariables(): Record<string, unknown> {
    try {
      const value = JSON.parse(variablesText)
      return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    } catch {
      return {}
    }
  }

  async function handleSave() {
    setBusy(true)
    setFeedback(null)
    try {
      const variables = parseVariables()
      const response = await fetch(`/api/workflows/${initialWorkflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, status, triggerJson: trigger, definitionJson: { nodes, edges, variables } }),
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<unknown>
      setFeedback(json.success ? 'Workflow guardado.' : (json.error || 'No se pudo guardar.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRun() {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/workflows/${initialWorkflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const json = (await response.json().catch(() => ({}))) as JsonResponse<unknown>
      setFeedback(json.success === false ? (json.error || 'Fallo la ejecución') : 'Workflow ejecutado.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopyWebhook() {
    const url = `${window.location.origin}/api/workflows/webhook/${initialWorkflow.webhookToken}`
    await navigator.clipboard.writeText(url)
    setFeedback('URL de webhook copiada.')
  }

  function addNode(kind: WorkflowNodeKind) {
    const node: WorkflowNode = {
      id: makeNodeId(),
      kind,
      label: NODE_KIND_LABELS[kind] ?? kind,
      config: defaultConfigForKind(kind),
    }
    setNodes((current) => [...current, node])
  }

  function updateNode(id: string, patch: Partial<WorkflowNode>) {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, ...patch } : node)))
  }

  function updateNodeConfig(id: string, key: string, value: unknown) {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, config: { ...node.config, [key]: value } } : node)))
  }

  function removeNode(id: string) {
    setNodes((current) => current.filter((node) => node.id !== id))
  }

  function handleMoveNode(id: string, position: { x: number; y: number }) {
    updateNodeConfig(id, 'position', position)
  }

  function handleConnectEdge(fromId: string, toId: string) {
    setEdges((current) => {
      if (current.some((edge) => edge.from === fromId && edge.to === toId)) return current
      return [...current, { id: `e-${Date.now()}`, from: fromId, to: toId, label: null }]
    })
  }

  function handleEdgeLabel(edgeId: string, label: 'true' | 'false' | null) {
    setEdges((current) => current.map((edge) => (edge.id === edgeId ? { ...edge, label } : edge)))
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/dashboard/crm/workflows" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
              <ArrowLeft className="h-4 w-4" />Volver a Workflows
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">{name || 'Workflow'}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => void handleRun()} disabled={busy}>
              <Play className="mr-2 h-4 w-4" />Ejecutar
            </Button>
            <Button className="h-10 rounded-xl" onClick={() => void handleSave()} disabled={busy}>
              <Save className="mr-2 h-4 w-4" />Guardar
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="grid gap-1.5">
            <Label>Estado</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Borrador</SelectItem>
                <SelectItem value="ACTIVE">Activo</SelectItem>
                <SelectItem value="PAUSED">Pausado</SelectItem>
                <SelectItem value="ARCHIVED">Archivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="rounded-2xl" />
          </div>
        </div>
        {feedback ? <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{feedback}</p> : null}
      </div>

      <div className="rounded-[28px] border border-sky-200 bg-sky-50/40 p-5">
        <p className="text-sm font-semibold text-slate-900">Disparador</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={trigger.kind} onValueChange={(value) => setTrigger((current) => ({ ...current, kind: value as WorkflowTriggerKind }))}>
              <SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="WEBHOOK">Webhook (URL pública)</SelectItem>
                <SelectItem value="CRON">Programado (cron)</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
                <SelectItem value="EVENT">Evento interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {trigger.kind === 'CRON' ? (
            <div className="grid gap-1.5">
              <Label>Expresión cron</Label>
              <Input value={trigger.cronExpression ?? ''} onChange={(e) => setTrigger((current) => ({ ...current, cronExpression: e.target.value }))} className="h-11 rounded-xl bg-white" placeholder="*/15 * * * *" />
            </div>
          ) : trigger.kind === 'WEBHOOK' ? (
            <div className="grid gap-1.5">
              <Label>URL de webhook</Label>
              <div className="flex items-center gap-2">
                <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/workflows/webhook/${initialWorkflow.webhookToken}`} className="h-11 flex-1 rounded-xl bg-white font-mono text-xs" />
                <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => void handleCopyWebhook()}>
                  <Copy className="mr-2 h-4 w-4" />Copiar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Nodos</p>
            <p className="mt-1 text-xs text-slate-500">Arrastra los nodos en el lienzo para organizarlos. Agrega nodos para construir la automatización.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant={view === 'list' ? 'default' : 'outline'} className="h-9 rounded-xl" onClick={() => setView('list')}>Lista</Button>
            <Button type="button" variant={view === 'canvas' ? 'default' : 'outline'} className="h-9 rounded-xl" onClick={() => setView('canvas')}>Lienzo</Button>
          </div>
        </div>
        {view === 'list' ? (
        <div className="mt-4 space-y-2">
          {nodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Todavía no hay nodos.</div>
          ) : (
            nodes.map((node, index) => (
              <div key={node.id}>
                {index > 0 ? (
                  <div className="flex justify-center py-1 text-slate-300"><ArrowDown className="h-4 w-4" /></div>
                ) : null}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">{NODE_KIND_LABELS[node.kind] ?? node.kind}</span>
                        <Input value={node.label} onChange={(e) => updateNode(node.id, { label: e.target.value })} className="h-9 w-48 rounded-lg" />
                      </div>
                      <p className="mt-2 truncate text-xs text-slate-500">{summarizeNodeConfig(node) || 'Sin configuración'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" className="h-9 rounded-xl" onClick={() => setEditingNodeId(node.id)}>
                        <Settings2 className="mr-2 h-4 w-4" />Configurar
                      </Button>
                      <Button type="button" variant="outline" className="h-9 rounded-xl text-rose-700 hover:text-rose-700" onClick={() => removeNode(node.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />Quitar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        ) : (
          <WorkflowCanvas nodes={nodes} edges={edges} onMoveNode={handleMoveNode} onConnectEdge={handleConnectEdge} onNodeClick={(id) => setEditingNodeId(id)} onEdgeLabel={handleEdgeLabel} />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {ADDABLE_NODE_KINDS.map((kind) => (
            <Button key={kind} type="button" variant="outline" className="h-9 rounded-xl" onClick={() => addNode(kind)}>
              <Plus className="mr-2 h-4 w-4" />{NODE_KIND_LABELS[kind] ?? kind}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-900">Variables</p>
        <p className="mt-1 text-xs text-slate-500">Objeto JSON con variables reutilizables en las URLs usando {'{{variable}}'}.</p>
        <Textarea value={variablesText} onChange={(e) => setVariablesText(e.target.value)} rows={6} className="mt-3 rounded-2xl font-mono text-xs" />
      </div>

      <WorkflowNodeModal
        node={nodes.find((node) => node.id === editingNodeId) ?? null}
        open={Boolean(editingNodeId)}
        onOpenChange={(open) => {
          if (!open) setEditingNodeId(null)
        }}
        onChangeLabel={(id, label) => updateNode(id, { label })}
        onChangeConfig={updateNodeConfig}
        onDelete={removeNode}
      />
    </div>
  )
}

