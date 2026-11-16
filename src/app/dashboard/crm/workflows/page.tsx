import Link from 'next/link'
import { redirect } from 'next/navigation'
import { WorkflowsClient } from '@/components/workflows/workflows-client'
import { auth } from '@/lib/auth'
import { canAccessCapability } from '@/lib/api-rbac'
import { resolveUserIdFromSession } from '@/lib/session-user'

export default async function WorkflowsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const access = await canAccessCapability({
    domain: 'CAPTACION',
    subdomain: 'WORKFLOWS',
    action: 'READ',
    scope: 'SEDE',
  })

  if (!access.ok) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-[28px] border border-rose-200 bg-white p-8 shadow-[0_18px_48px_-30px_rgba(15,23,42,0.25)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-600">Acceso restringido</div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">No puedes entrar a Workflows</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Este espacio solo está disponible para usuarios con permiso para configurar automatizaciones dentro de su empresa y su sede activa.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard" className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800">
              Volver al dashboard
            </Link>
            <Link href="/dashboard/crm/integraciones" className="inline-flex items-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              Ver Automatización
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <WorkflowsClient />
}
