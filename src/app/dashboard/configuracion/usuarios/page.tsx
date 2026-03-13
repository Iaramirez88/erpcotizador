import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InviteUserCard } from '@/components/users/invite-user-card'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
import { revalidatePath } from 'next/cache'
import { checkPlanLimit } from '@/lib/plan-limits'

export const runtime = 'nodejs'

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

export default async function UsuariosPage() {
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
      },
    })

    await prisma.notification.create({
      data: {
        userId: session2.user.id,
        empresaId: empresaId2,
        type: 'INFO',
        title: 'Solicitud aprobada',
        body: `Aprobaste el acceso de ${who}.`,
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

  const users = await prisma.user.findMany({
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
      createdAt: true,
      lastLoginAt: true,
    },
    take: 1000,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('rbac.users.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('rbac.users.subtitle')}</p>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">{t('rbac.users.table.user')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.email')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.role')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.created')}</th>
                  <th className="py-2 text-left">{t('rbac.users.table.lastLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
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
                        </div>
                      </div>
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{t(userRoleKey(u.role))}</td>
                    <td className="py-2">{fmtDate(u.createdAt, locale, naText)}</td>
                    <td className="py-2">{fmtDate(u.lastLoginAt, locale, naText)}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
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
