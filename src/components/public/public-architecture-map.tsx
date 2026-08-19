import Link from 'next/link'

import { publicArchitectureMapEdges, publicArchitectureMapNodes } from '@/lib/public-docs-content'

type PublicArchitectureMapProps = {
  highlightSlugs?: string[]
  compact?: boolean
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

export function PublicArchitectureMap({ highlightSlugs = [], compact = false }: PublicArchitectureMapProps) {
  const highlighted = new Set(highlightSlugs)
  const cardHeight = compact ? 360 : 420

  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-6">
      <div className="overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#eef7ff_45%,#f8fafc_100%)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Mapa de arquitectura</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Relaciones entre dominios, permisos y flujo operativo</div>
        </div>

        <div className="relative" style={{ height: `${cardHeight}px` }}>
          <svg viewBox="0 0 1000 440" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="1000" height="440" fill="url(#grid)" />

            {publicArchitectureMapEdges.map((edge) => {
              const from = getNodeCenter(edge.from)
              const to = getNodeCenter(edge.to)
              const controlX = (from.x + to.x) / 2
              const controlY = Math.min(from.y, to.y) - 46
              const labelX = (from.x + to.x) / 2
              const labelY = (from.y + to.y) / 2 - 12

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <path
                    d={`M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`}
                    fill="none"
                    stroke="rgba(14,116,144,0.45)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="7 7"
                  />
                  <rect x={labelX - 64} y={labelY - 12} width="128" height="24" rx="12" fill="rgba(255,255,255,0.92)" stroke="rgba(148,163,184,0.25)" />
                  <text x={labelX} y={labelY + 4} textAnchor="middle" fontSize="11" fill="#0f172a" fontWeight="600">
                    {edge.label}
                  </text>
                </g>
              )
            })}

            {publicArchitectureMapNodes.map((node) => {
              const tone = toneClasses[node.tone]
              const isHighlighted = highlighted.size === 0 || highlighted.has(node.slug)
              return (
                <g key={node.id} opacity={isHighlighted ? 1 : 0.42}>
                  <rect x={node.x - 92} y={node.y - 42} width="184" height="84" rx="24" fill={tone.fill} stroke={tone.stroke} strokeWidth={isHighlighted ? 2.5 : 1.5} />
                  <text x={node.x} y={node.y - 4} textAnchor="middle" fontSize="18" fill="#0f172a" fontWeight="700">
                    {node.label}
                  </text>
                  <text x={node.x} y={node.y + 18} textAnchor="middle" fontSize="12" fill="#475569">
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
            return (
              <Link
                key={node.id}
                href={`/docs/${node.slug}`}
                className={`rounded-2xl border px-4 py-3 text-sm transition hover:bg-white ${tone.badge} ${isHighlighted ? 'shadow-sm' : 'opacity-70'}`}
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