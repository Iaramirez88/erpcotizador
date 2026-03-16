import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { requireEmpresaIdForUser } from '@/lib/rbac'
import { NotificationType, Prisma } from '@prisma/client'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'

export const runtime = 'nodejs'

type Scope = 'ALL_SEDES' | 'SEDE_USERS' | 'USER'

function parsePublishAt(value: string | null): Date | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export default async function CrearNotificacionPage() {
  const session = await auth()
  if (!session) redirect('/auth/login')

  const requesterId = session.user.id
  const empresaId = await requireEmpresaIdForUser(requesterId)

  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: {
      id: true,
      email: true,
      globalAccess: { select: { level: true } },
      sedeMemberships: { where: { role: 'ADMIN' }, select: { sedeId: true }, take: 1 },
    },
  })

  const canManageNotifications =
    session.user.role === 'ADMIN' ||
    isSuperAdminEmail(session.user.email) ||
    isSuperAdminEmail(requester?.email) ||
    requester?.globalAccess?.level === 'ADMIN' ||
    (requester?.sedeMemberships?.length ?? 0) > 0

  if (!canManageNotifications) redirect('/dashboard/notificaciones')

  const [sedes, users] = await Promise.all([
    prisma.sede.findMany({
      where: { empresaId },
      orderBy: [{ nombre: 'asc' }],
      select: { id: true, nombre: true, codigo: true },
    }),
    prisma.user.findMany({
      where: { empresaId },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      select: { id: true, name: true, email: true },
      take: 300,
    }),
  ])

  async function createNotification(formData: FormData) {
    'use server'

    const session2 = await auth()
    if (!session2) redirect('/auth/login')

    const requesterId2 = session2.user.id
    const empresaId2 = await requireEmpresaIdForUser(requesterId2)

    const requester2 = await prisma.user.findUnique({
      where: { id: requesterId2 },
      select: {
        id: true,
        email: true,
        globalAccess: { select: { level: true } },
        sedeMemberships: { where: { role: 'ADMIN' }, select: { sedeId: true }, take: 1 },
      },
    })

    const allowed =
      session2.user.role === 'ADMIN' ||
      isSuperAdminEmail(session2.user.email) ||
      isSuperAdminEmail(requester2?.email) ||
      requester2?.globalAccess?.level === 'ADMIN' ||
      (requester2?.sedeMemberships?.length ?? 0) > 0

    if (!allowed) redirect('/dashboard/notificaciones')

    const scope = String(formData.get('scope') ?? '') as Scope
    const type = String(formData.get('type') ?? 'INFO') as NotificationType
    const title = String(formData.get('title') ?? '').trim()
    const body = String(formData.get('body') ?? '').trim()
    const sedeId = String(formData.get('sedeId') ?? '').trim()
    const userId = String(formData.get('userId') ?? '').trim()
    const publishAt = parsePublishAt(formData.get('publishAt') as string | null)

    if (!title) redirect('/dashboard/notificaciones/crear?error=title')

    let recipientUserIds: string[] = []
    let notificationSedeId: string | null = null

    if (scope === 'ALL_SEDES') {
      const rows = await prisma.user.findMany({
        where: { empresaId: empresaId2 },
        select: { id: true },
      })
      recipientUserIds = rows.map((r) => r.id)
    } else if (scope === 'SEDE_USERS') {
      if (!sedeId) redirect('/dashboard/notificaciones/crear?error=sede')

      const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { id: true, empresaId: true } })
      if (!sede?.id || sede.empresaId !== empresaId2) redirect('/dashboard/notificaciones/crear?error=sede')

      const members = await prisma.sedeMembership.findMany({
        where: { sedeId },
        select: { userId: true },
      })
      recipientUserIds = Array.from(new Set(members.map((m) => m.userId)))
      notificationSedeId = sedeId
    } else if (scope === 'USER') {
      if (!userId) redirect('/dashboard/notificaciones/crear?error=user')

      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, empresaId: true } })
      if (!user?.id || user.empresaId !== empresaId2) redirect('/dashboard/notificaciones/crear?error=user')

      recipientUserIds = [userId]
    } else {
      redirect('/dashboard/notificaciones/crear?error=scope')
    }

    if (recipientUserIds.length === 0) redirect('/dashboard/notificaciones/crear?error=recipients')

    const data: Prisma.NotificationCreateManyInput[] = recipientUserIds.map((recipientId) => ({
      userId: recipientId,
      empresaId: empresaId2,
      sedeId: notificationSedeId,
      type,
      title,
      body: body || null,
      ...(publishAt ? { publishAt } : {}),
    }))

    await prisma.notification.createMany({ data })

    redirect('/dashboard/notificaciones')
  }

  return (
    <div className="space-y-6">
      <ErpPageHero
        eyebrow="Comunicaciones"
        title="Crear notificacion"
        description="Configura avisos segmentados por alcance, agenda su publicacion y vuelve al centro de notificaciones cuando termines."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/notificaciones">Volver</Link>
          </Button>
        }
        stats={[
          {
            label: 'Sedes disponibles',
            value: sedes.length,
            hint: 'Segmentacion por sucursal si el alcance lo requiere',
            tone: 'sky',
          },
          {
            label: 'Usuarios elegibles',
            value: users.length,
            hint: 'Destinatarios disponibles para avisos individuales',
            tone: 'teal',
          },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createNotification} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Alcance</label>
                <select name="scope" className="w-full border rounded px-3 py-2" defaultValue="ALL_SEDES" required>
                  <option value="ALL_SEDES">Todas las sedes (toda la empresa)</option>
                  <option value="SEDE_USERS">Todos los usuarios de una sede</option>
                  <option value="USER">Usuario específico</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <select name="type" className="w-full border rounded px-3 py-2" defaultValue="INFO" required>
                  <option value="INFO">Info</option>
                  <option value="SUCCESS">Éxito</option>
                  <option value="WARNING">Advertencia</option>
                  <option value="ERROR">Error</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Sede (si aplica)</label>
                <select name="sedeId" className="w-full border rounded px-3 py-2" defaultValue="">
                  <option value="">—</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                      {s.codigo ? ` (${s.codigo})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Úsala cuando el alcance sea “Todos los usuarios de una sede”.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Usuario (si aplica)</label>
                <select name="userId" className="w-full border rounded px-3 py-2" defaultValue="">
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                      {u.email ? ` · ${u.email}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Úsalo cuando el alcance sea “Usuario específico”.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Título</label>
                <Input name="title" placeholder="Ej: Mantenimiento programado" required />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">Mensaje</label>
                <Textarea name="body" placeholder="Escribe el detalle (opcional)" rows={5} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Publicar en</label>
                <input name="publishAt" type="datetime-local" className="w-full border rounded px-3 py-2" />
                <p className="text-xs text-muted-foreground">Si lo dejas vacío, se publica de inmediato.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit">Crear</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
