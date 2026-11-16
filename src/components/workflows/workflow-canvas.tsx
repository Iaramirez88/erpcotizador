"use client"

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
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

type EdgeLine = { id: string; x1: number; y1: number; x2: number; y2: number }

export function WorkflowCanvas({ nodes, edges, onMoveNode, onConnectEdge }: {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onMoveNode: (id: string, position: Position) => void
  onConnectEdge: (fromId: string, toId: string) => void
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
      return { id: edge.id, x1: from.x + NODE_WIDTH / 2, y1: from.y + NODE_HEIGHT, x2: to.x + NODE_WIDTH / 2, y2: to.y }
    })
    .filter((item): item is EdgeLine => Boolean(item)), [edges, nodePositions])

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
    const startContent = toContent(event)
    const startPosition = nodePositions.get(node.id) ?? { x: PADDING, y: PADDING }
    setDraggingId(node.id)

    function handleMove(moveEvent: PointerEvent) {
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
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">{node.kind}</span>
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
