'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, LogIn, Plus, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import type { AccessLevel, ModuleKey } from '@prisma/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { UserPermissionsModal } from '@/components/rbac/user-permissions-modal'

type SedeRole = 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'

type EmpresaUserRow = {
  id: string
  email: string
  name: string | null
  role: string
  createdAt: string
  sedeDefaultId: string | null
  globalAccessLevel: AccessLevel
  sedes: Array<{ sedeId: string; sedeNombre: string; role: SedeRole }>
}

type EmpresaUsersResponse =
  | {
      ok: true
      empresa: {
        id: string
        nombre: string
        nit: string
        moduleOnlyBilling: boolean
        planTier: string
        effectivePlanTier: string
      }
      enabledModules: ModuleKey[]
      allModules: ModuleKey[]
      sedes: Array<{ id: string; nombre: string; codigo: string | null }>
      items: EmpresaUserRow[]
    }
  | { ok?: false; error?: string }

type ManagementSede = {
  sedeId: string
  sedeNombre: string
  sedeRole: SedeRole
  initialAccess: Partial<Record<ModuleKey, AccessLevel>>
  initialCapabilities: Record<string, AccessLevel>
  permissionProfile: { id: string; name: string } | null
}

type ManagementUser = {
  id: string
  email: string
  name: string | null
  role: string
  globalAccessLevel: AccessLevel
  sedeDefaultId: string | null
  sedes: ManagementSede[]
  selectedSedeId: string | null
}

type ManagementResponse = { ok: true; user: ManagementUser } | { ok?: false; error?: string }

type PermissionTarget = {
  user: ManagementUser
  sede: ManagementSede
  hasSedeAccess: boolean
}

type Props = {
  empresaId: string
  empresaNombre: string
}

const EMPTY_USERS: EmpresaUserRow[] = []
const EMPTY_MODULES: ModuleKey[] = []

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
  return `${body.slice(0, 9)}Aa9`
}

function roleLabel(role: SedeRole) {
  switch (role) {
    case 'ADMIN':
      return 'Administrador'
    case 'MANAGER':
      return 'Gestor'
    case 'MEMBER':
      return 'Miembro'
    case 'READER':
    default:
      return 'Lectura'
  }
}

/**
 * Pestaña "Usuarios y permisos" del detalle de empresa.
 *
 * Reutiliza el motor real de permisos (`/api/admin/permisos/*` con `empresaId`) para que la
 * empresa y el super admin vean exactamente lo mismo: el plan no limita módulos; lo que ve
 * cada usuario depende de su rol de sede y de los permisos que la empresa le otorgue.
 */
export default function SuperAdminEmpresaUsersPanel({ empresaId, empresaNombre }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<(EmpresaUsersResponse & { ok: true }) | null>(null)
  const [search, setSearch] = useState('')
  const [permissionTarget, setPermissionTarget] = useState<PermissionTarget | null>(null)
  const [permissionLoadingId, setPermissionLoadingId] = useState<string | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    accessMode: 'ADMIN' as 'ADMIN' | 'CUSTOM',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(empresaId)}/users`, { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as EmpresaUsersResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        setData(null)
        setError(('error' in json && json.error) || 'No se pudieron cargar los usuarios de la empresa.')
        return
      }
      setData(json)
    } catch {
      setData(null)
      setError('No se pudieron cargar los usuarios de la empresa.')
    } finally {
      setLoading(false)
    }
  }, [empresaId])

  useEffect(() => {
    void load()
  }, [load])

  const items = data?.items ?? EMPTY_USERS
  const enabledModules = data?.enabledModules ?? EMPTY_MODULES

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) => `${item.name ?? ''} ${item.email}`.toLowerCase().includes(term))
  }, [items, search])

  function resetCreateForm() {
    setCreateError(null)
    setForm({ name: '', email: '', password: '', accessMode: 'ADMIN' })
  }

  function closeCreateDialog() {
    setCreateOpen(false)
    setCreatedCredentials(null)
    resetCreateForm()
  }

  async function submitCreate() {
    if (creating) return
    setCreateError(null)

    const email = form.email.trim()
    if (!email || !form.password) {
      setCreateError('Email y contraseña son obligatorios.')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/super-admin/empresas/${encodeURIComponent(empresaId)}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email,
          password: form.password,
          accessMode: form.accessMode,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setCreateError(json.error || 'No se pudo crear el usuario.')
        return
      }

      setCreatedCredentials({ email, password: form.password })
      await load()
    } catch {
      setCreateError('No se pudo crear el usuario.')
    } finally {
      setCreating(false)
    }
  }

  async function openPermissions(user: EmpresaUserRow) {
    setPermissionLoadingId(user.id)
    try {
      const res = await fetch(`/api/super-admin/users/${encodeURIComponent(user.id)}/management`, { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as ManagementResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        toast({
          title: 'No se pudieron cargar los permisos',
          description: ('error' in json && json.error) || undefined,
          variant: 'destructive',
        })
        return
      }

      const detail = json.user
      const defaultSedeId = user.sedeDefaultId ?? data?.sedes[0]?.id ?? null
      const membershipSede =
        detail.sedes.find((item) => item.sedeId === detail.selectedSedeId) ??
        detail.sedes.find((item) => item.sedeId === defaultSedeId) ??
        detail.sedes[0]

      // Usuarios con `empresaId` pero sin membresía (datos heredados): se ofrece la sede
      // principal para que el Super Admin le asigne rol y permisos desde el mismo modal.
      const sede: ManagementSede | null = membershipSede ?? (data?.sedes[0]
        ? {
            sedeId: data.sedes[0].id,
            sedeNombre: data.sedes[0].nombre,
            sedeRole: 'READER',
            initialAccess: {},
            initialCapabilities: {},
            permissionProfile: null,
          }
        : null)

      if (!sede) {
        toast({
          title: 'La empresa no tiene sedes',
          description: 'Crea una sede antes de configurar permisos.',
          variant: 'destructive',
        })
        return
      }

      setPermissionTarget({ user: detail, sede, hasSedeAccess: Boolean(membershipSede) })
    } catch {
      toast({ title: 'No se pudieron cargar los permisos', variant: 'destructive' })
    } finally {
      setPermissionLoadingId(null)
    }
  }

  async function previewAsUser(user: EmpresaUserRow) {
    setPreviewingId(user.id)
    try {
      const res = await fetch(`/api/super-admin/users/${encodeURIComponent(user.id)}/enter-workspace`, { method: 'POST' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; accessUrl?: string }
      if (!res.ok || !json.ok || !json.accessUrl) {
        toast({ title: json.error || 'No se pudo abrir el espacio del usuario', variant: 'destructive' })
        return
      }
      window.location.href = json.accessUrl
    } catch {
      toast({ title: 'No se pudo abrir el espacio del usuario', variant: 'destructive' })
    } finally {
      setPreviewingId(null)
    }
  }

  async function deleteUser(user: EmpresaUserRow) {
    if (!window.confirm(`¿Eliminar el usuario ${user.email}? Esta acción no se puede deshacer.`)) return
    setDeletingId(user.id)
    try {
      const res = await fetch(`/api/super-admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        toast({ title: json.error || 'No se pudo eliminar el usuario', variant: 'destructive' })
        return
      }
      toast({ title: 'Usuario eliminado' })
      await load()
    } catch {
      toast({ title: 'No se pudo eliminar el usuario', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Usuarios de {empresaNombre}</CardTitle>
            <CardDescription>
              El plan ya no limita módulos: cada usuario ve lo que su rol de sede y sus permisos le otorguen.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? 'Actualizando…' : 'Refrescar'}
            </Button>
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Agregar usuario
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <div className="text-sm text-red-600">{error}</div> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o email"
              className="max-w-xs"
            />
            <span className="text-xs text-slate-500">
              {filtered.length} de {items.length} usuarios
            </span>
            {data ? (
              <span className="text-xs text-slate-500">
                · {enabledModules.length} módulos contratados
                {data.empresa.moduleOnlyBilling ? ' (solo módulos)' : ''}
              </span>
            ) : null}
          </div>

          {loading && !data ? <div className="py-6 text-slate-500">Cargando usuarios…</div> : null}

          {!loading && !error && !items.length ? (
            <div className="rounded-xl border border-dashed p-4 text-slate-500">
              Esta empresa aún no tiene usuarios. Usa “Agregar usuario” para crear el primero.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {filtered.map((user) => {
        const busyPermissions = permissionLoadingId === user.id
        return (
          <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-slate-900">{user.name || user.email}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {user.role}
                  </span>
                  {user.globalAccessLevel !== 'NONE' ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Acceso global: {user.globalAccessLevel}
                    </span>
                  ) : null}
                </div>
                <div className="truncate text-xs text-slate-500">{user.email}</div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {user.sedes.length ? (
                    user.sedes.map((sede) => (
                      <span
                        key={sede.sedeId}
                        className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {sede.sedeNombre} · {roleLabel(sede.role)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">
                      Sin sede asignada
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyPermissions || (!user.sedes.length && !data?.sedes.length)}
                  onClick={() => void openPermissions(user)}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  {busyPermissions ? 'Cargando…' : 'Permisos'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={previewingId === user.id}
                  onClick={() => void previewAsUser(user)}
                >
                  <LogIn className="mr-1.5 h-3.5 w-3.5" />
                  {previewingId === user.id ? 'Abriendo…' : 'Ver como'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  disabled={deletingId === user.id}
                  onClick={() => void deleteUser(user)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {deletingId === user.id ? 'Eliminando…' : 'Eliminar'}
                </Button>
              </div>
            </div>
          </div>
        )
      })}

      <Dialog open={createOpen} onOpenChange={(value) => (value ? setCreateOpen(true) : closeCreateDialog())}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar usuario a {empresaNombre}</DialogTitle>
            <DialogDescription>
              El usuario entra a esta empresa. Con “Acceso total” hereda los permisos de administrador de todas las
              sedes; con “Permisos a medida” se configura módulo por módulo con el botón Permisos.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Usuario creado. Comparte estas credenciales y pídele cambiar la contraseña al ingresar.
              </div>
              <div className="space-y-2 rounded-lg border p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium break-all">{createdCredentials.email}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Contraseña</span>
                  <span className="font-mono font-medium break-all">{createdCredentials.password}</span>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" onClick={closeCreateDialog}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {createError ? <div className="text-sm text-red-600">{createError}</div> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="empresa-user-name">Nombre</Label>
                  <Input
                    id="empresa-user-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="empresa-user-email">Email</Label>
                  <Input
                    id="empresa-user-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="empresa-user-password">Contraseña temporal</Label>
                  <div className="flex gap-2">
                    <Input
                      id="empresa-user-password"
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm((prev) => ({ ...prev, password: generateTemporaryPassword() }))}
                    >
                      Generar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo 8 caracteres con mayúscula, minúscula y número.
                  </p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Tipo de acceso inicial</Label>
                  <Select
                    value={form.accessMode}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, accessMode: value as 'ADMIN' | 'CUSTOM' }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Acceso total (administrador)</SelectItem>
                      <SelectItem value="CUSTOM">Permisos a medida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeCreateDialog} disabled={creating}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => void submitCreate()} disabled={creating}>
                  {creating ? 'Creando…' : 'Crear usuario'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {permissionTarget ? (
        <UserPermissionsModal
          key={`${permissionTarget.user.id}-${permissionTarget.sede.sedeId}`}
          empresaId={empresaId}
          sedeId={permissionTarget.sede.sedeId}
          sedeNombre={permissionTarget.sede.sedeNombre}
          user={{ id: permissionTarget.user.id, name: permissionTarget.user.name, email: permissionTarget.user.email }}
          initialHasSedeAccess={permissionTarget.hasSedeAccess}
          initialSedeRole={permissionTarget.sede.sedeRole}
          modules={enabledModules}
          initial={permissionTarget.sede.initialAccess}
          initialGlobalAccess={permissionTarget.user.globalAccessLevel}
          initialCapabilities={permissionTarget.sede.initialCapabilities}
          open={Boolean(permissionTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setPermissionTarget(null)
              void load()
            }
          }}
        />
      ) : null}
    </div>
  )
}
