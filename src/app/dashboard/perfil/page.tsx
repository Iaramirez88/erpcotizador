import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AvatarUploader } from '@/components/profile/avatar-uploader'
import { ProfileBasicsForm } from '@/components/profile/profile-basics-form'
import { LeaveWorkspaceCard } from '@/components/profile/leave-workspace-card'

function fmtDate(date: Date | null | undefined) {
  if (!date) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
  } catch {
    return String(date)
  }
}

function roleLabel(role?: string | null) {
  switch (role) {
    case 'ADMIN':
      return 'Administrador'
    case 'VENDEDOR':
      return 'Vendedor'
    case 'PRODUCCION':
      return 'Producción'
    case 'CLIENTE':
      return 'Cliente'
    case 'USER':
    default:
      return 'Usuario'
  }
}

export default async function PerfilPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const sessionUserId = session.user.id
  const sessionEmail = session.user.email

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(sessionUserId ? [{ id: sessionUserId }] : []),
        ...(sessionEmail ? [{ email: sessionEmail }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      image: true,
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

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="rounded-xl border bg-gradient-to-r from-slate-950 to-slate-900 text-slate-50 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Mi perfil</h1>
            <p className="text-slate-200 mt-1 text-sm">Gestiona tu información, tu foto y revisa seguridad.</p>
          </div>
          <div className="text-xs text-slate-300">
            <div>Rol: <span className="text-slate-100 font-medium">{roleLabel(user.role)}</span></div>
            <div>Usuario desde: <span className="text-slate-100 font-medium">{fmtDate(user.createdAt)}</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Información</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            <AvatarUploader userName={user.name} imageUrl={user.image} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="font-medium break-all">{user.email}</div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Empresa</div>
                <div className="font-medium">{user.empresa?.nombre ?? '—'}</div>
                {user.empresa ? (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">
                      Plan: {String(user.empresa.planTier)} · {String(user.empresa.billingCycle)} · Vigente hasta: {fmtDate(user.empresa.planValidUntil)}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/dashboard/configuracion/plan">Actualizar plan</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Editar datos</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ProfileBasicsForm initialName={user.name} />
                </CardContent>
              </Card>

              <Card className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Seguridad</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 text-sm">
                  <div className="text-muted-foreground">Acciones recomendadas:</div>
                  <Link className="text-sky-600 hover:underline" href="/auth/change-password">Cambiar contraseña</Link>
                  <div className="text-xs text-muted-foreground">Última actualización del perfil: {fmtDate(user.updatedAt)}</div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Sedes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {user.sedeMemberships.length ? (
                user.sedeMemberships.slice(0, 6).map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium truncate">{m.sede.nombre}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.sede.codigo ? `Código: ${m.sede.codigo}` : '—'}</div>
                    </div>
                    <span className="text-xs rounded-md border px-2 py-1">{String(m.role)}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No tienes sedes asignadas.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base">Accesos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {user.moduleAccess.length ? (
                user.moduleAccess.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium truncate">{String(a.module)}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.sede.nombre}</div>
                    </div>
                    <span className="text-xs rounded-md border px-2 py-1">{String(a.level)}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No hay accesos configurados.</div>
              )}
            </CardContent>
          </Card>

          <LeaveWorkspaceCard empresaNombre={user.empresa?.nombre ?? null} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Seguridad · Restablecimientos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentPasswordResets.length ? (
              recentPasswordResets.map((t) => (
                <div key={t.id} className="border rounded-lg px-3 py-2">
                  <div className="font-medium break-all">{t.email}</div>
                  <div className="text-xs text-muted-foreground">Solicitado: {fmtDate(t.createdAt)} · Expira: {fmtDate(t.expiresAt)}</div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">Sin solicitudes recientes.</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Seguridad · Verificación de email</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentEmailVerifications.length ? (
              recentEmailVerifications.map((c) => (
                <div key={c.id} className="border rounded-lg px-3 py-2">
                  <div className="font-medium break-all">{c.email}</div>
                  <div className="text-xs text-muted-foreground">Creado: {fmtDate(c.createdAt)} · Expira: {fmtDate(c.expiresAt)}</div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">Sin verificaciones recientes.</div>
            )}
            <div className="text-xs text-muted-foreground pt-2">
              Estado actual: {user.emailVerified ? `Verificado (${fmtDate(user.emailVerified)})` : 'No verificado'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
