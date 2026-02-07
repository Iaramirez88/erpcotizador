import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, getOrCreateDefaultEmpresa } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InviteUserCard } from '@/components/users/invite-user-card'

export const runtime = 'nodejs'

function fmtDate(value: Date | null | undefined): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  } catch {
    return String(value)
  }
}

export default async function UsuariosPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const empresa = await getOrCreateDefaultEmpresa()
  await ensureDefaultSedeForEmpresa(empresa.id, session.user.id)

  const myAdmin = await prisma.sedeMembership.findFirst({
    where: {
      userId: session.user.id,
      sede: { empresaId: empresa.id },
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
        { empresaId: empresa.id },
        { sedeMemberships: { some: { sede: { empresaId: empresa.id } } } },
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
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-muted-foreground">Usuarios registrados y última sesión.</p>
      </div>

      <InviteUserCard />

      <Card>
        <CardHeader>
          <CardTitle>Listado ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Usuario</th>
                  <th className="py-2 text-left">Email</th>
                  <th className="py-2 text-left">Rol</th>
                  <th className="py-2 text-left">Creado</th>
                  <th className="py-2 text-left">Última sesión</th>
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
                          <div className="font-medium">{u.name ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{u.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.role}</td>
                    <td className="py-2">{fmtDate(u.createdAt)}</td>
                    <td className="py-2">{fmtDate(u.lastLoginAt)}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td className="py-6 text-center text-muted-foreground" colSpan={5}>
                      Sin usuarios
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
