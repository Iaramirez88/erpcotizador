import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ImageIcon, MessageSquareText } from 'lucide-react'
import { auth } from '@/lib/auth'
import { queryAiWorkspaceHistory, type AiWorkspaceHistoryEntry, type AiWorkspaceHistoryKind } from '@/lib/ai-workspace-history'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function formatKindLabel(kind: AiWorkspaceHistoryKind) {
  return kind === 'IMAGE_GENERATION' ? 'Imagen IA' : 'Cotización IA'
}

function kindBadgeClass(kind: AiWorkspaceHistoryKind) {
  return kind === 'IMAGE_GENERATION'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-sky-200 bg-sky-50 text-sky-700'
}

function buildActorMap(entries: AiWorkspaceHistoryEntry[]) {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const userId = entry.actorUserId?.trim()
    if (!userId) continue
    const label = entry.actorLabel?.trim() || userId
    if (!map.has(userId)) map.set(userId, label)
  }
  return Array.from(map.entries())
    .map(([userId, label]) => ({ userId, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function buildSearchHref(params: Record<string, string>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value.trim()) search.set(key, value.trim())
  }
  const query = search.toString()
  return query ? `/dashboard/litografia/auditoria-ia?${query}` : '/dashboard/litografia/auditoria-ia'
}

export default async function LitografiaAiAuditPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  const userId = await resolveUserIdFromSession(session)
  if (!userId) {
    redirect('/auth/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { empresaId: true },
  })

  if (!user?.empresaId) {
    redirect('/dashboard/litografia')
  }

  const actorQuery = getSingleParam(searchParams?.usuario)
  const actorUserId = getSingleParam(searchParams?.usuarioId)
  const from = getSingleParam(searchParams?.desde)
  const to = getSingleParam(searchParams?.hasta)
  const promptQuery = getSingleParam(searchParams?.q)
  const kindParam = getSingleParam(searchParams?.tipo)
  const selectedKinds = kindParam === 'imagenes'
    ? ['IMAGE_GENERATION'] satisfies AiWorkspaceHistoryKind[]
    : kindParam === 'cotizaciones'
      ? ['LITOGRAFIA_QUOTE'] satisfies AiWorkspaceHistoryKind[]
      : ['LITOGRAFIA_QUOTE', 'IMAGE_GENERATION'] satisfies AiWorkspaceHistoryKind[]

  const [allEntries, filteredEntries] = await Promise.all([
    queryAiWorkspaceHistory({
      empresaId: user.empresaId,
      limit: 120,
      kinds: ['LITOGRAFIA_QUOTE', 'IMAGE_GENERATION'],
    }),
    queryAiWorkspaceHistory({
      empresaId: user.empresaId,
      limit: 120,
      kinds: selectedKinds,
      actorUserId: actorUserId || null,
      actorQuery: actorQuery || null,
      promptQuery: promptQuery || null,
      from: from || null,
      to: to || null,
    }),
  ])

  const actors = buildActorMap(allEntries)
  const totalEntries = filteredEntries.length
  const totalQuotes = filteredEntries.filter((entry) => entry.kind === 'LITOGRAFIA_QUOTE').length
  const totalImages = filteredEntries.filter((entry) => entry.kind === 'IMAGE_GENERATION').length
  const uniqueUsers = new Set(filteredEntries.map((entry) => entry.actorUserId).filter(Boolean)).size

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Litografía', href: '/dashboard/litografia' },
          { label: 'Auditoría IA' },
        ]}
        title="Auditoría IA"
        description="Consulta qué usuarios hicieron solicitudes al asistente, en qué fechas y qué salió del flujo de texto e imágenes."
        actions={
          <>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/litografia?tab=ia">Abrir asistente IA</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
              <Link href="/dashboard/crm/archivos">Ver archivos generados</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Eventos filtrados</CardDescription>
            <CardTitle className="text-3xl text-slate-950">{totalEntries}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Cotizaciones IA</CardDescription>
            <CardTitle className="text-3xl text-slate-950">{totalQuotes}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Imágenes IA</CardDescription>
            <CardTitle className="text-3xl text-slate-950">{totalImages}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription>Usuarios con actividad</CardDescription>
            <CardTitle className="text-3xl text-slate-950">{uniqueUsers}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardTitle className="text-2xl text-slate-950">Filtros de auditoría</CardTitle>
          <CardDescription>Filtra por usuario, rango de fechas, tipo de flujo o texto del prompt.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form method="GET" className="grid gap-4 lg:grid-cols-6">
            <div className="space-y-2 lg:col-span-2">
              <label htmlFor="usuario" className="text-sm font-medium text-slate-700">Usuario</label>
              <Input id="usuario" name="usuario" defaultValue={actorQuery} placeholder="Nombre o correo" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label htmlFor="usuarioId" className="text-sm font-medium text-slate-700">Usuario exacto</label>
              <select id="usuarioId" name="usuarioId" defaultValue={actorUserId} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400">
                <option value="">Todos</option>
                {actors.map((actor) => (
                  <option key={actor.userId} value={actor.userId}>{actor.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="tipo" className="text-sm font-medium text-slate-700">Tipo</label>
              <select id="tipo" name="tipo" defaultValue={kindParam} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-400">
                <option value="">Todos</option>
                <option value="cotizaciones">Cotizaciones IA</option>
                <option value="imagenes">Imágenes IA</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="desde" className="text-sm font-medium text-slate-700">Desde</label>
              <Input id="desde" name="desde" type="date" defaultValue={from} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <label htmlFor="hasta" className="text-sm font-medium text-slate-700">Hasta</label>
              <Input id="hasta" name="hasta" type="date" defaultValue={to} className="rounded-xl" />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <label htmlFor="q" className="text-sm font-medium text-slate-700">Texto</label>
              <Input id="q" name="q" defaultValue={promptQuery} placeholder="Buscar dentro del prompt, resumen o respuesta" className="rounded-xl" />
            </div>
            <div className="flex items-end gap-3 lg:col-span-2">
              <Button type="submit" className="rounded-xl">Aplicar filtros</Button>
              <Button asChild type="button" variant="outline" className="rounded-xl border-slate-200 bg-white/90">
                <Link href="/dashboard/litografia/auditoria-ia">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-slate-200 shadow-[0_20px_50px_-34px_rgba(15,23,42,0.3)]">
        <CardHeader className="border-b border-slate-100 pb-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-2xl text-slate-950">Trazabilidad de solicitudes</CardTitle>
              <CardDescription>Se muestran hasta 120 eventos recientes de la empresa con los filtros actuales.</CardDescription>
            </div>
            {actors.length ? (
              <div className="flex flex-wrap gap-2">
                {actors.slice(0, 6).map((actor) => (
                  <Link
                    key={actor.userId}
                    href={buildSearchHref({ usuarioId: actor.userId, tipo: kindParam, desde: from, hasta: to, q: promptQuery })}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    {actor.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {filteredEntries.length ? (
            <div className="space-y-4">
              {filteredEntries.map((entry) => {
                const metadataModel = typeof entry.metadata?.model === 'string' ? entry.metadata.model : null
                const metadataSize = typeof entry.metadata?.size === 'string' ? entry.metadata.size : null
                const metadataQuality = typeof entry.metadata?.quality === 'string' ? entry.metadata.quality : null
                const actorLabel = entry.actorLabel || entry.actorUserId || 'Usuario sin identificar'

                return (
                  <article key={entry.id} className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${kindBadgeClass(entry.kind)}`}>
                            {formatKindLabel(entry.kind)}
                          </span>
                          <span className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{formatDateTime(entry.createdAt)}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">{actorLabel}</h3>
                          <p className="text-sm text-slate-500">{entry.actorUserId || 'Sin id de usuario'}{metadataModel ? ` · ${metadataModel}` : ''}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        {entry.kind === 'IMAGE_GENERATION' ? <ImageIcon className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
                        <span>{entry.asset ? 'Con archivo guardado' : 'Sin archivo adjunto'}</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                      <div className="space-y-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Prompt</div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.prompt}</p>
                        </div>

                        {entry.summary ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumen</div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.summary}</p>
                          </div>
                        ) : null}

                        {entry.responseText ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Respuesta</div>
                            <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">{entry.responseText}</p>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Archivo</div>
                          {entry.asset ? (
                            <div className="mt-2 space-y-2 text-sm text-slate-700">
                              <div className="font-medium text-slate-900">{entry.asset.name}</div>
                              <div>{entry.asset.path}</div>
                              {entry.asset.url ? (
                                <Link href={entry.asset.url} className="inline-flex text-sm font-medium text-sky-700 hover:text-sky-900">
                                  Abrir archivo
                                </Link>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">Este evento no dejó archivo asociado.</p>
                          )}
                        </div>

                        {(metadataSize || metadataQuality) ? (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parámetros</div>
                            <div className="mt-2 space-y-1 text-sm text-slate-700">
                              {metadataSize ? <div>Tamaño: {metadataSize}</div> : null}
                              {metadataQuality ? <div>Calidad: {metadataQuality}</div> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-slate-950">No hay eventos para esos filtros</h3>
              <p className="mt-2 text-sm text-slate-600">Ajusta usuario, fechas o tipo para revisar otra parte del historial.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}