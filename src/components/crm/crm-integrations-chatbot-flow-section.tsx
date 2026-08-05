"use client"

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { ChatbotCanvasConnection, ChatbotCanvasNode } from '@/components/crm/crm-integrations-chatbot-flow-types'
import type { ChatbotFlowNextField, ChatbotFlowResponseMatchMode, ChatbotFlowResponseOption, ChatbotFlowStage, ChatbotQuickAction } from '@/lib/crm-chatbot-flow'

type Props = {
  flowStages: ChatbotFlowStage[]
  quickActions: ChatbotQuickAction[]
  chatbotCanvasModel: {
    width: number
    height: number
    nodes: ChatbotCanvasNode[]
    connections: ChatbotCanvasConnection[]
  }
  selectedChatbotConnectionId: string | null
  selectedChatbotStageId: string | null
  selectedChatbotFlowStage: ChatbotFlowStage | null
  selectedChatbotConnection: ChatbotCanvasConnection | null
  selectedChatbotConnectionSourceStage: ChatbotFlowStage | null
  selectedChatbotConnectionOption: ChatbotFlowResponseOption | null
  protectedStageIds: Set<string>
  getFlowStageAccent: (stageId: string) => string
  getFlowStageNextFieldLabel: (field: ChatbotFlowNextField) => string
  getResponseMatchModeLabel: (mode: ChatbotFlowResponseMatchMode) => string
  onAddResponseToActiveStage: () => void
  onSelectConnection: (connectionId: string, fromStageId: string) => void
  onSelectStage: (stageId: string) => void
  onGoToConnectionTarget: (stageId: string) => void
  onAddConnectedStage: (fromStageId: string, optionId: string) => void
  onRemoveConnection: (fromStageId: string, optionId: string) => void
  onUpdateConnectionTarget: (fromStageId: string, optionId: string, targetStageId: string) => void
  onUpdateConnectionMatchMode: (fromStageId: string, optionId: string, matchMode: ChatbotFlowResponseMatchMode) => void
  onUpdateConnectionMatchValue: (fromStageId: string, optionId: string, matchValue: string) => void
  onAddStage: () => void
  onMoveStage: (stageId: string, delta: -1 | 1) => void
  onDeleteStage: (stageId: string) => void
  onUpdateStage: (stageId: string, patch: Partial<ChatbotFlowStage>) => void
  onAddResponseOption: (stageId: string) => void
  onRemoveResponseOption: (stageId: string, optionId: string) => void
  onUpdateResponseOption: (stageId: string, optionId: string, patch: Partial<ChatbotFlowResponseOption>) => void
  onToggleStageQuickAction: (stageId: string, actionId: string, checked: boolean) => void
  onUpdateQuickAction: (actionId: string, patch: Partial<ChatbotQuickAction>) => void
}

function getQuickActionKindLabel(action: ChatbotQuickAction) {
  return action.kind === 'human'
    ? 'Escalamiento humano'
    : action.kind === 'stock'
      ? 'Consulta de stock'
      : action.kind === 'catalog'
        ? 'Explorar catálogo'
        : action.kind === 'create_quote'
          ? 'Crear cotización'
          : action.kind === 'create_invoice'
            ? 'Crear factura'
            : action.kind === 'create_work_order'
              ? 'Crear orden'
              : 'Mensaje libre'
}

export function CrmIntegrationsChatbotFlowSection(props: Props) {
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Canvas del flujo</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Ahora el mapa también sirve para editar ramas: selecciona una conexión para cambiar el destino, crear una etapa nueva conectada o quitar el vínculo.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">Rama por respuesta</span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">Nodo activo</span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-800">Conexión editable</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-600">
          <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">Haz clic en un nodo para editar su contenido</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">Haz clic en una rama para editar a dónde termina la respuesta</span>
          <Button type="button" variant="outline" className="h-7 rounded-xl px-2.5 text-[11px]" onClick={props.onAddResponseToActiveStage} disabled={!props.selectedChatbotFlowStage}>Agregar respuesta a la etapa activa</Button>
        </div>

        <div className="mt-4 overflow-auto rounded-[22px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.08),transparent_28%),linear-gradient(180deg,#f8fffc,#ffffff)] p-3">
          <div className="relative" style={{ width: props.chatbotCanvasModel.width, height: props.chatbotCanvasModel.height }}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${props.chatbotCanvasModel.width} ${props.chatbotCanvasModel.height}`} fill="none">
              {props.chatbotCanvasModel.connections.map((connection) => {
                const isSelected = connection.id === props.selectedChatbotConnectionId
                return (
                  <g key={connection.id}>
                    <path d={connection.path} stroke={isSelected ? '#0ea5e9' : '#94a3b8'} strokeWidth={isSelected ? 3 : 1.6} strokeDasharray={isSelected ? '0' : '6 6'} strokeLinecap="round" />
                  </g>
                )
              })}
            </svg>

            {props.chatbotCanvasModel.connections.map((connection) => {
              const isSelected = connection.id === props.selectedChatbotConnectionId
              const targetTitle = props.flowStages.find((stage) => stage.id === connection.toStageId)?.title || connection.toStageId
              return (
                <button
                  key={`${connection.id}-label`}
                  type="button"
                  onClick={() => props.onSelectConnection(connection.id, connection.fromStageId)}
                  className={isSelected ? 'absolute z-10 rounded-full border border-sky-300 bg-sky-100 px-2.5 py-1 text-[10px] font-semibold text-sky-800 shadow-sm' : 'absolute z-10 rounded-full border border-violet-200 bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50'}
                  style={{ left: connection.labelX, top: connection.labelY, transform: 'translate(-50%, -50%)' }}
                  title={`Editar rama hacia ${targetTitle}`}
                >
                  {connection.label}
                </button>
              )
            })}

            {props.chatbotCanvasModel.nodes.map((node, index) => {
              const isSelected = node.stage.id === props.selectedChatbotStageId
              return (
                <button
                  key={node.stage.id}
                  type="button"
                  onClick={() => props.onSelectStage(node.stage.id)}
                  className={isSelected ? 'absolute rounded-[24px] border border-emerald-300 bg-emerald-50/95 p-4 text-left shadow-[0_18px_46px_-28px_rgba(16,185,129,.45)]' : 'absolute rounded-[24px] border border-slate-200 bg-white/95 p-4 text-left shadow-[0_16px_40px_-30px_rgba(15,23,42,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-28px_rgba(15,23,42,.28)]'}
                  style={{ left: node.x, top: node.y, width: node.width, minHeight: node.height }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Nodo {index + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{node.stage.title}</p>
                    </div>
                    <span className={`rounded-full bg-gradient-to-r ${props.getFlowStageAccent(node.stage.id)} px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>
                      {props.getFlowStageNextFieldLabel(node.stage.nextField)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{node.stage.prompt}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{node.stage.responseOptions.length} ramas</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{node.stage.quickActionIds.length} quick actions</span>
                  </div>
                  {node.stage.responseOptions.length ? (
                    <div className="mt-3 space-y-1.5">
                      {node.stage.responseOptions.slice(0, 3).map((option) => {
                        const targetTitle = props.flowStages.find((stage) => stage.id === option.targetStageId)?.title || option.targetStageId
                        return (
                          <div key={option.id} className="flex items-center justify-between gap-2 rounded-2xl border border-violet-100 bg-violet-50/70 px-2.5 py-1.5 text-[10px] text-violet-900">
                            <span className="font-semibold">{option.label}</span>
                            <span className="truncate text-right text-violet-700">{targetTitle}</span>
                          </div>
                        )
                      })}
                      {node.stage.responseOptions.length > 3 ? <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">+{node.stage.responseOptions.length - 3} ramas más</span> : null}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        {props.selectedChatbotConnection && props.selectedChatbotConnectionSourceStage && props.selectedChatbotConnectionOption ? (
          <div className="mt-4 rounded-[22px] border border-sky-200 bg-sky-50/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Rama seleccionada</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{props.selectedChatbotConnectionOption.label}</p>
                <p className="mt-1 text-xs text-slate-600">Sale desde {props.selectedChatbotConnectionSourceStage.title} y actualmente termina en {props.flowStages.find((stage) => stage.id === props.selectedChatbotConnection?.toStageId)?.title || props.selectedChatbotConnection?.toStageId}.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => props.onGoToConnectionTarget(props.selectedChatbotConnection!.toStageId)}>
                  Ir al nodo destino
                </Button>
                <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => props.onAddConnectedStage(props.selectedChatbotConnection!.fromStageId, props.selectedChatbotConnection!.optionId)}>
                  Crear etapa y conectar
                </Button>
                <Button type="button" variant="outline" className="h-8 rounded-xl border-rose-200 px-3 text-xs text-rose-700" onClick={() => props.onRemoveConnection(props.selectedChatbotConnection!.fromStageId, props.selectedChatbotConnection!.optionId)}>
                  Quitar vínculo
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>La respuesta termina en</Label>
                <Select value={props.selectedChatbotConnection.toStageId} onValueChange={(value) => props.onUpdateConnectionTarget(props.selectedChatbotConnection!.fromStageId, props.selectedChatbotConnection!.optionId, value)}>
                  <SelectTrigger className="h-11 rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {props.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Match de esta lógica</Label>
                <Select value={props.selectedChatbotConnectionOption.matchMode} onValueChange={(value) => props.onUpdateConnectionMatchMode(props.selectedChatbotConnection!.fromStageId, props.selectedChatbotConnection!.optionId, value as ChatbotFlowResponseMatchMode)}>
                  <SelectTrigger className="h-11 rounded-xl bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contiene palabras</SelectItem>
                    <SelectItem value="exact">Coincidencia exacta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Frases que activan esta rama</Label>
                <Textarea value={props.selectedChatbotConnectionOption.matchValue} onChange={(event) => props.onUpdateConnectionMatchValue(props.selectedChatbotConnection!.fromStageId, props.selectedChatbotConnection!.optionId, event.target.value)} rows={2} className="rounded-2xl bg-white" />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Lista estructurada de etapas</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Además del canvas, aquí puedes reordenar nodos, revisar ramas y crear etapas nuevas.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={props.onAddStage}>Agregar etapa</Button>
            <div className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">SendPulse-style</div>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {props.flowStages.map((stage, index) => {
            const stageActions = props.quickActions.filter((action) => stage.quickActionIds.includes(action.id) && action.enabled)
            return (
              <div
                key={stage.id}
                onClick={() => props.onSelectStage(stage.id)}
                className={props.selectedChatbotStageId === stage.id ? 'cursor-pointer rounded-[24px] border border-emerald-300 bg-emerald-50/80 p-4 text-left shadow-sm' : 'cursor-pointer rounded-[24px] border border-slate-200 bg-white p-4 text-left'}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    props.onSelectStage(stage.id)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Etapa {index + 1}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{stage.title}</p>
                  </div>
                  <div className={`rounded-full bg-gradient-to-r ${props.getFlowStageAccent(stage.id)} px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>{props.getFlowStageNextFieldLabel(stage.nextField)}</div>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{stage.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {stageActions.map((action) => <span key={action.id} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">{action.label}</span>)}
                  {stage.responseOptions.map((option) => <span key={option.id} className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">{option.label}</span>)}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={(event) => { event.stopPropagation(); props.onMoveStage(stage.id, -1) }} disabled={index === 0}>Subir</Button>
                  <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={(event) => { event.stopPropagation(); props.onMoveStage(stage.id, 1) }} disabled={index === props.flowStages.length - 1}>Bajar</Button>
                  {!props.protectedStageIds.has(stage.id) ? <Button type="button" variant="outline" className="h-8 rounded-xl border-rose-200 px-3 text-xs text-rose-700" onClick={(event) => { event.stopPropagation(); props.onDeleteStage(stage.id) }}>Eliminar</Button> : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {props.selectedChatbotFlowStage ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Editor de etapa</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Ajusta la pregunta, el objetivo, las ramas posibles y las acciones visibles en esta etapa.</p>
            </div>
            <div className={`rounded-full bg-gradient-to-r ${props.getFlowStageAccent(props.selectedChatbotFlowStage.id)} px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white`}>{props.selectedChatbotFlowStage.title}</div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="grid gap-2"><Label>Título</Label><Input value={props.selectedChatbotFlowStage.title} onChange={(e) => props.onUpdateStage(props.selectedChatbotFlowStage!.id, { title: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="grid gap-2"><Label>Siguiente paso esperado</Label><Select value={props.selectedChatbotFlowStage.nextField} onValueChange={(value) => props.onUpdateStage(props.selectedChatbotFlowStage!.id, { nextField: value as ChatbotFlowNextField })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">Nombre</SelectItem><SelectItem value="email">Correo</SelectItem><SelectItem value="phone">Teléfono</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="product">Producto</SelectItem><SelectItem value="quantity">Cantidad</SelectItem><SelectItem value="company">Empresa</SelectItem><SelectItem value="document">Documento / NIT</SelectItem><SelectItem value="city">Ciudad</SelectItem><SelectItem value="address">Dirección</SelectItem><SelectItem value="confirmation">Resumen y confirmación</SelectItem><SelectItem value="none">Cierre</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2 md:col-span-2"><Label>Descripción operativa</Label><Textarea value={props.selectedChatbotFlowStage.description} onChange={(e) => props.onUpdateStage(props.selectedChatbotFlowStage!.id, { description: e.target.value })} rows={2} className="rounded-2xl" /></div>
            <div className="grid gap-2 md:col-span-2"><Label>Prompt de etapa</Label><Textarea value={props.selectedChatbotFlowStage.prompt} onChange={(e) => props.onUpdateStage(props.selectedChatbotFlowStage!.id, { prompt: e.target.value })} rows={4} className="rounded-2xl" /></div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Respuestas que abren ramas</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Cada respuesta puede mostrarse como botón y también activar una rama si el usuario escribe palabras similares.</p>
              </div>
              <Button type="button" variant="outline" className="h-8 rounded-xl px-3 text-xs" onClick={() => props.onAddResponseOption(props.selectedChatbotFlowStage!.id)}>Agregar respuesta</Button>
            </div>

            {props.selectedChatbotFlowStage.responseOptions.length ? props.selectedChatbotFlowStage.responseOptions.map((option) => (
              <div key={option.id} className="rounded-[22px] border border-violet-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                    <p className="text-xs text-slate-500">ID técnico: {option.id}</p>
                  </div>
                  <Button type="button" variant="outline" className="h-8 rounded-xl border-rose-200 px-3 text-xs text-rose-700" onClick={() => props.onRemoveResponseOption(props.selectedChatbotFlowStage!.id, option.id)}>Eliminar</Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2"><Label>Etiqueta visible</Label><Input value={option.label} onChange={(e) => props.onUpdateResponseOption(props.selectedChatbotFlowStage!.id, option.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Mensaje que enviará</Label><Input value={option.userMessage} onChange={(e) => props.onUpdateResponseOption(props.selectedChatbotFlowStage!.id, option.id, { userMessage: e.target.value })} className="h-11 rounded-xl" /></div>
                  <div className="grid gap-2"><Label>Cómo hace match</Label><Select value={option.matchMode} onValueChange={(value) => props.onUpdateResponseOption(props.selectedChatbotFlowStage!.id, option.id, { matchMode: value as ChatbotFlowResponseMatchMode })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="contains">Contiene palabras</SelectItem><SelectItem value="exact">Coincidencia exacta</SelectItem></SelectContent></Select></div>
                  <div className="grid gap-2"><Label>Etapa destino</Label><Select value={option.targetStageId} onValueChange={(value) => props.onUpdateResponseOption(props.selectedChatbotFlowStage!.id, option.id, { targetStageId: value })}><SelectTrigger className="h-11 rounded-xl bg-white"><SelectValue /></SelectTrigger><SelectContent>{props.flowStages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.title}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Palabras o frases que disparan esta rama</Label><Textarea value={option.matchValue} onChange={(e) => props.onUpdateResponseOption(props.selectedChatbotFlowStage!.id, option.id, { matchValue: e.target.value })} rows={2} className="rounded-2xl" placeholder="Ej: cotizar, precio, necesito comprar" /></div>
                  <div className="grid gap-2 md:col-span-2"><Label>Respuesta del bot al tomar esta rama</Label><Textarea value={option.assistantReply} onChange={(e) => props.onUpdateResponseOption(props.selectedChatbotFlowStage!.id, option.id, { assistantReply: e.target.value })} rows={3} className="rounded-2xl" /></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-800">{props.getResponseMatchModeLabel(option.matchMode)}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Destino: {props.flowStages.find((stage) => stage.id === option.targetStageId)?.title || option.targetStageId}</span>
                </div>
              </div>
            )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">Esta etapa todavía no tiene respuestas guiadas. Agrégalas para construir ramas concretas como en SendPulse.</div>}
          </div>

          <div className="mt-4 grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Botones rápidos visibles</p>
            {props.quickActions.map((action) => (
              <div key={action.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                  <p className="text-xs text-slate-500">{action.message}</p>
                </div>
                <Switch checked={props.selectedChatbotFlowStage!.quickActionIds.includes(action.id) && action.enabled} onCheckedChange={(checked) => props.onToggleStageQuickAction(props.selectedChatbotFlowStage!.id, action.id, checked)} disabled={!action.enabled} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
        <p className="text-sm font-semibold text-slate-900">Biblioteca de quick actions</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Define la etiqueta y el mensaje que cada botón enviará al flujo automático.</p>
        <div className="mt-4 grid gap-3">
          {props.quickActions.map((action) => (
            <div key={action.id} className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{getQuickActionKindLabel(action)}</p>
                  <p className="text-xs text-slate-500">ID técnico: {action.id}</p>
                </div>
                <Switch checked={action.enabled} onCheckedChange={(checked) => props.onUpdateQuickAction(action.id, { enabled: checked })} />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="grid gap-2"><Label>Etiqueta</Label><Input value={action.label} onChange={(e) => props.onUpdateQuickAction(action.id, { label: e.target.value })} className="h-11 rounded-xl" /></div>
                <div className="grid gap-2"><Label>Mensaje que envía</Label><Input value={action.message} onChange={(e) => props.onUpdateQuickAction(action.id, { message: e.target.value })} className="h-11 rounded-xl" /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}