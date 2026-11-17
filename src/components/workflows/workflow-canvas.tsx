"use client"

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Pencil, Plus, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowEdge, WorkflowNode } from '@/lib/workflows'

type Position = { x: number; y: number }

const NODE_WIDTH = 220
const NODE_HEIGHT = 88
const PADDING = 40
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2

function resolveNodePosition(node: WorkflowNode, index: number): Position {
  const raw = node.config.position as Position | undefined
  if (raw && typeof raw.x === 'number' && typeof raw.y === 'number') {
    return { x: raw.x, y: raw.y }
  }
  return { x: PADDING, y: PADDING + index * 120 }
}

type EdgeLine = { id: string; from: string; label: string | null; x1: number; y1: number; x2: number; y2: number }

function nextBranchLabel(current: string | null): 'true' | 'false' | null {
  if (current === 'true') return 'false'
  if (current === 'false') return null
  return 'true'
}

export function WorkflowCanvas({ nodes, edges, onMoveNode, onConnectEdge, onNodeClick, onEdgeLabel }: {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onMoveNode: (id: string, position: Position) => void
  onConnectEdge: (fromId: string, toId: string) => void
  onNodeClick: (id: string) => void
  onEdgeLabel: (id: string, label: 'true' | 'false' | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<{ fromId: string; x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)

  const nodePositions = useMemo(() => {
    const map = new Map<string, Position>()
    nodes.forEach((node, index) => map.set(node.id, resolveNodePosition(node, index)))
    return map
  }, [nodes])

  const edgeLines = useMemo<EdgeLine[]>(() => edges
    .map((edge) => {
      const from = nodePositions.get(edge.from)
      const to = nodePositions.get(edge.to)
      if (!from || !to) return null
      return { id: edge.id, from: edge.from, label: edge.label, x1: from.x + NODE_WIDTH / 2, y1: from.y + NODE_HEIGHT, x2: to.x + NODE_WIDTH / 2, y2: to.y }
    })
    .filter((item): item is EdgeLine => Boolean(item)), [edges, nodePositions])

  const conditionNodeIds = useMemo(() => new Set(nodes.filter((node) => node.kind === 'CONDITION').map((node) => node.id)), [nodes])

  const canvasSize = useMemo(() => {
    const width = Math.max(480, ...nodes.map((node, index) => resolveNodePosition(node, index).x + NODE_WIDTH + PADDING))
    const height = Math.max(360, ...nodes.map((node, index) => resolveNodePosition(node, index).y + NODE_HEIGHT + PADDING))
    return { width, height }
  }, [nodes])

  function toContent(event: { clientX: number; clientY: number }): Position {
    const rect = containerRef.current!.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left + containerRef.current!.scrollLeft) / zoom,
      y: (event.clientY - rect.top + containerRef.current!.scrollTop) / zoom,
    }
  }

  function handleNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, node: WorkflowNode) {
    event.preventDefault()
    const startClient = { x: event.clientX, y: event.clientY }
    const startContent = toContent(event)
    const startPosition = nodePositions.get(node.id) ?? { x: PADDING, y: PADDING }
    let moved = false
    setDraggingId(node.id)

    function handleMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - startClient.x
      const dy = moveEvent.clientY - startClient.y
      if (Math.abs(dx) + Math.abs(dy) > 4) moved = true
      if (!moved) return
      const current = toContent(moveEvent)
      onMoveNode(node.id, {
        x: Math.max(0, startPosition.x + (current.x - startContent.x)),
        y: Math.max(0, startPosition.y + (current.y - startContent.y)),
      })
    }

    function handleUp() {
      setDraggingId(null)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      if (!moved) onNodeClick(node.id)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function handleConnectPointerDown(event: ReactPointerEvent<HTMLSpanElement>, node: WorkflowNode) {
    event.preventDefault()
    event.stopPropagation()
    const start = toContent(event)
    setConnecting({ fromId: node.id, x: start.x + NODE_WIDTH / 2, y: start.y + NODE_HEIGHT })

    function handleMove(moveEvent: PointerEvent) {
      const pos = toContent(moveEvent)
      setConnecting((current) => (current ? { ...current, x: pos.x, y: pos.y } : current))
    }

    function handleUp(upEvent: PointerEvent) {
      const targetEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest('[data-node-id]')
      const targetId = targetEl?.getAttribute('data-node-id')
      if (targetId && targetId !== connecting?.fromId) {
        onConnectEdge(connecting!.fromId, targetId)
      }
      setConnecting(null)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function zoomBy(delta: number) {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((current + delta) * 10) / 10)))
  }

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative overflow-auto rounded-2xl border border-slate-200 bg-[radial-gradient(circle,#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]"
        style={{ height: 420 }}
      >
        <div className="relative" style={{ width: canvasSize.width * zoom, height: canvasSize.height * zoom }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: canvasSize.width, height: canvasSize.height }}>
            <svg className="pointer-events-none absolute inset-0" width={canvasSize.width} height={canvasSize.height}>
              {edgeLines.map((line) => (
                <path
                  key={line.id}
                  d={`M ${line.x1} ${line.y1} C ${line.x1} ${(line.y1 + line.y2) / 2}, ${line.x2} ${(line.y1 + line.y2) / 2}, ${line.x2} ${line.y2}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              ))}
              {connecting ? (
                <path
                  d={`M ${connecting.x} ${connecting.y} C ${connecting.x} ${(connecting.y + connecting.y) / 2}, ${connecting.x} ${(connecting.y + connecting.y) / 2}, ${connecting.x} ${connecting.y}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              ) : null}
            </svg>

            {edgeLines
              .filter((line) => conditionNodeIds.has(line.from))
              .map((line) => {
                const mx = (line.x1 + line.x2) / 2
                const my = (line.y1 + line.y2) / 2
                const current = line.label === 'true' ? 'true' : line.label === 'false' ? 'false' : null
                return (
                  <button
                    key={line.id}
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdgeLabel(line.id, nextBranchLabel(current))
                    }}
                    className={cn(
                      'absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                      current === 'true'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : current === 'false'
                          ? 'border-rose-300 bg-rose-50 text-rose-700'
                          : 'border-slate-300 bg-white text-slate-500'
                    )}
                    style={{ left: mx, top: my }}
                    title="Clic para alternar Sí / No (rama de la condición)"
                  >
                    {current === 'true' ? 'Sí' : current === 'false' ? 'No' : '…'}
                  </button>
                )
              })}

            {nodes.map((node) => {
              const pos = nodePositions.get(node.id) ?? { x: PADDING, y: PADDING }
              const dragging = draggingId === node.id
              return (
                <div
                  key={node.id}
                  data-node-id={node.id}
                  onPointerDown={(event) => handleNodePointerDown(event, node)}
                  className={`absolute select-none rounded-2xl border bg-white p-3 shadow-sm ${dragging ? 'cursor-grabbing border-sky-400 shadow-md' : 'cursor-grab border-slate-300'}`}
                  style={{ left: pos.x, top: pos.y, width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{node.kind}</span>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        onNodeClick(node.id)
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      title="Configurar nodo"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-800">{node.label || node.kind}</p>
                  <span
                    data-node-handle={node.id}
                    onPointerDown={(event) => handleConnectPointerDown(event, node)}
                    className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-sky-400 bg-white"
                    title="Arrastra para conectar"
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="absolute right-3 top-3 flex gap-1">
        <button type="button" onClick={() => zoomBy(-0.1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Alejar">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setZoom(1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Restablecer zoom">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => zoomBy(0.1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Acercar">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 h-24 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white/85">
        {nodes.map((node, index) => {
          const pos = resolveNodePosition(node, index)
          return (
            <span
              key={node.id}
              className="absolute h-1.5 w-1.5 rounded-full bg-slate-400"
              style={{ left: (pos.x / canvasSize.width) * 128, top: (pos.y / canvasSize.height) * 96 }}
            />
          )
        })}
      </div>
    </div>
  )
}
