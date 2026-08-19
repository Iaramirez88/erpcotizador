import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPlanOwnerForEmpresa } from '@/lib/plan-owner'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AvatarUploader } from '@/components/profile/avatar-uploader'
import { ProfileBasicsForm } from '@/components/profile/profile-basics-form'
import { ProfilePreferencesCard } from '@/components/profile/profile-preferences-card'
import { LeaveWorkspaceCard } from '@/components/profile/leave-workspace-card'
import { WorkspaceAccessCard } from '@/components/profile/workspace-access-card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate, type UiLanguage } from '@/lib/i18n/messages'
import { resolveUserIdFromSession } from '@/lib/session-user'
import { getCrmStorageUsageSummary } from '@/lib/crm-files'
import { cn } from '@/lib/utils'

function fmtDate(date: Date | null | undefined, locale: string, naText: string) {
  if (!date) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
  } catch {
    return String(date)
  }
}

function makeT(language: UiLanguage) {
  return (key: string, vars?: Record<string, string>) => translate(language, key, vars)
}

function tOrFallback(t: (key: string, vars?: Record<string, string>) => string, key: string, fallback: string) {
  const value = t(key)
  return value === key ? fallback : value
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const size = value / 1024 ** exponent
  return `${size >= 100 || exponent === 0 ? Math.round(size) : size.toFixed(1)} ${units[exponent]}`
}

function getStorageLevel(percentage: number) {
  if (percentage >= 95) return 'critical'
  if (percentage >= 80) return 'warning'
  return 'normal'
}

export default async function PerfilPage() {
  const language = await getServerLanguage()
  const t = makeT(language)
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const userId = await resolveUserIdFromSession(session)
  if (!userId) redirect('/auth/login')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      image: true,
      telefono: true,
      cargo: true,
      sedeDefaultId: true,
      sedeDefault: { select: { id: true, nombre: true, codigo: true } },
      createdAt: true,
      updatedAt: true,
      empresa: { select: { id: true, nombre: true, planTier: true, billingCycle: true, planValidUntil: true } },
      sedeMemberships: { select: { id: true, role: true, createdAt: true, sede: { select: { id: true, nombre: true, codigo: true } } } },
      moduleAccess: { select: { id: true, module: true, level: true, sede: { select: { id: true, nombre: true } } } },
    },
  })

  if (!user) redirect('/auth/login')

  const companySedes = user.empresa?.id
    ? await prisma.sede.findMany({
        where: { empresaId: user.empresa.id },
        orderBy: [{ nombre: 'asc' }],
        select: { id: true, nombre: true, codigo: true },
      })
    : []

  const assignedSedes = Array.from(
    new Map(
      [...user.sedeMemberships.map((membership) => membership.sede), ...(user.sedeDefault ? [user.sedeDefault] : [])]
        .filter((sede): sede is { id: string; nombre: string; codigo: string | null } => Boolean(sede?.id))
        .map((sede) => [sede.id, sede])
    ).values()
  )

  const requestableSedes = companySedes.filter((sede) => !assignedSedes.some((assigned) => assigned.id === sede.id))
  const assignedSedeRoleById = new Map(user.sedeMemberships.map((membership) => [membership.sede.id, membership.role]))

  const [recentPasswordResets, recentEmailVerifications] = await Promise.all([
    prisma.passwordResetToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, email: true, createdAt: true, expiresAt: true },
    }),
    prisma.emailVerificationCode.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, email: true, createdAt: true, expiresAt: true },
    }),
  ])

  const empresaId = user.empresa?.id ?? null
  const isSystemSuperAdmin = isSuperAdminEmail(user.email)
  const isPlanOwner = empresaId ? await isPlanOwnerForEmpresa({ empresaId, userId: user.id }) : false
    const storageUsage = empresaId ? await getCrmStorageUsageSummary({ empresaId }) : null
    const storagePct = storageUsage?.totalBytes ? Math.min(100, Math.round((storageUsage.usedBytes / storageUsage.totalBytes) * 100)) : 0
  const storageLevel = getStorageLevel(storagePct)
  const canManageBilling = isSystemSuperAdmin || isPlanOwner

  const roleLabel = (role?: string | null) => tOrFallback(t, `rbac.userRole.${role || 'USER'}`, String(role || 'USER'))
  const sedeRoleLabel = (role?: string | null) => tOrFallback(t, `rbac.sedeRole.${role || ''}`, String(role || naText))
  const moduleLabel = (module?: string | null) => tOrFallback(t, `rbac.module.${module || ''}`, String(module || naText))
  const accessLabel = (level?: string | null) => tOrFallback(t, `rbac.access.${level || ''}`, String(level || naText))
  const planTierLabel = (tier?: string | null) => tOrFallback(t, `plans.tier.${tier || ''}.name`, String(tier || naText))
  const billingCycleLabel = (cycle?: string | null) => tOrFallback(t, `plans.billing.${cycle || ''}`, String(cycle || naText))

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <ErpPageHero
        eyebrow="ERP personal"
        title={t('profile.title')}
        description={t('profile.subtitle')}
        stats={[
          { label: t('profile.meta.role'), value: roleLabel(user.role), hint: user.empresa?.nombre ?? naText, tone: 'neutral' },
          { label: t('profile.meta.memberSince'), value: fmtDate(user.createdAt, locale, naText), hint: 'Antigüedad en el sistema', tone: 'sky' },
            { label: 'Accesos', value: user.moduleAccess.length, hint: `${assignedSedes.length} sedes vinculadas`, tone: 'teal' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('profile.section.info')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <AvatarUploader userName={user.name} imageUrl={user.image} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('profile.fields.email')}</div>
                <div className="font-medium break-all">{user.email}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">{t('profile.fields.company')}</div>
                <div className="font-medium">{user.empresa?.nombre ?? naText}</div>
                {user.empresa ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      {t('profile.company.plan')}: {planTierLabel(user.empresa.planTier)} · {billingCycleLabel(user.empresa.billingCycle)} · {t('profile.company.validUntil')}: {fmtDate(user.empresa.planValidUntil, locale, naText)}
                    </div>
                    {canManageBilling ? (
                      <Button asChild size="sm" variant="outline">
                        <Link href="/dashboard/configuracion/plan">{t('profile.company.managePlan')}</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{t('profile.section.edit')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ProfileBasicsForm
                    initialName={user.name}
                    initialEmail={user.email}
                    initialTelefono={user.telefono}
                    initialCargo={user.cargo}
                    initialSedeDefaultId={user.sedeDefaultId}
                    sedes={assignedSedes}
                    requestableSedes={requestableSedes}
                  />
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{t('profile.section.security')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 text-sm">
                  <div className="text-muted-foreground">{t('profile.security.recommended')}</div>
                  <Link className="text-sky-600 hover:underline" href="/auth/change-password">{t('profile.security.changePassword')}</Link>
                  <div className="text-xs text-muted-foreground">
                    {t('profile.security.lastUpdated')}: {fmtDate(user.updatedAt, locale, naText)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{t('profile.section.preferences')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-sm">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">{t('common.language')}</div>
                    <ProfilePreferencesCard />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{t('profile.section.personalSettings')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3 text-sm">
                  <div className="text-muted-foreground">{t('profile.personalSettings.description')}</div>
                  <div className="space-y-2">
                    <Button asChild size="sm" variant="outline" className="w-full justify-start">
                      <Link href="/dashboard/notificaciones">{t('profile.personalSettings.notifications')}</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="w-full justify-start">
                      <Link href="/dashboard/configuracion/notificaciones">{t('profile.personalSettings.devices')}</Link>
                    </Button>
                  </div>
                  <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">{t('profile.personalSettings.customizeMenu')}</div>
                    <div>{t('profile.personalSettings.customizeMenuHint')}</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{t('profile.section.sites')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {assignedSedes.length ? (
                assignedSedes.slice(0, 6).map((sede) => (
                  <div key={sede.id} className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium truncate">{sede.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {sede.codigo ? `${t('profile.sites.code')}: ${sede.codigo}` : naText}
                      </div>
                    </div>
                    <span className="text-xs rounded-md border px-2 py-1">{assignedSedeRoleById.get(sede.id) ? sedeRoleLabel(assignedSedeRoleById.get(sede.id)) : 'Asignada'}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">{t('profile.sites.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{t('profile.section.access')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {user.moduleAccess.length ? (
                user.moduleAccess.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium truncate">{moduleLabel(a.module)}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.sede.nombre}</div>
                    </div>
                    <span className="text-xs rounded-md border px-2 py-1">{accessLabel(a.level)}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">{t('profile.access.empty')}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{language === 'en' ? 'Storage usage' : 'Uso de almacenamiento'}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm">
              <div className={cn(
                'rounded-xl border p-3',
                storageLevel === 'critical'
                  ? 'border-rose-200 bg-rose-50/70'
                  : storageLevel === 'warning'
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-emerald-200 bg-emerald-50/70'
              )}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-slate-900">
                    {storageLevel === 'critical'
                      ? language === 'en' ? 'Critical limit' : 'Límite crítico'
                      : storageLevel === 'warning'
                        ? language === 'en' ? 'Attention' : 'Atención'
                        : language === 'en' ? 'Healthy usage' : 'Uso saludable'}
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-1 font-semibold text-slate-700">{storagePct}%</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">{language === 'en' ? 'Used' : 'Usado'}</span>
                  <span className="font-semibold text-slate-950">{formatBytes(storageUsage?.usedBytes ?? 0)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-slate-600">{language === 'en' ? 'Available' : 'Disponible'}</span>
                  <span className="font-semibold text-slate-950">{formatBytes(storageUsage?.freeBytes ?? 0)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-slate-600">{language === 'en' ? 'Total plan capacity' : 'Capacidad total del plan'}</span>
                  <span className="font-semibold text-slate-950">{formatBytes(storageUsage?.totalBytes ?? 0)}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{language === 'en' ? 'Current usage' : 'Uso actual'}</span>
                  <span>{storagePct}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      storageLevel === 'critical'
                        ? 'bg-rose-600'
                        : storageLevel === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-600'
                    )}
                    style={{ width: `${storagePct}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {(storageUsage?.filesCount ?? 0)} {language === 'en' ? 'files' : 'archivos'} · {(storageUsage?.foldersCount ?? 0)} {language === 'en' ? 'folders' : 'carpetas'}
              </div>

              <div className="text-xs text-muted-foreground">
                {language === 'en' ? 'Last uploaded file' : 'Último archivo subido'}: {fmtDate(storageUsage?.lastUploadedAt ? new Date(storageUsage.lastUploadedAt) : null, locale, naText)}
              </div>
            </CardContent>
          </Card>

          <LeaveWorkspaceCard empresaNombre={user.empresa?.nombre ?? null} />

          <WorkspaceAccessCard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('profile.security.resetsTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentPasswordResets.length ? (
              recentPasswordResets.map((resetToken) => (
                <div key={resetToken.id} className="border rounded-lg px-3 py-2">
                  <div className="font-medium break-all">{resetToken.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('profile.security.requested')}: {fmtDate(resetToken.createdAt, locale, naText)} · {t('profile.security.expires')}: {fmtDate(resetToken.expiresAt, locale, naText)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{t('profile.security.noResets')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('profile.security.emailVerificationTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentEmailVerifications.length ? (
              recentEmailVerifications.map((c) => (
                <div key={c.id} className="border rounded-lg px-3 py-2">
                  <div className="font-medium break-all">{c.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('profile.security.created')}: {fmtDate(c.createdAt, locale, naText)} · {t('profile.security.expires')}: {fmtDate(c.expiresAt, locale, naText)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{t('profile.security.noVerifications')}</div>
            )}
            <div className="text-xs text-muted-foreground pt-2">
              {t('profile.security.currentStatus')}: {user.emailVerified ? `${t('profile.security.verified')} (${fmtDate(user.emailVerified, locale, naText)})` : t('profile.security.notVerified')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
