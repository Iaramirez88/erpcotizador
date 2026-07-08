import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModuleKey, AccessLevel, SedeRole } from '@prisma/client'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'
import { MemberActionsMenu } from '@/components/rbac/member-actions-menu'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

const ACCESS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']
const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']
const SEDE_ROLES_UI: SedeRole[] = ['ADMIN', 'MANAGER', 'READER']

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined }
}

export default async function PermisosPage({ searchParams }: PageProps) {
  const language = await getServerLanguage()
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars)
  const naText = t('common.na')

  const sedeRoleLabel = (role: SedeRole) => t(`rbac.sedeRole.${role}`)
  const accessLabel = (level: AccessLevel) => t(`rbac.access.${level}`)
  const moduleLabel = (moduleKey: ModuleKey) => t(`rbac.module.${moduleKey}`)

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
  const activeSedeId = sedes.some((s) => s.id === requestedSedeId) ? requestedSedeId : sedes[0]?.id

  async function addMember(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return
    const sedeId = String(formData.get('sedeId') || '')
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const role = String(formData.get('role') || 'READER') as SedeRole

    if (!sedeId || !email) return
    if (!SEDE_ROLES.includes(role)) return

    const empresaId2 = await requireEmpresaIdForUser(session2.user.id)
    const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
    if (!sede || sede.empresaId !== empresaId2) return

    const admin = await prisma.sedeMembership.findUnique({
      where: { sedeId_userId: { sedeId, userId: session2.user.id } },
      select: { role: true },
    })
    if (session2.user.role !== 'ADMIN' && admin?.role !== 'ADMIN' && admin?.role !== 'MANAGER') return

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return

    await prisma.sedeMembership.upsert({
      where: { sedeId_userId: { sedeId, userId: user.id } },
      create: { sedeId, userId: user.id, role },
      update: { role },
    })
  }


  async function setGlobalAccess(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const email = String(formData.get('email') || '').trim().toLowerCase()
    const level = String(formData.get('level') || '') as AccessLevel

    if (!email) return
    if (!ACCESS.includes(level)) return

    const empresaId2 = await requireEmpresaIdForUser(session2.user.id)

    const anyAdmin2 =
      session2.user.role === 'ADMIN' ||
      !!(await prisma.sedeMembership.findFirst({
        where: {
          userId: session2.user.id,
          sede: { empresaId: empresaId2 },
          role: { in: ['ADMIN', 'MANAGER'] },
        },
        select: { id: true },
      }))

    if (!anyAdmin2) return

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return

    if (level === 'NONE') {
      await prisma.userGlobalAccess.delete({ where: { userId: user.id } }).catch(() => null)

      await prisma.notification.create({
        data: {
          userId: user.id,
          type: 'INFO',
          title: 'Permisos actualizados',
          body: 'Tu acceso global fue desactivado.',
          empresaId: empresaId2,
          actionUrl: '/dashboard/configuracion/permisos',
          actionLabel: 'Ver permisos',
        },
      })
      return
    }

    await prisma.userGlobalAccess.upsert({
      where: { userId: user.id },
      create: { userId: user.id, empresaId: empresaId2, level },
      update: { level },
    })

    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'INFO',
        title: 'Permisos actualizados',
        body: `Tu acceso global fue actualizado a ${level}.`,
        empresaId: empresaId2,
        actionUrl: '/dashboard/configuracion/permisos',
        actionLabel: 'Ver permisos',
      },
    })
  }

  const activeSede = activeSedeId
    ? await prisma.sede.findUnique({
        where: { id: activeSedeId },
        select: { id: true, nombre: true },
      })
    : null

  const members = activeSedeId
    ? await prisma.sedeMembership.findMany({
        where: { sedeId: activeSedeId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, user: { select: { id: true, email: true, name: true, sedeDefaultId: true } } },
      })
    : []

  const permisos = activeSedeId
    ? await prisma.userModuleAccess.findMany({
        where: { sedeId: activeSedeId },
        orderBy: [{ userId: 'asc' }, { module: 'asc' }],
        select: { id: true, userId: true, module: true, level: true, user: { select: { email: true, name: true } } },
      })
    : []

  const accessByUserId: Record<string, Partial<Record<ModuleKey, AccessLevel>>> = {}
  for (const p of permisos) {
    if (!accessByUserId[p.userId]) accessByUserId[p.userId] = {}
    accessByUserId[p.userId][p.module] = p.level
  }

  const globalAccess = await prisma.userGlobalAccess.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, level: true, user: { select: { id: true, email: true, name: true } } },
  })

  const globalAccessByUserId: Partial<Record<string, AccessLevel>> = {}
  for (const access of globalAccess) {
    globalAccessByUserId[access.user.id] = access.level
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="Configuracion"
        title={t('rbac.permissions.title')}
        description={t('rbac.permissions.subtitle')}
        stats={[
          {
            label: 'Sede activa',
            value: activeSede?.nombre ?? naText,
            hint: 'Contexto actual para miembros y modulos',
            tone: 'sky',
          },
          {
            label: 'Miembros visibles',
            value: members.length,
            hint: 'Usuarios asociados a la sede seleccionada',
            tone: 'teal',
          },
          {
            label: 'Accesos globales',
            value: globalAccess.length,
            hint: 'Registros globales a nivel empresa',
            tone: 'amber',
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('rbac.membersAndPermissions.title', { sede: activeSede?.nombre ?? naText })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" className="grid gap-2 max-w-lg">
            <label className="text-sm font-medium">{t('rbac.common.sedeLabel')}</label>
            <select name="sedeId" defaultValue={activeSedeId ?? ''} className="border rounded px-3 py-2">
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">{t('common.view')}</Button>
          </form>

          <form action={addMember} className="grid gap-2 max-w-lg">
            <select name="sedeId" className="border rounded px-3 py-2" defaultValue={activeSedeId ?? ''}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
                </option>
              ))}
            </select>
            <input name="email" placeholder={t('rbac.common.emailPlaceholder')} className="border rounded px-3 py-2" />
            <select name="role" className="border rounded px-3 py-2">
              {SEDE_ROLES_UI.map((r) => (
                <option key={r} value={r}>
                  {sedeRoleLabel(r)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">{t('rbac.members.addOrUpdate')}</Button>
          </form>

          <div className="grid gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{m.user.name ?? m.user.email}</div>
                  <div className="text-xs text-muted-foreground">{m.user.email}</div>
                </div>
                {activeSedeId && activeSede?.nombre ? (
                  <MemberActionsMenu
                    sedes={sedes}
                    user={{ id: m.user.id, email: m.user.email, name: m.user.name ?? null }}
                    userDefaultSedeId={m.user.sedeDefaultId ?? null}
                    activeSedeId={activeSedeId}
                    activeSedeNombre={activeSede.nombre}
                    initialSedeRole={m.role}
                    initialGlobalAccess={globalAccessByUserId[m.user.id] ?? 'NONE'}
                    modules={MODULES}
                    initialAccess={accessByUserId[m.user.id] ?? {}}
                  />
                ) : null}
              </div>
            ))}
            {members.length === 0 && <div className="text-sm text-muted-foreground">{t('rbac.members.empty')}</div>}
          </div>

          <div className="text-xs text-muted-foreground">
            {t('rbac.members.note', { sede: activeSede?.nombre ?? naText })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('rbac.globalAccess.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={setGlobalAccess} className="grid gap-2 max-w-lg">
            <input name="email" placeholder={t('rbac.common.emailPlaceholder')} className="border rounded px-3 py-2" />
            <select name="level" className="border rounded px-3 py-2">
              {ACCESS.map((l) => (
                <option key={l} value={l}>
                  {accessLabel(l)}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">{t('rbac.globalAccess.save')}</Button>
            <div className="text-xs text-muted-foreground">
              {t('rbac.globalAccess.note')}
            </div>
          </form>

          <div className="grid gap-2">
            {globalAccess.map((ga) => (
              <div key={ga.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{ga.user.name ?? ga.user.email}</div>
                  <div className="text-xs text-muted-foreground">{ga.user.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm">{accessLabel(ga.level)}</div>
                  <form action={setGlobalAccess}>
                    <input type="hidden" name="email" value={ga.user.email} />
                    <input type="hidden" name="level" value="NONE" />
                    <Button type="submit" variant="outline" size="sm">{t('rbac.globalAccess.remove')}</Button>
                  </form>
                </div>
              </div>
            ))}
            {globalAccess.length === 0 && (
              <div className="text-sm text-muted-foreground">{t('rbac.globalAccess.empty')}</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
