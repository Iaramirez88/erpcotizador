import { AlertTriangle, CheckCircle2, Gauge, Info, XCircle } from 'lucide-react'

type DiagnosticCheck = { label: string; status: 'PASS' | 'WARN' | 'FAIL' | 'INFO'; value: string; score: number; maxScore: number }
type PageSpeedData = {
  scores?: { performance?: number | null; seo?: number | null; accessibility?: number | null; bestPractices?: number | null }
  lab?: { largestContentfulPaintMs?: number | null; cumulativeLayoutShift?: number | null }
  field?: { largestContentfulPaintMs?: number | null; interactionToNextPaintMs?: number | null; cumulativeLayoutShift?: number | null; overallCategory?: string | null }
}
export type SeoDiagnosticAudit = {
  id: string
  healthScore: number
  indexable: boolean
  statusCode?: number | null
  createdAt: string
  checksJson: Record<string, DiagnosticCheck>
  recommendationsJson: string[]
  metricsJson: { responseTimeMs?: number; pageSpeed?: PageSpeedData | null }
}

function scoreColor(value: number | null) {
  if (value == null) return '#94a3b8'
  if (value >= 90) return '#16a34a'
  if (value >= 50) return '#d97706'
  return '#dc2626'
}

function ScoreRing({ label, value }: { label: string; value: number | null }) {
  const color = scoreColor(value)
  const progress = Math.max(0, Math.min(100, value ?? 0))
  return <div className="flex flex-col items-center gap-2 text-center">
    <div className="grid h-24 w-24 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${progress * 3.6}deg, #e2e8f0 0deg)` }}>
      <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white"><span className="text-2xl font-semibold" style={{ color }}>{value ?? '—'}</span></div>
    </div>
    <p className="text-sm font-medium text-slate-700">{label}</p>
  </div>
}

function vitalState(value: number | null, good: number, poor: number) {
  if (value == null) return { label: 'Sin datos', className: 'text-slate-500', bar: 'bg-slate-300', width: '0%' }
  if (value <= good) return { label: 'Bueno', className: 'text-emerald-700', bar: 'bg-emerald-500', width: '33%' }
  if (value <= poor) return { label: 'Necesita mejora', className: 'text-amber-700', bar: 'bg-amber-500', width: '66%' }
  return { label: 'Deficiente', className: 'text-rose-700', bar: 'bg-rose-500', width: '100%' }
}

function Vital({ label, value, unit, good, poor }: { label: string; value: number | null; unit: string; good: number; poor: number }) {
  const state = vitalState(value, good, poor)
  const formatted = value == null ? '—' : unit === '' ? value.toFixed(3) : Math.round(value).toLocaleString('es-CO')
  return <div className="border-l-2 border-slate-200 pl-4">
    <div className="flex items-baseline justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`text-xs font-semibold ${state.className}`}>{state.label}</p></div>
    <p className="mt-1 text-2xl font-semibold text-slate-950">{formatted}<span className="ml-1 text-xs font-normal text-slate-500">{value == null ? '' : unit}</span></p>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${state.bar}`} style={{ width: state.width }} /></div>
  </div>
}

const statusMeta = {
  FAIL: { label: 'Críticos', icon: XCircle, className: 'text-rose-700 bg-rose-50 border-rose-200' },
  WARN: { label: 'Por mejorar', icon: AlertTriangle, className: 'text-amber-700 bg-amber-50 border-amber-200' },
  PASS: { label: 'Aprobados', icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  INFO: { label: 'Informativos', icon: Info, className: 'text-sky-700 bg-sky-50 border-sky-200' },
} as const

export default function SeoDiagnosticsReport({ audits }: { audits: SeoDiagnosticAudit[] }) {
  const latest = audits[0]
  if (!latest) return <div className="grid min-h-48 place-items-center border border-dashed border-slate-300 p-6 text-center"><div><Gauge className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-medium text-slate-700">Ejecuta el primer diagnóstico para medir SEO y rendimiento.</p></div></div>
  const pageSpeed = latest.metricsJson.pageSpeed
  const scores = pageSpeed?.scores
  const lcp = pageSpeed?.field?.largestContentfulPaintMs ?? pageSpeed?.lab?.largestContentfulPaintMs ?? null
  const inp = pageSpeed?.field?.interactionToNextPaintMs ?? null
  const cls = pageSpeed?.field?.cumulativeLayoutShift ?? pageSpeed?.lab?.cumulativeLayoutShift ?? null
  const checks = Object.values(latest.checksJson)

  return <div className="space-y-6">
    <div className="grid gap-6 border-b border-slate-100 pb-6 sm:grid-cols-2 lg:grid-cols-4">
      <ScoreRing label="Salud SEO" value={latest.healthScore} />
      <ScoreRing label="Rendimiento" value={scores?.performance ?? null} />
      <ScoreRing label="Accesibilidad" value={scores?.accessibility ?? null} />
      <ScoreRing label="Buenas prácticas" value={scores?.bestPractices ?? null} />
    </div>

    <div><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-slate-950">Core Web Vitals</h3><p className="text-xs text-slate-500">Experiencia móvil basada en datos reales cuando están disponibles.</p></div><span className="text-xs font-medium text-slate-500">{pageSpeed?.field?.overallCategory || 'PageSpeed sin datos de campo'}</span></div><div className="grid gap-5 md:grid-cols-3"><Vital label="LCP · carga" value={lcp} unit="ms" good={2500} poor={4000} /><Vital label="INP · interacción" value={inp} unit="ms" good={200} poor={500} /><Vital label="CLS · estabilidad" value={cls} unit="" good={0.1} poor={0.25} /></div></div>

    <div className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
      <div><h3 className="mb-3 font-semibold text-slate-950">Resumen del rastreo</h3><div className="grid grid-cols-2 gap-2">{(['FAIL', 'WARN', 'PASS', 'INFO'] as const).map((status) => { const meta = statusMeta[status]; const Icon = meta.icon; return <div key={status} className={`border p-3 ${meta.className}`}><Icon className="h-4 w-4" /><p className="mt-2 text-2xl font-semibold">{checks.filter((check) => check.status === status).length}</p><p className="text-xs font-medium">{meta.label}</p></div> })}</div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="border border-slate-200 p-2"><p className="text-[11px] text-slate-500">HTTP</p><p className="font-semibold">{latest.statusCode || '—'}</p></div><div className="border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Indexación</p><p className={`font-semibold ${latest.indexable ? 'text-emerald-700' : 'text-rose-700'}`}>{latest.indexable ? 'Sí' : 'No'}</p></div><div className="border border-slate-200 p-2"><p className="text-[11px] text-slate-500">Respuesta</p><p className="font-semibold">{latest.metricsJson.responseTimeMs ?? '—'} ms</p></div></div></div>
      <div><h3 className="mb-3 font-semibold text-slate-950">Prioridades</h3>{latest.recommendationsJson.length ? <ol className="divide-y border border-slate-200">{latest.recommendationsJson.map((item, index) => <li key={`${item}-${index}`} className="flex gap-3 p-3 text-sm text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center bg-slate-900 text-xs font-semibold text-white">{index + 1}</span><span>{item}</span></li>)}</ol> : <div className="border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">No hay acciones críticas pendientes.</div>}</div>
    </div>

    <details className="group border border-slate-200"><summary className="cursor-pointer list-none p-4 text-sm font-semibold text-slate-900">Ver los {checks.length} controles técnicos</summary><div className="grid gap-px border-t border-slate-200 bg-slate-200 sm:grid-cols-2 xl:grid-cols-3">{checks.map((check) => <div key={check.label} className="bg-white p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-900">{check.label}</p><span className={statusMeta[check.status].className.split(' ')[0]}>{check.score}/{check.maxScore}</span></div><p className="mt-1 text-xs text-slate-500">{check.value}</p></div>)}</div></details>

    {audits.length > 1 ? <div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-slate-950">Evolución de salud SEO</h3><span className="text-xs text-slate-500">Últimos {audits.length} rastreos</span></div><div className="flex h-28 items-end gap-2 border-b border-slate-200 px-2">{audits.slice().reverse().map((audit) => <div key={audit.id} className="flex min-w-0 flex-1 flex-col items-center gap-1"><span className="text-[10px] font-semibold text-slate-600">{audit.healthScore}</span><div className="w-full bg-slate-900" style={{ height: `${Math.max(4, audit.healthScore)}%` }} title={`${new Date(audit.createdAt).toLocaleDateString('es-CO')}: ${audit.healthScore}/100`} /></div>)}</div></div> : null}
    <p className="text-xs text-slate-500">Último diagnóstico: {new Date(latest.createdAt).toLocaleString('es-CO')}</p>
  </div>
}