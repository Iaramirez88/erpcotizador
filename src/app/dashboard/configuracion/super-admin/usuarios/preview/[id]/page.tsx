import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { prisma } from '@/lib/prisma'
import { getActiveSedeForUser } from '@/lib/rbac'
import { buildAllowedDashboardHrefsForUser, buildAllowedDashboardPermissionKeysForUser } from '@/lib/dashboard-access'
import { buildUserPermissionSnapshot } from '@/lib/user-permission-snapshot'
import { DASHBOARD_NAV_CATALOG } from '@/lib/product-architecture'
import Link from 'next/link'

function hrefLabelMap() {
  return new Map(DASHBOARD_NAV_CATALOG.map((item) => [item.href, item.label]))
}

export default async function SuperAdminUserPreviewPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.email || !isSuperAdminEmail(session.user.email)) {
    redirect('/dashboard')
  }

  const { id } = await props.params
  const userId = (id ?? '').trim()
  if (!userId) redirect('/dashboard/configuracion/super-admin/usuarios')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      empresaId: true,
      sedeDefaultId: true,
      empresa: { select: { id: true, nombre: true, nit: true } },
    },
  })

  if (!user?.id || !user.empresaId || !user.empresa?.id) {
    redirect('/dashboard/configuracion/super-admin/usuarios')
  }

  const activeSede = await getActiveSedeForUser(user.id)
  const [allowedHrefs, permissionKeys, snapshot] = await Promise.all([
    buildAllowedDashboardHrefsForUser({
      userId: user.id,
      empresaId: user.empresaId,
      sedeId: activeSede.id,
    }),
    buildAllowedDashboardPermissionKeysForUser({
      userId: user.id,
      empresaId: user.empresaId,
      sedeId: activeSede.id,
    }),
    buildUserPermissionSnapshot({
      empresaId: user.empresaId,
      sedeId: activeSede.id,
      userIds: [user.id],
    }),
  ])

  const hrefLabels = hrefLabelMap()
  const allowedEntries = allowedHrefs.map((href) => ({
    href,
    label: hrefLabels.get(href) ?? href,
  }))
  const explicitModuleAccess = snapshot.moduleAccessByUserId[user.id] ?? {}
  const explicitCapabilityAccess = snapshot.capabilityAccessByUserId[user.id] ?? {}
  const membershipRole = snapshot.membershipByUserId[user.id] ?? null
  const globalAccessLevel = snapshot.globalAccessByUserId[user.id] ?? 'NONE'
  const permissionProfile = snapshot.permissionProfileByUserId[user.id] ?? null

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">Vista previa de permisos</div>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Ver como usuario</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Esta ventana usa la misma resolución central de permisos, rutas permitidas y sede activa del usuario objetivo. No cambia tu sesión de superadmin.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-slate-900">{user.name ?? user.email}</div>
            <div>{user.email}</div>
            <div className="mt-2">Empresa: {user.empresa.nombre}</div>
            <div>Sede activa: {activeSede.nombre}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Rol sede</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{membershipRole ?? 'Sin acceso'}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Permiso general</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{globalAccessLevel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Regla aplicada</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{permissionProfile?.name ?? 'Sin regla'}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Rutas visibles</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{allowedEntries.length}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-950">Navegación permitida</div>
              <div className="text-sm text-slate-600">Resultado efectivo de allowed hrefs para este usuario.</div>
            </div>
            <Link href="/dashboard/configuracion/super-admin/usuarios" className="text-sm font-medium text-sky-700 underline underline-offset-4">
              Volver a superadmin
            </Link>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {allowedEntries.map((entry) => (
              <div key={entry.href} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-medium text-slate-950">{entry.label}</div>
                <div className="mt-1 text-xs text-slate-500">{entry.href}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">Overrides explícitos por módulo</div>
            <div className="mt-1 text-sm text-slate-600">Solo muestra niveles manuales, no la herencia base.</div>
            <div className="mt-4 space-y-2">
              {Object.entries(explicitModuleAccess).length ? Object.entries(explicitModuleAccess).map(([moduleKey, level]) => (
                <div key={moduleKey} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-900">{moduleKey}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{level}</span>
                </div>
              )) : <div className="text-sm text-slate-500">No hay overrides explícitos por módulo en la sede activa.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold text-slate-950">Capacidades explícitas</div>
            <div className="mt-1 text-sm text-slate-600">Claves efectivas derivadas del mismo catálogo central.</div>
            <div className="mt-4 flex flex-wrap gap-2">
              {permissionKeys.map((key) => (
                <span key={key} className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                  {key}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              Overrides explícitos de capacidades: {Object.keys(explicitCapabilityAccess).length}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}