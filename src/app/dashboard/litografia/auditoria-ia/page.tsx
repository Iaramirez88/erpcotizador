import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { queryAiWorkspaceHistory, queryAiWorkspaceHistoryPage, type AiWorkspaceHistoryEntry, type AiWorkspaceHistoryKind } from '@/lib/ai-workspace-history'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LitografiaAiAuditList } from '@/components/litografia/litografia-ai-audit-list'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

function getSingleParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
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
  const pageParam = Number.parseInt(getSingleParam(searchParams?.page), 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1
  const selectedKinds = kindParam === 'imagenes'
    ? ['IMAGE_GENERATION'] satisfies AiWorkspaceHistoryKind[]
    : kindParam === 'vectorizaciones'
      ? ['IMAGE_VECTORIZATION'] satisfies AiWorkspaceHistoryKind[]
    : kindParam === 'cotizaciones'
      ? ['LITOGRAFIA_QUOTE'] satisfies AiWorkspaceHistoryKind[]
      : ['LITOGRAFIA_QUOTE', 'IMAGE_GENERATION', 'IMAGE_VECTORIZATION'] satisfies AiWorkspaceHistoryKind[]

  const [allEntries, filteredEntriesSummary, filteredEntriesPage] = await Promise.all([
    queryAiWorkspaceHistory({
      empresaId: user.empresaId,
      limit: 120,
      kinds: ['LITOGRAFIA_QUOTE', 'IMAGE_GENERATION', 'IMAGE_VECTORIZATION'],
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
    queryAiWorkspaceHistoryPage({
      empresaId: user.empresaId,
      kinds: selectedKinds,
      actorUserId: actorUserId || null,
      actorQuery: actorQuery || null,
      promptQuery: promptQuery || null,
      from: from || null,
      to: to || null,
      page,
      pageSize: 10,
    }),
  ])

  const actors = buildActorMap(allEntries)
  const totalEntries = filteredEntriesSummary.length
  const totalQuotes = filteredEntriesSummary.filter((entry) => entry.kind === 'LITOGRAFIA_QUOTE').length
  const totalImages = filteredEntriesSummary.filter((entry) => entry.kind === 'IMAGE_GENERATION').length
  const totalVectorizations = filteredEntriesSummary.filter((entry) => entry.kind === 'IMAGE_VECTORIZATION').length
  const uniqueUsers = new Set(filteredEntriesSummary.map((entry) => entry.actorUserId).filter(Boolean)).size

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

      <div className="grid gap-4 md:grid-cols-5">
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
            <CardDescription>Vectorizaciones IA</CardDescription>
            <CardTitle className="text-3xl text-slate-950">{totalVectorizations}</CardTitle>
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
                <option value="vectorizaciones">Vectorizaciones IA</option>
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
              <CardDescription>Se muestran 10 eventos por página con los filtros actuales. El detalle completo se abre en un modal.</CardDescription>
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
          {filteredEntriesPage.items.length ? (
            <div className="space-y-6">
              <LitografiaAiAuditList entries={filteredEntriesPage.items} />

              <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-slate-500">
                  Página {filteredEntriesPage.page} de {filteredEntriesPage.totalPages} · {filteredEntriesPage.total} eventos
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    className="rounded-xl border-slate-200 bg-white/90"
                    disabled={!filteredEntriesPage.hasPrevious}
                  >
                    <Link href={buildSearchHref({ usuario: actorQuery, usuarioId: actorUserId, tipo: kindParam, desde: from, hasta: to, q: promptQuery, page: String(Math.max(1, filteredEntriesPage.page - 1)) })}>
                      Anterior
                    </Link>
                  </Button>
                  {Array.from({ length: filteredEntriesPage.totalPages }, (_, index) => index + 1)
                    .filter((pageNumber) => Math.abs(pageNumber - filteredEntriesPage.page) <= 2 || pageNumber === 1 || pageNumber === filteredEntriesPage.totalPages)
                    .filter((pageNumber, index, array) => index === 0 || pageNumber !== array[index - 1])
                    .map((pageNumber) => (
                      <Button
                        key={pageNumber}
                        asChild
                        type="button"
                        variant={pageNumber === filteredEntriesPage.page ? 'default' : 'outline'}
                        className={pageNumber === filteredEntriesPage.page ? 'rounded-xl' : 'rounded-xl border-slate-200 bg-white/90'}
                      >
                        <Link href={buildSearchHref({ usuario: actorQuery, usuarioId: actorUserId, tipo: kindParam, desde: from, hasta: to, q: promptQuery, page: String(pageNumber) })}>
                          {pageNumber}
                        </Link>
                      </Button>
                    ))}
                  <Button
                    asChild
                    type="button"
                    variant="outline"
                    className="rounded-xl border-slate-200 bg-white/90"
                    disabled={!filteredEntriesPage.hasNext}
                  >
                    <Link href={buildSearchHref({ usuario: actorQuery, usuarioId: actorUserId, tipo: kindParam, desde: from, hasta: to, q: promptQuery, page: String(Math.min(filteredEntriesPage.totalPages, filteredEntriesPage.page + 1)) })}>
                      Siguiente
                    </Link>
                  </Button>
                </div>
              </div>
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