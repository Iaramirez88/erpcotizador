import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MemberActionsMenu } from '@/components/rbac/member-actions-menu'
import { UserPermissionsModal } from '@/components/rbac/user-permissions-modal'
import { InviteUserCard } from '@/components/users/invite-user-card'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
import { revalidatePath } from 'next/cache'
import { checkPlanLimit } from '@/lib/plan-limits'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { deriveExplicitCapabilityLevel } from '@/lib/dashboard-access'
import { DASHBOARD_PERMISSION_RULES } from '@/lib/dashboard-permission-catalog'

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
  const normalizedSearchQuery = normalizeSearchValue(searchQuery)
  const activeSedeId = sedes.some((sede) => sede.id === requestedSedeId) ? requestedSedeId : sedes[0]?.id ?? null
  const activeSede = activeSedeId ? sedes.find((sede) => sede.id === activeSedeId) ?? null : null

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

  const memberships = activeSedeId
    ? await prisma.sedeMembership.findMany({
        where: { sedeId: activeSedeId, userId: { in: users.map((user) => user.id) } },
        select: { userId: true, role: true },
      })
    : []

  const membershipByUserId: Record<string, SedeRole> = {}
  for (const membership of memberships) {
    membershipByUserId[membership.userId] = membership.role
  }

  const moduleAccessRows = activeSedeId
    ? await prisma.userModuleAccess.findMany({
        where: { sedeId: activeSedeId, userId: { in: users.map((user) => user.id) } },
        orderBy: [{ userId: 'asc' }, { module: 'asc' }],
        select: { userId: true, module: true, level: true },
      })
    : []

  const moduleAccessByUserId: Record<string, Partial<Record<ModuleKey, AccessLevel>>> = {}
  for (const row of moduleAccessRows) {
    if (!moduleAccessByUserId[row.userId]) moduleAccessByUserId[row.userId] = {}
    moduleAccessByUserId[row.userId][row.module] = row.level
  }

  const globalAccessRows = await prisma.userGlobalAccess.findMany({
    where: { empresaId, userId: { in: users.map((user) => user.id) } },
    select: { userId: true, level: true },
  })

  const globalAccessByUserId: Partial<Record<string, AccessLevel>> = {}
  for (const row of globalAccessRows) {
    globalAccessByUserId[row.userId] = row.level
  }

  const capabilityGrantRows = activeSedeId
    ? await prisma.userCapabilityGrant.findMany({
        where: {
          empresaId,
          scopeType: 'SEDE',
          scopeValue: activeSedeId,
          userId: { in: users.map((user) => user.id) },
          source: 'DIRECT',
        },
        select: {
          userId: true,
          domain: true,
          subdomain: true,
          action: true,
          allowed: true,
        },
      })
    : []

  const capabilityAccessByUserId: Record<string, Record<string, AccessLevel>> = {}
  for (const user of users) {
    capabilityAccessByUserId[user.id] = {}
  }
  for (const rule of DASHBOARD_PERMISSION_RULES) {
    const capability = rule.capabilities[0]
    if (!capability) continue
    for (const user of users) {
      const rows = capabilityGrantRows.filter(
        (grant) => grant.userId === user.id && grant.domain === capability.domain && grant.subdomain === capability.subdomain
      )
      const level = deriveExplicitCapabilityLevel({
        domain: capability.domain,
        subdomain: capability.subdomain,
        grants: rows,
      })
      if (level) {
        capabilityAccessByUserId[user.id][rule.key] = level
      }
    }
  }

  const usersWithSedeAccess = users.filter((user) => Boolean(membershipByUserId[user.id])).length
  const usersWithoutSedeAccess = users.length - usersWithSedeAccess
  const usersWithGlobalAccess = users.filter((user) => (globalAccessByUserId[user.id] ?? 'NONE') !== 'NONE').length
  const sortedUsers = [...users].sort((left, right) => {
    const leftHasAccess = Boolean(membershipByUserId[left.id])
    const rightHasAccess = Boolean(membershipByUserId[right.id])

    if (leftHasAccess !== rightHasAccess) {
      return leftHasAccess ? 1 : -1
    }

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

      <Card>
        <CardHeader>
          <CardTitle>Administración por sede</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-4 lg:w-full lg:max-w-3xl lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
              <form method="get" className="grid gap-2">
                <input type="hidden" name="q" value={searchQuery} />
                <label className="text-sm font-medium">Sede activa para administrar acceso</label>
                <select name="sedeId" defaultValue={activeSedeId ?? ''} className="border rounded px-3 py-2">
                  {sedes.map((sede) => (
                    <option key={sede.id} value={sede.id}>
                      {sede.nombre}{sede.codigo ? ` (${sede.codigo})` : ''}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary">Cambiar sede de trabajo</Button>
              </form>

              <form method="get" className="grid gap-2">
                <input type="hidden" name="sedeId" value={activeSedeId ?? ''} />
                <label className="text-sm font-medium">Buscar usuario</label>
                <input
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="Busca por nombre o correo"
                  className="border rounded px-3 py-2"
                />
                <div className="flex items-center gap-2">
                  <Button type="submit">Buscar</Button>
                  {searchQuery ? (
                    <Button asChild type="button" variant="outline">
                      <a href={activeSedeId ? `/dashboard/configuracion/usuarios?sedeId=${encodeURIComponent(activeSedeId)}` : '/dashboard/configuracion/usuarios'}>
                        Limpiar
                      </a>
                    </Button>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[34rem]">
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
            La lista prioriza primero a quienes todavía no tienen acceso en la sede activa. Usa el buscador para encontrar un usuario por nombre o correo y luego asignar o ajustar su acceso sin cambiar de pantalla.
          </p>
        </CardContent>
      </Card>

      <InviteUserCard />

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

      <Card>
        <CardHeader>
          <CardTitle>{t('rbac.users.listTitle', { count: users.length })}</CardTitle>
        </CardHeader>
        <CardContent>
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
                  <th className="py-2 text-left">{activeSede ? `Acceso en ${activeSede.nombre}` : 'Acceso en sede'}</th>
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
                          <div className="text-xs text-muted-foreground">{u.id}</div>
                          {u.sedeDefaultId ? <div className="text-[11px] text-slate-500">Tiene sede predeterminada asignada</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{t(userRoleKey(u.role))}</td>
                    <td className="py-2">
                      {activeSede ? (
                        membershipByUserId[u.id] ? (
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${rolePillClass(membershipByUserId[u.id])}`}>
                              {t(`rbac.sedeRole.${membershipByUserId[u.id]}`)}
                            </span>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 ${globalAccessPillClass(globalAccessByUserId[u.id] ?? 'NONE')}`}>
                                General: {t(`rbac.access.${globalAccessByUserId[u.id] ?? 'NONE'}`)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-medium text-amber-700">Sin acceso</div>
                            <div className="text-xs text-muted-foreground">Todavía no pertenece a {activeSede.nombre}</div>
                          </div>
                        )
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
                            trigger={
                              <Button type="button" size="sm" variant={membershipByUserId[u.id] ? 'outline' : 'default'}>
                                <Plus className="mr-2 h-4 w-4" />
                                {membershipByUserId[u.id] ? 'Editar acceso' : 'Dar acceso'}
                              </Button>
                            }
                          />
                          <MemberActionsMenu
                            sedes={sedes}
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
                    <td className="py-6 text-center text-muted-foreground" colSpan={7}>
                      {t('rbac.users.empty')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
