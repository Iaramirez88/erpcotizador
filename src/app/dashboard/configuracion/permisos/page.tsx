import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ensureDefaultSedeForEmpresa, requireEmpresaIdForUser } from '@/lib/rbac'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ModuleKey, AccessLevel, SedeRole } from '@prisma/client'

export const runtime = 'nodejs'

const MODULES: ModuleKey[] = [
  'DASHBOARD',
  'COTIZADOR',
  'COTIZACIONES',
  'CLIENTES',
  'MATERIALES',
  'INVENTARIO',
  'REMISIONES',
  'POS',
  'PROVEEDORES',
  'COMPRAS',
  'ORDENES',
  'ESCANEOS',
  'REPORTES',
  'NOTIFICACIONES',
  'CONFIG',
]

const ACCESS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']
const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']

const SEDE_ROLE_LABEL: Record<SedeRole, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Editor',
  MEMBER: 'Editor',
  READER: 'Lectura',
}

const ACCESS_LABEL: Record<AccessLevel, string> = {
  NONE: 'Sin acceso',
  READ: 'Lectura',
  WRITE: 'Editor',
  ADMIN: 'Administrador',
}

export default async function PermisosPage() {
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

  const activeSedeId = sedes[0]?.id

  async function createSede(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const nombre = String(formData.get('nombre') || '').trim()
    const codigo = String(formData.get('codigo') || '').trim()

    if (!nombre) return

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

    await prisma.sede.create({
      data: {
        empresaId: empresaId2,
        nombre,
        codigo: codigo || null,
      },
    })
  }

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

  async function setModuleAccess(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2) return

    const sedeId = String(formData.get('sedeId') || '')
    const email = String(formData.get('email') || '').trim().toLowerCase()
    const moduleKey = String(formData.get('module') || '') as ModuleKey
    const level = String(formData.get('level') || '') as AccessLevel

    if (!sedeId || !email) return
    if (!MODULES.includes(moduleKey)) return
    if (!ACCESS.includes(level)) return

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

    await prisma.userModuleAccess.upsert({
      where: { sedeId_userId_module: { sedeId, userId: user.id, module: moduleKey } },
      create: { sedeId, userId: user.id, module: moduleKey, level },
      update: { level },
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
      return
    }

    await prisma.userGlobalAccess.upsert({
      where: { userId: user.id },
      create: { userId: user.id, empresaId: empresaId2, level },
      update: { level },
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
        select: { id: true, role: true, user: { select: { email: true, name: true } } },
      })
    : []

  const permisos = activeSedeId
    ? await prisma.userModuleAccess.findMany({
        where: { sedeId: activeSedeId },
        orderBy: [{ userId: 'asc' }, { module: 'asc' }],
        select: { id: true, module: true, level: true, user: { select: { email: true, name: true } } },
      })
    : []

  const globalAccess = await prisma.userGlobalAccess.findMany({
    where: { empresaId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, level: true, user: { select: { email: true, name: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Permisos</h1>
        <p className="text-sm text-muted-foreground">
          Define permisos generales (todas las sedes) y permisos por sede/módulo.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Permisos generales (todas las sedes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={setGlobalAccess} className="grid gap-2 max-w-lg">
            <input name="email" placeholder="Email del usuario" className="border rounded px-3 py-2" />
            <select name="level" className="border rounded px-3 py-2">
              {ACCESS.map((l) => (
                <option key={l} value={l}>
                  {ACCESS_LABEL[l]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">Guardar permiso general</Button>
            <div className="text-xs text-muted-foreground">
              Nota: si un usuario tiene rol por sede, ese rol puede sobreescribir el permiso general.
            </div>
          </form>

          <div className="grid gap-2">
            {globalAccess.map((ga) => (
              <div key={ga.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{ga.user.name ?? ga.user.email}</div>
                  <div className="text-xs text-muted-foreground">{ga.user.email}</div>
                </div>
                <div className="text-sm">{ACCESS_LABEL[ga.level]}</div>
              </div>
            ))}
            {globalAccess.length === 0 && (
              <div className="text-sm text-muted-foreground">Sin permisos generales.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Crear sede</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createSede} className="flex flex-col gap-3 max-w-md">
            <input
              name="nombre"
              placeholder="Nombre (ej: Principal, Norte, Medellín)"
              className="border rounded px-3 py-2"
            />
            <input
              name="codigo"
              placeholder="Código (opcional)"
              className="border rounded px-3 py-2"
            />
            <Button type="submit">Crear</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros ({activeSede?.nombre ?? '—'})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addMember} className="grid gap-2 max-w-lg">
            <input type="hidden" name="sedeId" value={activeSedeId ?? ''} />
            <input name="email" placeholder="Email del usuario" className="border rounded px-3 py-2" />
            <select name="role" className="border rounded px-3 py-2">
              {SEDE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {SEDE_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">Agregar/Actualizar miembro</Button>
          </form>

          <div className="grid gap-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{m.user.name ?? m.user.email}</div>
                  <div className="text-xs text-muted-foreground">{m.user.email}</div>
                </div>
                <div className="text-sm">{SEDE_ROLE_LABEL[m.role]}</div>
              </div>
            ))}
            {members.length === 0 && <div className="text-sm text-muted-foreground">Sin miembros.</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permisos por módulo ({activeSede?.nombre ?? '—'})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={setModuleAccess} className="grid gap-2 max-w-lg">
            <input type="hidden" name="sedeId" value={activeSedeId ?? ''} />
            <input name="email" placeholder="Email del usuario" className="border rounded px-3 py-2" />
            <select name="module" className="border rounded px-3 py-2">
              {MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select name="level" className="border rounded px-3 py-2">
              {ACCESS.map((l) => (
                <option key={l} value={l}>
                  {ACCESS_LABEL[l]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">Guardar permiso</Button>
          </form>

          <div className="grid gap-2">
            {permisos.map((p) => (
              <div key={p.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{p.user.name ?? p.user.email}</div>
                  <div className="text-xs text-muted-foreground">{p.user.email}</div>
                </div>
                <div className="text-sm">{p.module}: {ACCESS_LABEL[p.level]}</div>
              </div>
            ))}
            {permisos.length === 0 && <div className="text-sm text-muted-foreground">Sin permisos explícitos.</div>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sedes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {sedes.map((s) => (
              <div key={s.id} className="flex items-center justify-between border rounded px-3 py-2">
                <div>
                  <div className="font-medium">{s.nombre}</div>
                  <div className="text-xs text-muted-foreground">{s.codigo ?? '—'}</div>
                </div>
                <div className="text-xs text-muted-foreground">{s.id}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
