import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CrmChatbotStudioClient } from '@/components/crm/crm-chatbot-studio-client'
import { auth } from '@/lib/auth'
import { canAccessCapability } from '@/lib/api-rbac'
import { prisma } from '@/lib/prisma'
import { resolveUserIdFromSession } from '@/lib/session-user'

type SearchParams = {
  channelId?: string | string[]
}

export default async function CrmChatbotPanelPage({ searchParams }: { searchParams?: SearchParams | Promise<SearchParams> }) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const access = await canAccessCapability({
    domain: 'CAPTACION',
    subdomain: 'CHANNELS',
    action: 'CONFIGURE',
    scope: 'SEDE',
  })

  if (!access.ok) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-[28px] border border-rose-200 bg-white p-8 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.25)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-600">Acceso restringido</div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">No puedes entrar al Chatbot Studio</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Este espacio solo está disponible para usuarios con permiso para configurar canales CRM dentro de su empresa y su sede activa.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
              Volver al dashboard
            </Link>
            <Link href="/dashboard/crm/integraciones" className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Ver integraciones CRM
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const resolved = searchParams ? await Promise.resolve(searchParams) : undefined
  const requestedChannelId = Array.isArray(resolved?.channelId) ? resolved?.channelId[0] : resolved?.channelId

  const channels = await prisma.crmChannelConnection.findMany({
    where: {
      empresaId: access.empresaId,
      provider: 'WEB_CHATBOT',
      status: { in: ['TESTING', 'ACTIVE'] },
    },
    select: { id: true, name: true },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  })

  if (!channels.length) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-[28px] border border-sky-200 bg-white p-8 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.25)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">Preconfiguración requerida</div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Primero crea un canal de chatbot web</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            El Chatbot Studio no se habilita hasta que exista al menos un canal WEB_CHATBOT configurado para esta empresa. Primero crea el canal en Integraciones y luego vuelve a entrar al Studio.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/crm/integraciones" className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
              Ir a Integraciones CRM
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const initialChannelId = channels.some((channel) => channel.id === requestedChannelId)
    ? requestedChannelId
    : channels[0]?.id

  return <CrmChatbotStudioClient initialChannelId={initialChannelId ?? ''} />
}