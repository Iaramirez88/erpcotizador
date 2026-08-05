"use client"

import type { Dispatch, SetStateAction } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Activity, Goal, Sparkles, Target, TrendingUp } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TabsContent } from '@/components/ui/tabs'

type GoalTargets = {
  operational: string
  captures: string
  conversations: string
}

type MetricGoal = {
  label: string
  caption: string
  value: number
  target: number
  progress: number
  accent: string
  icon: LucideIcon
}

type ChannelAnalytics = {
  scorecards: {
    activationRate: number
    productionRate: number
    configured: number
    demo: number
    production: number
  }
  defaultTargets: {
    operational: number
    captures: number
    conversations: number
  }
  goals: MetricGoal[]
  performance: Array<{
    name: string
    fullName: string
    provider: string
    captures: number
    conversations: number
  }>
  distribution: Array<{
    label: string
    value: number
    color: string
  }>
  timeline: Array<{
    label: string
    captures: number
    conversations: number
    channels: number
  }>
}

type Stats = {
  captures: number
  conversations: number
}

type Props = {
  language: 'es' | 'en'
  metricsExpanded: boolean
  setMetricsExpanded: Dispatch<SetStateAction<boolean>>
  goalTargets: GoalTargets
  setGoalTargets: Dispatch<SetStateAction<GoalTargets>>
  stats: Stats
  channelAnalytics: ChannelAnalytics
  formatCompactNumber: (value: number, language: 'es' | 'en') => string
}

export function CrmIntegrationsMetricsTab(props: Props) {
  const {
    language,
    metricsExpanded,
    setMetricsExpanded,
    goalTargets,
    setGoalTargets,
    stats,
    channelAnalytics,
    formatCompactNumber,
  } = props

  return (
    <TabsContent value="metrics" className="space-y-5">
      <Card className="overflow-hidden rounded-[30px] border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_36%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.95))] shadow-[0_28px_80px_-46px_rgba(2,132,199,0.45)]">
        <CardContent className="p-6 md:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                {language === 'en' ? 'Omnichannel intelligence' : 'Inteligencia omnicanal'}
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">{language === 'en' ? 'Metrics, goals, and trends' : 'Métricas, metas y tendencias'}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:text-base">
                  {language === 'en' ? 'This area concentrates the executive dashboard. It is kept separate so daily operations stay lighter and analysis opens only when you need it.' : 'Este espacio concentra el tablero ejecutivo. Lo dejamos aparte para que la operación diaria siga ligera y aquí puedas abrir el análisis sólo cuando lo necesites.'}
                </p>
              </div>
            </div>
            <Button variant="outline" className="rounded-2xl border-slate-200 bg-white/85" onClick={() => setMetricsExpanded((current) => !current)}>
              {metricsExpanded ? (language === 'en' ? 'Collapse dashboard' : 'Colapsar dashboard') : (language === 'en' ? 'Expand dashboard' : 'Expandir dashboard')}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{language === 'en' ? 'Activation' : 'Activación'}</span>
                <Target className="h-4 w-4 text-sky-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.activationRate}%</p>
              <p className="mt-1 text-sm text-slate-600">{language === 'en' ? 'Active or testing channels over the total.' : 'Canales activos o en testing sobre el total.'}</p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{language === 'en' ? 'Production' : 'Producción'}</span>
                <Goal className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-3 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.productionRate}%</p>
              <p className="mt-1 text-sm text-slate-600">{language === 'en' ? 'Channels ready for real operation.' : 'Canales listos para salir a operación real.'}</p>
            </div>
            <div className="rounded-[22px] border border-cyan-200 bg-[linear-gradient(135deg,#0f172a,#0b4a6f)] p-4 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.7)]">
              <div className="flex items-center justify-between text-cyan-100">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Momentum</span>
                <TrendingUp className="h-4 w-4 text-cyan-300" />
              </div>
              <p className="mt-3 text-3xl font-semibold">{formatCompactNumber(stats.captures + stats.conversations, language)}</p>
              <p className="mt-1 text-sm text-cyan-50/90">{language === 'en' ? 'Total interactions traced from integrations.' : 'Interacciones totales trazadas desde integraciones.'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-[30px] border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fbff)] text-slate-950 shadow-[0_28px_80px_-46px_rgba(15,23,42,0.22)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-slate-950">{language === 'en' ? 'Configurable goals' : 'Metas configurables'}</CardTitle>
            <CardDescription className="text-slate-600">{language === 'en' ? 'You can override the suggested targets and progress recalculates instantly.' : 'Puedes sobreescribir los objetivos sugeridos y el progreso se recalcula al instante.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label className="text-sm font-medium text-slate-700">{language === 'en' ? 'Operational channels target' : 'Meta de canales operativos'}</Label>
                <Input value={goalTargets.operational} onChange={(event) => setGoalTargets((current) => ({ ...current, operational: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.operational)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium text-slate-700">{language === 'en' ? 'Captures target' : 'Meta de capturas'}</Label>
                <Input value={goalTargets.captures} onChange={(event) => setGoalTargets((current) => ({ ...current, captures: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.captures)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium text-slate-700">{language === 'en' ? 'Conversations target' : 'Meta de conversaciones'}</Label>
                <Input value={goalTargets.conversations} onChange={(event) => setGoalTargets((current) => ({ ...current, conversations: event.target.value.replace(/[^0-9]/g, '') }))} placeholder={String(channelAnalytics.defaultTargets.conversations)} className="rounded-2xl border-slate-300 bg-white text-slate-950 placeholder:text-slate-500" />
              </div>
            </div>

            <div className="space-y-4">
              {channelAnalytics.goals.map((goal) => {
                const Icon = goal.icon
                return (
                  <div key={goal.label} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-950">{goal.label}</p>
                        <p className="text-sm text-slate-600">{goal.caption}</p>
                      </div>
                      <div className={`rounded-2xl bg-gradient-to-br ${goal.accent} p-3 text-white shadow-lg`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-semibold text-slate-950">{formatCompactNumber(goal.value, language)}</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{language === 'en' ? 'Target' : 'Meta'} {formatCompactNumber(goal.target, language)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-slate-950">{goal.progress}%</p>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{language === 'en' ? 'Reached' : 'Cumplido'}</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full bg-gradient-to-r ${goal.accent} transition-all duration-700`} style={{ width: `${goal.progress}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {metricsExpanded ? (
            <>
              <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                  <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>{language === 'en' ? 'Channels with highest impact' : 'Canales con mayor impacto'}</CardTitle>
                      <CardDescription>{language === 'en' ? 'Comparison of captures and conversations by channel in the commercial layer.' : 'Comparativo de capturas y conversaciones por canal en la capa comercial.'}</CardDescription>
                    </div>
                    <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                      Top {Math.max(1, channelAnalytics.performance.length)}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 md:p-6">
                    <div className="h-[340px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={channelAnalytics.performance} barGap={10}>
                          <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" vertical={false} />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                          <Tooltip
                            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const item = payload[0]?.payload as { fullName: string; provider: string; captures: number; conversations: number } | undefined
                              if (!item) return null
                              return (
                                <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
                                  <p className="text-sm font-semibold text-slate-950">{item.fullName}</p>
                                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{item.provider}</p>
                                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                                    <p>{language === 'en' ? 'Captures:' : 'Capturas:'} <span className="font-semibold text-slate-950">{item.captures}</span></p>
                                    <p>{language === 'en' ? 'Conversations:' : 'Conversaciones:'} <span className="font-semibold text-slate-950">{item.conversations}</span></p>
                                  </div>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="captures" name={language === 'en' ? 'Captures' : 'Capturas'} radius={[10, 10, 0, 0]} fill="#0ea5e9" />
                          <Bar dataKey="conversations" name={language === 'en' ? 'Conversations' : 'Conversaciones'} radius={[10, 10, 0, 0]} fill="#0f172a" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {channelAnalytics.performance.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                        {language === 'en' ? 'Create channels to start seeing real-time performance comparisons.' : 'Crea canales para empezar a ver comparativos de rendimiento en tiempo real.'}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                  <CardHeader className="border-b border-slate-100 pb-5">
                    <CardTitle>{language === 'en' ? 'Channel mix' : 'Mix de canales'}</CardTitle>
                    <CardDescription>{language === 'en' ? 'Distribution by source to detect concentration and diversification of the stack.' : 'Distribución por origen para detectar concentración y diversificación del stack.'}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 p-4 md:p-6">
                    <div className="h-[260px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: language === 'en' ? 'No channels' : 'Sin canales', value: 1, color: '#cbd5e1' }]}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={62}
                            outerRadius={92}
                            paddingAngle={4}
                            stroke="none"
                          >
                            {(channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: language === 'en' ? 'No channels' : 'Sin canales', value: 1, color: '#cbd5e1' }]).map((entry) => (
                              <Cell key={entry.label} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const item = payload[0]?.payload as { label: string; value: number } | undefined
                              if (!item) return null
                              return (
                                <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
                                  <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                                  <p className="text-sm text-slate-600">{item.value} {language === 'en' ? 'channel(s)' : 'canal(es)'}</p>
                                </div>
                              )
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {(channelAnalytics.distribution.length > 0 ? channelAnalytics.distribution : [{ label: language === 'en' ? 'No channels' : 'Sin canales', value: 0, color: '#cbd5e1' }]).map((entry) => (
                        <div key={entry.label} className="flex items-center justify-between rounded-[20px] border border-slate-100 bg-slate-50/80 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-sm font-medium text-slate-700">{entry.label}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-950">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
                <CardHeader className="flex flex-col gap-3 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle>{language === 'en' ? 'Monthly activity pace' : 'Ritmo de actividad por mes'}</CardTitle>
                    <CardDescription>{language === 'en' ? 'Timeline based on the latest activity or update of each channel.' : 'Lectura temporal con base en última actividad o actualización de cada canal.'}</CardDescription>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {language === 'en' ? 'Last 6 months' : 'Últimos 6 meses'}
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={channelAnalytics.timeline}>
                        <defs>
                          <linearGradient id="crmCapturesGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.2} />
                          </linearGradient>
                          <linearGradient id="crmConversationsGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#f97316" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 8" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#475569', fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const captures = Number(payload.find((item) => item.dataKey === 'captures')?.value ?? 0)
                            const conversations = Number(payload.find((item) => item.dataKey === 'conversations')?.value ?? 0)
                            const channelsInMonth = Number((payload[0]?.payload as { channels?: number } | undefined)?.channels ?? 0)
                            return (
                              <div className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl">
                                <p className="text-sm font-semibold text-slate-950">{label}</p>
                                <div className="mt-2 space-y-1 text-sm text-slate-700">
                                  <p>{language === 'en' ? 'Captures:' : 'Capturas:'} <span className="font-semibold text-slate-950">{captures}</span></p>
                                  <p>{language === 'en' ? 'Conversations:' : 'Conversaciones:'} <span className="font-semibold text-slate-950">{conversations}</span></p>
                                  <p>{language === 'en' ? 'Channels with activity:' : 'Canales con actividad:'} <span className="font-semibold text-slate-950">{channelsInMonth}</span></p>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Line type="monotone" dataKey="captures" name={language === 'en' ? 'Captures' : 'Capturas'} stroke="url(#crmCapturesGradient)" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9' }} activeDot={{ r: 6 }} />
                        <Line type="monotone" dataKey="conversations" name={language === 'en' ? 'Conversations' : 'Conversaciones'} stroke="url(#crmConversationsGradient)" strokeWidth={3} dot={{ r: 4, fill: '#f97316' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="rounded-[30px] border-slate-200 bg-white/95 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.34)]">
              <CardHeader>
                <CardTitle className="text-slate-950">{language === 'en' ? 'Collapsed dashboard' : 'Dashboard colapsado'}</CardTitle>
                <CardDescription className="text-slate-600">{language === 'en' ? 'Expand it when you want to review charts, trends, and distribution by channel.' : 'Expándelo cuando quieras revisar gráficos, tendencias y distribución por canal.'}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">{language === 'en' ? 'Configured' : 'Configurados'}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.configured}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Demo-ready</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.demo}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">Go-live</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{channelAnalytics.scorecards.production}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </TabsContent>
  )
}