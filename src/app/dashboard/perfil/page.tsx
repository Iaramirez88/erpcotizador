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
import { LeaveWorkspaceCard } from '@/components/profile/leave-workspace-card'
import { WorkspaceAccessCard } from '@/components/profile/workspace-access-card'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate, type UiLanguage } from '@/lib/i18n/messages'
import { resolveUserIdFromSession } from '@/lib/session-user'

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
      createdAt: true,
      updatedAt: true,
      empresa: { select: { id: true, nombre: true, planTier: true, billingCycle: true, planValidUntil: true } },
      sedeMemberships: { select: { id: true, role: true, createdAt: true, sede: { select: { id: true, nombre: true, codigo: true } } } },
      moduleAccess: { select: { id: true, module: true, level: true, sede: { select: { id: true, nombre: true } } } },
    },
  })

  if (!user) redirect('/auth/login')

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
          { label: 'Accesos', value: user.moduleAccess.length, hint: `${user.sedeMemberships.length} sedes vinculadas`, tone: 'teal' },
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">{t('profile.section.edit')}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ProfileBasicsForm
                    initialName={user.name}
                    initialTelefono={user.telefono}
                    initialCargo={user.cargo}
                    initialSedeDefaultId={user.sedeDefaultId}
                    sedes={user.sedeMemberships.map((m) => m.sede)}
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
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">{t('profile.section.sites')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {user.sedeMemberships.length ? (
                user.sedeMemberships.slice(0, 6).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium truncate">{m.sede.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {m.sede.codigo ? `${t('profile.sites.code')}: ${m.sede.codigo}` : naText}
                      </div>
                    </div>
                    <span className="text-xs rounded-md border px-2 py-1">{sedeRoleLabel(m.role)}</span>
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
