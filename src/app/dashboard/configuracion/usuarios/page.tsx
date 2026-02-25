import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InviteUserCard } from '@/components/users/invite-user-card'
import { getServerLanguage } from '@/lib/i18n/server'
import { translate } from '@/lib/i18n/messages'

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
