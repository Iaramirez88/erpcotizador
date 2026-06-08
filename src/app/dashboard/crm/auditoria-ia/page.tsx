import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bot, CalendarClock, UserRound } from 'lucide-react'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { auth } from '@/lib/auth'
import { queryAiWorkspaceHistory, type AiWorkspaceHistoryEntry } from '@/lib/ai-workspace-history'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function takeParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function buildActorOptions(entries: AiWorkspaceHistoryEntry[]) {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const actorUserId = entry.actorUserId?.trim()
    if (!actorUserId) continue
    if (!map.has(actorUserId)) map.set(actorUserId, entry.actorLabel?.trim() || actorUserId)
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

function buildConversationOptions(entries: AiWorkspaceHistoryEntry[]) {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const metadata = asRecord(entry.metadata)
    const conversationId = typeof metadata?.conversationId === 'string' ? metadata.conversationId : ''
    if (!conversationId) continue
    const label = (entry.summary || entry.prompt || conversationId).replace(/\s+/g, ' ').trim().slice(0, 96)
    if (!map.has(conversationId)) map.set(conversationId, label)
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

export default async function CrmAiAuditPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { empresaId: true } })
  if (!user?.empresaId) redirect('/dashboard/crm/conversations')

  const params = await searchParams
  const actorUserId = takeParam(params?.usuarioId)
  const actorQuery = takeParam(params?.usuario)
  const conversationId = takeParam(params?.conversationId)
  const from = takeParam(params?.desde)
  const to = takeParam(params?.hasta)
  const promptQuery = takeParam(params?.q)

  const baseEntries = await queryAiWorkspaceHistory({
    empresaId: user.empresaId,
    limit: 120,
    kinds: ['CRM_CONVERSATION_COPILOT'],
    actorUserId: actorUserId || null,
    actorQuery: actorQuery || null,
    promptQuery: promptQuery || null,
    from: from || null,
    to: to || null,
  })

  const allEntries = actorUserId || actorQuery || promptQuery || from || to
    ? await queryAiWorkspaceHistory({
        empresaId: user.empresaId,
        limit: 120,
        kinds: ['CRM_CONVERSATION_COPILOT'],
      })
    : baseEntries

  const filteredEntries = baseEntries.filter((entry) => {
    if (!conversationId) return true
    const metadata = asRecord(entry.metadata)
    return metadata?.conversationId === conversationId
  })

  const actorOptions = buildActorOptions(allEntries)
  const conversationOptions = buildConversationOptions(allEntries)
  const totalConversations = new Set(filteredEntries.map((entry) => asRecord(entry.metadata)?.conversationId).filter((value): value is string => typeof value === 'string' && value.length > 0)).size
  const totalActors = new Set(filteredEntries.map((entry) => entry.actorUserId).filter((value): value is string => typeof value === 'string' && value.length > 0)).size

  return (
    <div className="space-y-6 pb-6">
      <ErpPageHero
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Auditoría IA' },
        ]}
        title="Auditoría IA CRM"
        description="Consulta el historial del copiloto comercial por conversación, usuario y fecha sobre el inbox CRM."
        actions={
          <Button asChild variant="outline" className="rounded-2xl border-slate-200 bg-white/90">
            <Link href="/dashboard/crm/conversations">Volver al inbox</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2"><CardDescription>Eventos IA</CardDescription><CardTitle className="text-3xl text-slate-950">{filteredEntries.length}</CardTitle></CardHeader>
        </Card>
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2"><CardDescription>Conversaciones</CardDescription><CardTitle className="text-3xl text-slate-950">{totalConversations}</CardTitle></CardHeader>
        </Card>
        <Card className="rounded-[24px] border-slate-200">
          <CardHeader className="pb-2"><CardDescription>Usuarios</CardDescription><CardTitle className="text-3xl text-slate-950">{totalActors}</CardTitle></CardHeader>
        </Card>
      </div>

      <Card className="rounded-[28px] border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardTitle className="text-2xl text-slate-950">Filtros</CardTitle>
          <CardDescription>Acota el historial por usuario, conversación, fecha o texto libre.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form method="GET" className="grid gap-4 lg:grid-cols-6">
            <div className="space-y-2 lg:col-span-2">
              <label htmlFor="usuario" className="text-sm font-medium text-slate-700">Usuario</label>
              <Input id="usuario" name="usuario" defaultValue={actorQuery} className="rounded-xl" placeholder="Nombre o correo" />
            </div>
            <div className="space-y-2">
              <label htmlFor="usuarioId" className="text-sm font-medium text-slate-700">Usuario exacto</label>
              <select id="usuarioId" name="usuarioId" defaultValue={actorUserId} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none">
                <option value="">Todos</option>
                {actorOptions.map((actor) => <option key={actor.id} value={actor.id}>{actor.label}</option>)}
              </select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label htmlFor="conversationId" className="text-sm font-medium text-slate-700">Conversación</label>
              <select id="conversationId" name="conversationId" defaultValue={conversationId} className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none">
                <option value="">Todas</option>
                {conversationOptions.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.label}</option>)}
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
              <Input id="q" name="q" defaultValue={promptQuery} className="rounded-xl" placeholder="Buscar en resumen, prompt o respuesta sugerida" />
            </div>
            <div className="flex items-end gap-3 lg:col-span-2">
              <Button type="submit" className="rounded-xl">Aplicar filtros</Button>
              <Button asChild type="button" variant="outline" className="rounded-xl border-slate-200 bg-white/90">
                <Link href="/dashboard/crm/auditoria-ia">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border-slate-200">
        <CardHeader className="border-b border-slate-100 pb-5">
          <CardTitle className="text-2xl text-slate-950">Historial</CardTitle>
          <CardDescription>Eventos recientes del copiloto comercial guardados para auditoría y trazabilidad.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {filteredEntries.length ? (
            <div className="space-y-4">
              {filteredEntries.map((entry) => {
                const metadata = asRecord(entry.metadata)
                const entryConversationId = typeof metadata?.conversationId === 'string' ? metadata.conversationId : ''
                const nextActions = Array.isArray(metadata?.nextActions) ? metadata.nextActions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
                const conversationStatus = typeof metadata?.conversationStatus === 'string' ? metadata.conversationStatus : '—'
                const leadStatus = typeof metadata?.leadStatus === 'string' ? metadata.leadStatus : ''
                const opportunityStage = typeof metadata?.opportunityStage === 'string' ? metadata.opportunityStage : ''
                const eventType = typeof metadata?.eventType === 'string' ? metadata.eventType : 'SUGGESTION'
                const taskSuggestionAction = typeof metadata?.taskSuggestionAction === 'string' ? metadata.taskSuggestionAction : ''
                const changedTaskFields = Array.isArray(metadata?.changedTaskFields) ? metadata.changedTaskFields.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
                const taskTitle = typeof metadata?.taskTitle === 'string' ? metadata.taskTitle : ''
                return (
                  <div key={entry.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"><Bot className="h-3.5 w-3.5" /> Copiloto CRM</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">{eventType === 'TASK_SUGGESTION_ACTION' ? (taskSuggestionAction === 'EDITED' ? 'Tarea IA editada' : 'Tarea IA aceptada') : 'Sugerencia IA'}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700"><CalendarClock className="h-3.5 w-3.5" /> {formatDateTime(entry.createdAt)}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700"><UserRound className="h-3.5 w-3.5" /> {entry.actorLabel || entry.actorUserId || 'Sin actor'}</span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Conversación: {entryConversationId || '—'} · Estado: {conversationStatus}
                          {leadStatus ? ` · Lead ${leadStatus}` : ''}
                          {opportunityStage ? ` · Oportunidad ${opportunityStage}` : ''}
                        </p>
                      </div>
                      {entryConversationId ? (
                        <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-white/90">
                          <Link href={`/dashboard/crm/conversations?conversationId=${entryConversationId}`}>Abrir conversación</Link>
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resumen</p>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{entry.summary || 'Sin resumen guardado.'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Respuesta sugerida</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{entry.responseText || 'Sin respuesta sugerida guardada.'}</p>
                      </div>
                    </div>

                    {nextActions.length ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Siguientes pasos</p>
                        <div className="mt-2 space-y-2">
                          {nextActions.map((action) => (
                            <div key={action} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">{action}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {eventType === 'TASK_SUGGESTION_ACTION' ? (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Resultado de la tarea sugerida</p>
                        <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Tarea: {taskTitle || 'Sin título'}</div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">Acción: {taskSuggestionAction === 'EDITED' ? 'Editada antes de crear' : 'Aceptada sin cambios'}</div>
                        </div>
                        {changedTaskFields.length ? (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Campos ajustados</p>
                            <div className="flex flex-wrap gap-2">
                              {changedTaskFields.map((field) => <span key={field} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{field}</span>)}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
              No hay sugerencias IA CRM con los filtros actuales.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}