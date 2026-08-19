import Link from 'next/link'

import { publicArchitectureMapEdges, publicArchitectureMapNodes } from '@/lib/public-docs-content'

type PublicArchitectureMapProps = {
  highlightSlugs?: string[]
  compact?: boolean
  interactive?: boolean
}

type Point = {
  x: number
  y: number
}

const toneClasses = {
  sky: {
    fill: '#e0f2fe',
    stroke: '#7dd3fc',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  teal: {
    fill: '#dcfce7',
    stroke: '#6ee7b7',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  amber: {
    fill: '#fef3c7',
    stroke: '#fcd34d',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
} as const

function getNodeCenter(id: string) {
  const node = publicArchitectureMapNodes.find((item) => item.id === id)
  if (!node) return { x: 0, y: 0 }
  return { x: node.x, y: node.y }
}

const NORMAL_LAYOUT: Record<string, Point> = {
  nucleo: { x: 120, y: 110 },
  crm: { x: 360, y: 110 },
  ventas: { x: 620, y: 110 },
  inventario: { x: 880, y: 110 },
  verticales: { x: 120, y: 350 },
  ia: { x: 360, y: 350 },
  operaciones: { x: 620, y: 350 },
  finanzas: { x: 880, y: 350 },
}

const COMPACT_LAYOUT: Record<string, Point> = {
  nucleo: { x: 120, y: 118 },
  crm: { x: 360, y: 118 },
  ventas: { x: 620, y: 118 },
  inventario: { x: 880, y: 118 },
  verticales: { x: 120, y: 336 },
  ia: { x: 360, y: 336 },
  operaciones: { x: 620, y: 336 },
  finanzas: { x: 880, y: 336 },
}

const EDGE_LABEL_OVERRIDES: Record<string, Point> = {
  'nucleo-crm': { x: 240, y: 84 },
  'nucleo-ventas': { x: 370, y: 58 },
  'nucleo-inventario': { x: 496, y: 84 },
  'crm-ventas': { x: 492, y: 84 },
  'ventas-operaciones': { x: 620, y: 230 },
  'inventario-ventas': { x: 748, y: 84 },
  'inventario-operaciones': { x: 786, y: 220 },
  'ventas-finanzas': { x: 744, y: 220 },
  'ia-crm': { x: 360, y: 230 },
  'ia-operaciones': { x: 490, y: 336 },
  'verticales-operaciones': { x: 372, y: 336 },
  'verticales-finanzas': { x: 620, y: 336 },
}

function getLayoutPoint(id: string, compact: boolean) {
  const layout = compact ? COMPACT_LAYOUT : NORMAL_LAYOUT
  return layout[id] ?? getNodeCenter(id)
}

function getEdgeAnchors(from: Point, to: Point, nodeWidth: number, nodeHeight: number) {
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      start: { x: from.x + Math.sign(dx || 1) * (nodeWidth / 2), y: from.y },
      end: { x: to.x - Math.sign(dx || 1) * (nodeWidth / 2), y: to.y },
    }
  }

  return {
    start: { x: from.x, y: from.y + Math.sign(dy || 1) * (nodeHeight / 2) },
    end: { x: to.x, y: to.y - Math.sign(dy || 1) * (nodeHeight / 2) },
  }
}

export function PublicArchitectureMap({ highlightSlugs = [], compact = false, interactive = true }: PublicArchitectureMapProps) {
  const highlighted = new Set(highlightSlugs)
  const cardHeight = compact ? 400 : 500
  const viewBoxHeight = compact ? 460 : 520
  const nodeWidth = compact ? 146 : 156
  const nodeHeight = compact ? 58 : 66
  const nodeRadius = compact ? 20 : 22

  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-6">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef7ff_45%,#f8fafc_100%)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Mapa de arquitectura</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Relaciones entre dominios, permisos y flujo operativo</div>
        </div>

        <div className="relative" style={{ height: `${cardHeight}px` }}>
          <svg viewBox={`0 0 1000 ${viewBoxHeight}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1000" height={viewBoxHeight} fill="url(#grid)" />

            {publicArchitectureMapEdges.map((edge) => {
              const from = getLayoutPoint(edge.from, compact)
              const to = getLayoutPoint(edge.to, compact)
              const { start, end } = getEdgeAnchors(from, to, nodeWidth, nodeHeight)
              const dx = end.x - start.x
              const dy = end.y - start.y
              const controlX = (start.x + end.x) / 2
              const controlY = Math.abs(dx) >= Math.abs(dy)
                ? Math.min(start.y, end.y) - (Math.abs(dx) > 180 ? 38 : 18)
                : (start.y + end.y) / 2
              const label = EDGE_LABEL_OVERRIDES[`${edge.from}-${edge.to}`] ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 10 }

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <path
                    d={`M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`}
                    fill="none"
                    stroke="rgba(14,116,144,0.42)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray="7 7"
                  />
                  <rect x={label.x - 58} y={label.y - 11} width="116" height="22" rx="11" fill="rgba(255,255,255,0.94)" stroke="rgba(148,163,184,0.22)" />
                  <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize="10.5" fill="#0f172a" fontWeight="600">
                    {edge.label}
                  </text>
                </g>
              )
            })}

            {publicArchitectureMapNodes.map((node) => {
              const tone = toneClasses[node.tone]
              const isHighlighted = highlighted.size === 0 || highlighted.has(node.slug)
              const point = getLayoutPoint(node.id, compact)
              return (
                <g key={node.id} opacity={isHighlighted ? 1 : 0.42}>
                  <rect x={point.x - nodeWidth / 2} y={point.y - nodeHeight / 2} width={nodeWidth} height={nodeHeight} rx={nodeRadius} fill={tone.fill} stroke={tone.stroke} strokeWidth={isHighlighted ? 2.5 : 1.5} />
                  <text x={point.x} y={point.y - 2} textAnchor="middle" fontSize={compact ? '16' : '17'} fill="#0f172a" fontWeight="700">
                    {node.label}
                  </text>
                  <text x={point.x} y={point.y + 16} textAnchor="middle" fontSize={compact ? '11' : '12'} fill="#475569">
                    {node.subtitle}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="grid gap-3 border-t border-slate-200 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          {publicArchitectureMapNodes.map((node) => {
            const tone = toneClasses[node.tone]
            const isHighlighted = highlighted.size === 0 || highlighted.has(node.slug)
            const className = `rounded-2xl border px-4 py-3 text-sm ${interactive ? 'transition hover:bg-white' : ''} ${tone.badge} ${isHighlighted ? 'shadow-sm' : 'opacity-70'}`

            if (!interactive) {
              return (
                <div key={node.id} className={className}>
                  <div className="font-semibold">{node.label}</div>
                  <div className="mt-1 text-xs leading-5">{node.subtitle}</div>
                </div>
              )
            }

            return (
              <Link
                key={node.id}
                href={`/docs/${node.slug}`}
                className={className}
              >
                <div className="font-semibold">{node.label}</div>
                <div className="mt-1 text-xs leading-5">{node.subtitle}</div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}