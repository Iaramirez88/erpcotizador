import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Bell, Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MemberActionsMenu } from '@/components/rbac/member-actions-menu'
import { PermissionProfilesManager } from '@/components/rbac/permission-profiles-manager'
import { UserPermissionsModal } from '@/components/rbac/user-permissions-modal'
import { InviteUserCard } from '@/components/users/invite-user-card'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
import { revalidatePath } from 'next/cache'
import { checkPlanLimit } from '@/lib/plan-limits'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { deriveExplicitCapabilityLevel } from '@/lib/dashboard-access'
import { buildUserPermissionSnapshot } from '@/lib/user-permission-snapshot'
import { DASHBOARD_PERMISSION_RULES } from '@/lib/dashboard-permission-catalog'
import { syncEnabledVerticalGrantsForUser } from '@/lib/company-preset-sync'

export const runtime = 'nodejs'

const MODULES: ModuleKey[] = [
  'DASHBOARD',
  'COTIZADOR',
  'COTIZACIONES',
  'CLIENTES',
  'CRM',
  'MATERIALES',
  'INVENTARIO',
  'REMISIONES',
  'POS',
  'PROVEEDORES',
  'COMPRAS',
  'ORDENES',
  'ESCANEOS',
  'REPORTES',
  'CONTABILIDAD',
  'NOTIFICACIONES',
  'CONFIG',
]

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

const USER_TABS = ['sede', 'invite', 'requests', 'users', 'profiles'] as const

type UserTab = (typeof USER_TABS)[number]

function buildUsuariosQuery(params: {
  sedeId?: string | null
  q?: string
  tab?: UserTab
  lastAccessSort?: 'asc' | 'desc'
}) {
  const query = new URLSearchParams()
  if (params.sedeId) query.set('sedeId', params.sedeId)
  if (params.q) query.set('q', params.q)
  if (params.tab) query.set('tab', params.tab)
  if (params.lastAccessSort) query.set('lastAccessSort', params.lastAccessSort)
  const queryString = query.toString()
  return queryString ? `/dashboard/configuracion/usuarios?${queryString}` : '/dashboard/configuracion/usuarios'
}

function fmtDate(value: Date | null | undefined, locale: string, naText: string): string {
  if (!value) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  } catch {
    return String(value)
  }
}

function userRoleKey(role: string) {
  return `rbac.userRole.${role}`
}

function normalizeSearchValue(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function rolePillClass(role: SedeRole) {
  switch (role) {
    case 'ADMIN':
      return 'border-lime-200 bg-lime-50 text-lime-800'
    case 'MANAGER':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'MEMBER':
      return 'border-teal-200 bg-teal-50 text-teal-800'
    case 'READER':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800'
  }
}

function globalAccessPillClass(level: AccessLevel) {
  switch (level) {
    case 'ADMIN':
      return 'border-lime-200 bg-lime-50 text-lime-800'
    case 'WRITE':
      return 'border-teal-200 bg-teal-50 text-teal-800'
    case 'READ':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'NONE':
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

export default async function UsuariosPage({ searchParams }: PageProps) {
  const language = await getServerLanguage()
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars)
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

  const session = await auth()
  if (!session) redirect('/auth/login')

  const empresaId = await requireEmpresaIdForUser(session.user.id)
  await ensureDefaultSedeForEmpresa(empresaId, session.user.id)

  const myAdmin = await prisma.sedeMembership.findFirst({
    where: {
      userId: session.user.id,
      sede: { empresaId },
      role: { in: ['ADMIN', 'MANAGER'] },
    },
    select: { id: true },
  })

  if (session.user.role !== 'ADMIN' && !myAdmin) {
    redirect('/dashboard')
  }

  const sedes = await prisma.sede.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true, codigo: true },
  })

  const requestedSedeIdRaw = searchParams?.sedeId
  const requestedSedeId = typeof requestedSedeIdRaw === 'string' ? requestedSedeIdRaw : ''
  const searchQueryRaw = searchParams?.q
  const searchQuery = typeof searchQueryRaw === 'string' ? searchQueryRaw.trim() : ''
  const tabRaw = typeof searchParams?.tab === 'string' ? searchParams.tab : 'sede'
  const activeTab = (USER_TABS as readonly string[]).includes(tabRaw) ? (tabRaw as UserTab) : 'sede'
  const lastAccessSortRaw = typeof searchParams?.lastAccessSort === 'string' ? searchParams.lastAccessSort : 'desc'
  const lastAccessSort = lastAccessSortRaw === 'asc' ? 'asc' : 'desc'
  const normalizedSearchQuery = normalizeSearchValue(searchQuery)
  const activeSedeId = sedes.some((sede) => sede.id === requestedSedeId) ? requestedSedeId : sedes[0]?.id ?? null
  const activeSede = activeSedeId ? sedes.find((sede) => sede.id === activeSedeId) ?? null : null
  const activeSedeMembership = activeSedeId
    ? await prisma.sedeMembership.findUnique({
        where: { sedeId_userId: { sedeId: activeSedeId, userId: session.user.id } },
        select: { role: true },
      })
    : null
  const canManagePermissionProfiles = session.user.role === 'ADMIN' || activeSedeMembership?.role === 'ADMIN'

  async function approveAccessRequest(formData: FormData) {
    'use server'

    const session2 = await auth()
    if (!session2?.user?.id) return

    const empresaId2 = await requireEmpresaIdForUser(session2.user.id)
    await ensureDefaultSedeForEmpresa(empresaId2, session2.user.id)

    const myAdmin2 = await prisma.sedeMembership.findFirst({
      where: {
        userId: session2.user.id,
        sede: { empresaId: empresaId2 },
        role: { in: ['ADMIN', 'MANAGER'] },
      },
      select: { id: true },
    })

    if (session2.user.role !== 'ADMIN' && !myAdmin2) return

    const requestId = String(formData.get('requestId') ?? '')
    if (!requestId) return

    const req = await prisma.workspaceAccessRequest.findFirst({
      where: { id: requestId, empresaId: empresaId2, status: 'PENDING' },
      select: {
        id: true,
        empresaId: true,
        requesterUserId: true,
        requesterUser: { select: { id: true, email: true, name: true, empresaId: true } },
      },
    })

    if (!req?.id) return

    const requester = req.requesterUser
    const requesterName = (requester?.name || '').trim()
    const requesterEmail = (requester?.email || '').trim().toLowerCase()
    const who = requesterName ? `${requesterName} (${requesterEmail})` : requesterEmail

    const alreadyInEmpresa = requester?.empresaId === empresaId2
    if (!alreadyInEmpresa) {
      const limit = await checkPlanLimit(empresaId2, 'USUARIOS_MAX')
      if (!limit.ok) {
        await prisma.notification.create({
          data: {
            userId: req.requesterUserId,
            empresaId: empresaId2,
            type: 'ERROR',
            title: 'Solicitud de acceso rechazada',
            body: `No se pudo aprobar el acceso a tiempo: ${limit.message || 'límite del plan alcanzado'}.`,
            actionUrl: '/dashboard/configuracion/usuarios',
            actionLabel: 'Ver usuarios',
          },
        })
        await prisma.workspaceAccessRequest.update({
          where: { id: req.id },
          data: { status: 'REJECTED', decidedAt: new Date(), decidedByUserId: session2.user.id },
          select: { id: true },
        })
        revalidatePath('/dashboard/configuracion/usuarios')
        return
      }

      if (requester?.empresaId && requester.empresaId !== empresaId2) {
        const currentEmpresa = await prisma.empresa.findUnique({
          where: { id: requester.empresaId },
          select: { id: true, nit: true },
        })
        const isPersonal = currentEmpresa?.nit === `PERS-${requester.id}`
        if (!isPersonal) {
          await prisma.notification.create({
            data: {
              userId: req.requesterUserId,
              empresaId: empresaId2,
              type: 'ERROR',
              title: 'Solicitud de acceso rechazada',
              body: 'Tu usuario ya pertenece a otra entidad. Pídele a un administrador que te invite por email o revisa tu cuenta actual.',
              actionUrl: '/dashboard/configuracion/usuarios',
              actionLabel: 'Ver usuarios',
            },
          })
          await prisma.workspaceAccessRequest.update({
            where: { id: req.id },
            data: { status: 'REJECTED', decidedAt: new Date(), decidedByUserId: session2.user.id },
            select: { id: true },
          })
          revalidatePath('/dashboard/configuracion/usuarios')
          return
        }
      }

      await prisma.user.update({ where: { id: req.requesterUserId }, data: { empresaId: empresaId2 }, select: { id: true } })
      await ensureDefaultSedeForEmpresa(empresaId2, req.requesterUserId)
      await syncEnabledVerticalGrantsForUser({
        empresaId: empresaId2,
        userId: req.requesterUserId,
        grantedByUserId: session2.user.id,
      })
    }

    await prisma.workspaceAccessRequest.update({
      where: { id: req.id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedByUserId: session2.user.id },
      select: { id: true },
    })

    await prisma.notification.create({
      data: {
        userId: req.requesterUserId,
        empresaId: empresaId2,
        type: 'SUCCESS',
        title: 'Acceso aprobado',
        body: `Tu solicitud fue aprobada. Ya puedes ingresar a este espacio de trabajo.`,
        actionUrl: '/dashboard',
        actionLabel: 'Ir al panel',
      },
    })

    await prisma.notification.create({
      data: {
        userId: session2.user.id,
        empresaId: empresaId2,
        type: 'INFO',
        title: 'Solicitud aprobada',
        body: `Aprobaste el acceso de ${who}.`,
        actionUrl: '/dashboard/configuracion/usuarios',
        actionLabel: 'Ver usuarios',
      },
    })

    revalidatePath('/dashboard/configuracion/usuarios')
  }

  async function rejectAccessRequest(formData: FormData) {
    'use server'

    const session2 = await auth()
    if (!session2?.user?.id) return

    const empresaId2 = await requireEmpresaIdForUser(session2.user.id)
    await ensureDefaultSedeForEmpresa(empresaId2, session2.user.id)

    const myAdmin2 = await prisma.sedeMembership.findFirst({
      where: {
        userId: session2.user.id,
        sede: { empresaId: empresaId2 },
        role: { in: ['ADMIN', 'MANAGER'] },
      },
      select: { id: true },
    })

    if (session2.user.role !== 'ADMIN' && !myAdmin2) return

    const requestId = String(formData.get('requestId') ?? '')
    if (!requestId) return

    const req = await prisma.workspaceAccessRequest.findFirst({
      where: { id: requestId, empresaId: empresaId2, status: 'PENDING' },
      select: {
        id: true,
        requesterUserId: true,
      },
    })

    if (!req?.id) return

    await prisma.workspaceAccessRequest.update({
      where: { id: req.id },
      data: { status: 'REJECTED', decidedAt: new Date(), decidedByUserId: session2.user.id },
      select: { id: true },
    })

    await prisma.notification.create({
      data: {
        userId: req.requesterUserId,
        empresaId: empresaId2,
        type: 'ERROR',
        title: 'Solicitud de acceso rechazada',
        body: 'Un administrador rechazó tu solicitud. Si crees que es un error, solicita una invitación por email.',
        actionUrl: '/dashboard/configuracion/usuarios',
        actionLabel: 'Ver usuarios',
      },
    })

    revalidatePath('/dashboard/configuracion/usuarios')
  }

  const accessRequests = await prisma.workspaceAccessRequest.findMany({
    where: { empresaId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      workspaceCode: true,
      createdAt: true,
      requesterUser: { select: { id: true, email: true, name: true } },
    },
  })

  const allUsers = await prisma.user.findMany({
    where: {
      OR: [
        { empresaId },
        { sedeMemberships: { some: { sede: { empresaId } } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      sedeDefaultId: true,
      sedeDefault: { select: { id: true, nombre: true, codigo: true } },
      sedeMemberships: {
        where: { sede: { empresaId } },
        select: {
          sede: { select: { id: true, nombre: true, codigo: true } },
        },
      },
      createdAt: true,
      lastLoginAt: true,
    },
    take: 1000,
  })

  const users = normalizedSearchQuery
    ? allUsers.filter((user) => {
        const haystack = normalizeSearchValue(`${user.name || ''} ${user.email}`)
        return haystack.includes(normalizedSearchQuery)
      })
    : allUsers

  const {
    membershipByUserId,
    moduleAccessByUserId,
    globalAccessByUserId,
    capabilityAccessByUserId,
    permissionProfileByUserId,
  } = await buildUserPermissionSnapshot({
    empresaId,
    sedeId: activeSedeId,
    userIds: users.map((user) => user.id),
  })

  const usersWithSedeAccess = users.filter((user) => Boolean(membershipByUserId[user.id])).length
  const usersWithoutSedeAccess = users.length - usersWithSedeAccess
  const usersWithGlobalAccess = users.filter((user) => (globalAccessByUserId[user.id] ?? 'NONE') !== 'NONE').length
  const permissionProfiles = activeSedeId
    ? await prisma.permissionProfile.findMany({
        where: { empresaId, sedeId: activeSedeId },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          name: true,
          description: true,
          sedeRole: true,
          globalAccessLevel: true,
          moduleLevels: true,
          capabilityLevels: true,
          createdAt: true,
          createdByUser: { select: { name: true, email: true } },
          _count: { select: { assignments: true } },
        },
      })
    : []
  const sortedUsers = [...users].sort((left, right) => {
    const leftAccessTime = left.lastLoginAt?.getTime() ?? Number.POSITIVE_INFINITY
    const rightAccessTime = right.lastLoginAt?.getTime() ?? Number.POSITIVE_INFINITY
    const accessDiff = lastAccessSort === 'asc' ? leftAccessTime - rightAccessTime : rightAccessTime - leftAccessTime
    if (accessDiff !== 0) return accessDiff

    const leftName = (left.name || left.email).localeCompare(right.name || right.email, locale, { sensitivity: 'base' })
    if (leftName !== 0) return leftName

    return left.email.localeCompare(right.email, locale, { sensitivity: 'base' })
  })

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="Configuracion"
        title={t('rbac.users.title')}
        description={t('rbac.users.subtitle')}
        stats={[
          {
            label: 'Usuarios vinculados',
            value: users.length,
            hint: 'Miembros detectados en la empresa y sus sedes',
            tone: 'sky',
          },
          {
            label: 'Solicitudes pendientes',
            value: accessRequests.length,
            hint: 'Accesos esperando aprobacion o rechazo',
            tone: accessRequests.length ? 'amber' : 'teal',
          },
        ]}
      />

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <TabsTrigger value="sede" className="rounded-xl px-4 py-2.5">Administración por sede</TabsTrigger>
          <TabsTrigger value="invite" className="rounded-xl px-4 py-2.5">Invitar por correo</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl px-4 py-2.5">
            <span className="flex items-center gap-2">
              Solicitudes de acceso
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${accessRequests.length ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                <Bell className="h-3.5 w-3.5" />
                {accessRequests.length}
              </span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="users" className="rounded-xl px-4 py-2.5">Listado de usuarios</TabsTrigger>
          {canManagePermissionProfiles ? <TabsTrigger value="profiles" className="rounded-xl px-4 py-2.5">Reglas de permisos</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="sede">
          <Card>
            <CardHeader>
              <CardTitle>Administración por sede</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="grid gap-3 xl:w-full xl:max-w-4xl xl:grid-cols-[minmax(0,16rem)_minmax(0,20rem)]">
                  <form method="get" className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <input type="hidden" name="q" value={searchQuery} />
                    <input type="hidden" name="tab" value="sede" />
                    <label className="text-sm font-medium">Sede activa para administrar acceso</label>
                    <select name="sedeId" defaultValue={activeSedeId ?? ''} className="border rounded px-3 py-2 bg-white">
                      {sedes.map((sede) => (
                        <option key={sede.id} value={sede.id}>
                          {sede.nombre}{sede.codigo ? ` (${sede.codigo})` : ''}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="secondary" className="w-full">Cambiar sede de trabajo</Button>
                  </form>

                  <form method="get" className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                    <input type="hidden" name="sedeId" value={activeSedeId ?? ''} />
                    <input type="hidden" name="tab" value="sede" />
                    <label className="text-sm font-medium">Buscar usuario</label>
                    <input
                      name="q"
                      defaultValue={searchQuery}
                      placeholder="Busca por nombre o correo"
                      className="border rounded px-3 py-2 bg-white"
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button type="submit">Buscar</Button>
                      {searchQuery ? (
                        <Button asChild type="button" variant="outline">
                          <a href={buildUsuariosQuery({ sedeId: activeSedeId, tab: 'sede' })}>
                            Limpiar
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </form>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[34rem]">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                    <div className="flex items-center gap-2 text-emerald-900">
                      <UserRoundCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.12em]">Con acceso</span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-950">{usersWithSedeAccess}</div>
                    <div className="text-xs text-emerald-800">Usuarios ya vinculados a {activeSede?.nombre ?? 'la sede activa'}.</div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                    <div className="flex items-center gap-2 text-amber-900">
                      <UserRoundX className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.12em]">Sin acceso</span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-amber-950">{usersWithoutSedeAccess}</div>
                    <div className="text-xs text-amber-800">Aún no pertenecen a esta sede.</div>
                  </div>
                  <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-3">
                    <div className="flex items-center gap-2 text-sky-900">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="text-xs font-semibold uppercase tracking-[0.12em]">Global</span>
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-sky-950">{usersWithGlobalAccess}</div>
                    <div className="text-xs text-sky-800">Con permiso general a nivel empresa.</div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                La tabla separa tres conceptos: sede por defecto del perfil, membresía real en la sede activa y permiso general a nivel empresa. Un permiso general no convierte por sí solo al usuario en miembro de la sede activa.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invite">
          <InviteUserCard />
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes de acceso</CardTitle>
            </CardHeader>
            <CardContent>
              {accessRequests.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left">Usuario</th>
                        <th className="py-2 text-left">Email</th>
                        <th className="py-2 text-left">Código</th>
                        <th className="py-2 text-left">Creada</th>
                        <th className="py-2 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessRequests.map((r) => (
                        <tr key={r.id} className="border-b">
                          <td className="py-2">{r.requesterUser.name ?? '—'}</td>
                          <td className="py-2 break-all">{r.requesterUser.email}</td>
                          <td className="py-2 font-mono">{r.workspaceCode ?? '—'}</td>
                          <td className="py-2">{fmtDate(r.createdAt, locale, naText)}</td>
                          <td className="py-2">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <form action={approveAccessRequest}>
                                <input type="hidden" name="requestId" value={r.id} />
                                <Button type="submit" size="sm">Aprobar</Button>
                              </form>
                              <form action={rejectAccessRequest}>
                                <input type="hidden" name="requestId" value={r.id} />
                                <Button type="submit" size="sm" variant="outline">Rechazar</Button>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No hay solicitudes pendientes.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>{t('rbac.users.listTitle', { count: users.length })}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">Ordenar por último acceso</div>
                  <div className="text-xs text-slate-600">Cambia entre el acceso más reciente primero o el más antiguo primero.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant={lastAccessSort === 'desc' ? 'default' : 'outline'}>
                    <a href={buildUsuariosQuery({ sedeId: activeSedeId, q: searchQuery, tab: 'users', lastAccessSort: 'desc' })}>Descendente</a>
                  </Button>
                  <Button asChild size="sm" variant={lastAccessSort === 'asc' ? 'default' : 'outline'}>
                    <a href={buildUsuariosQuery({ sedeId: activeSedeId, q: searchQuery, tab: 'users', lastAccessSort: 'asc' })}>Ascendente</a>
                  </Button>
                </div>
              </div>
              {searchQuery ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Mostrando {users.length} resultado{users.length === 1 ? '' : 's'} para "{searchQuery}".
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">{t('rbac.users.table.user')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.email')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.role')}</th>
                  <th className="py-2 text-left">Sede por defecto</th>
                  <th className="py-2 text-left">{activeSede ? `Membresía en ${activeSede.nombre}` : 'Membresía en sede'}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.created')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.lastLogin')}</th>
                  <th className="py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u) => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2">
                      <div className="flex items-center gap-3">
                        <div className="relative h-8 w-8 overflow-hidden rounded-full border bg-white">
                          {u.image ? (
                            <img src={u.image} alt={u.name ?? u.email} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full grid place-items-center text-xs font-semibold text-slate-700 bg-slate-100">
                              {(u.name ?? u.email).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{u.name ?? naText}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{t(userRoleKey(u.role))}</td>
                    <td className="py-2">
                      {u.sedeDefault ? (
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{u.sedeDefault.nombre}</div>
                          {u.sedeDefault.codigo ? <div className="text-xs text-muted-foreground">{u.sedeDefault.codigo}</div> : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{naText}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {activeSede ? (
                        <div className="space-y-2">
                          {membershipByUserId[u.id] ? (
                            <div className="space-y-1">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${rolePillClass(membershipByUserId[u.id])}`}>
                                Miembro de sede: {t(`rbac.sedeRole.${membershipByUserId[u.id]}`)}
                              </span>
                              <div className="text-xs text-muted-foreground">Asignación directa dentro de {activeSede.nombre}.</div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="font-medium text-amber-700">Sin membresía en sede</div>
                              <div className="text-xs text-muted-foreground">Todavía no pertenece a {activeSede.nombre} aunque tenga permisos generales.</div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 ${globalAccessPillClass(globalAccessByUserId[u.id] ?? 'NONE')}`}>
                              Permiso empresa: {t(`rbac.access.${globalAccessByUserId[u.id] ?? 'NONE'}`)}
                            </span>
                            {permissionProfileByUserId[u.id] ? (
                              <span className="inline-flex rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-fuchsia-800">
                                Regla de sede: {permissionProfileByUserId[u.id].name}
                              </span>
                            ) : null}
                            {u.sedeDefaultId && !membershipByUserId[u.id] && u.sedeDefaultId === activeSede.id ? (
                              <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                                Sede por defecto sin membresía
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{naText}</span>
                      )}
                    </td>
                    <td className="py-2">{fmtDate(u.createdAt, locale, naText)}</td>
                    <td className="py-2">{fmtDate(u.lastLoginAt, locale, naText)}</td>
                    <td className="py-2">
                      {activeSede ? (
                        <div className="flex items-center justify-end gap-2">
                          <UserPermissionsModal
                            sedeId={activeSede.id}
                            sedeNombre={activeSede.nombre}
                            user={{ id: u.id, name: u.name, email: u.email }}
                            initialHasSedeAccess={Boolean(membershipByUserId[u.id])}
                            initialSedeRole={membershipByUserId[u.id] ?? 'READER'}
                            modules={MODULES}
                            initial={moduleAccessByUserId[u.id] ?? {}}
                            initialGlobalAccess={globalAccessByUserId[u.id] ?? 'NONE'}
                            initialCapabilities={capabilityAccessByUserId[u.id] ?? {}}
                            canManagePermissionProfiles={canManagePermissionProfiles}
                            trigger={
                              <Button type="button" size="sm" variant="outline">
                                <Plus className="mr-2 h-4 w-4" />
                                Editar acceso
                              </Button>
                            }
                          />
                          <MemberActionsMenu
                            sedes={u.sedeMemberships.map((membership) => membership.sede)}
                            user={{ id: u.id, name: u.name, email: u.email }}
                            userDefaultSedeId={u.sedeDefaultId}
                            initialGlobalAccess={globalAccessByUserId[u.id] ?? 'NONE'}
                            initialHasSedeAccess={Boolean(membershipByUserId[u.id])}
                            activeSedeId={activeSede.id}
                            activeSedeNombre={activeSede.nombre}
                            initialSedeRole={membershipByUserId[u.id] ?? 'READER'}
                            modules={MODULES}
                            initialAccess={moduleAccessByUserId[u.id] ?? {}}
                            initialCapabilityAccess={capabilityAccessByUserId[u.id] ?? {}}
                            canManagePermissionProfiles={canManagePermissionProfiles}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{naText}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={8}>
                      {t('rbac.users.empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canManagePermissionProfiles ? (
          <TabsContent value="profiles">
            <PermissionProfilesManager
              profiles={permissionProfiles.map((profile) => ({
                id: profile.id,
                name: profile.name,
                description: profile.description,
                sedeRole: profile.sedeRole,
                globalAccessLevel: profile.globalAccessLevel,
                moduleCount: typeof profile.moduleLevels === 'object' && profile.moduleLevels ? Object.keys(profile.moduleLevels as Record<string, unknown>).length : 0,
                capabilityCount: typeof profile.capabilityLevels === 'object' && profile.capabilityLevels ? Object.keys(profile.capabilityLevels as Record<string, unknown>).length : 0,
                createdAt: profile.createdAt.toISOString(),
                createdByLabel: profile.createdByUser?.name || profile.createdByUser?.email || null,
                assignmentCount: profile._count.assignments,
                moduleLevels: typeof profile.moduleLevels === 'object' && profile.moduleLevels ? profile.moduleLevels as Record<string, AccessLevel> : {},
                capabilityLevels: typeof profile.capabilityLevels === 'object' && profile.capabilityLevels ? profile.capabilityLevels as Record<string, { domain: string; subdomain: string; level: AccessLevel; label: string | null }> : {},
              }))}
              users={sortedUsers.map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                hasSedeAccess: Boolean(membershipByUserId[user.id]),
              }))}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
