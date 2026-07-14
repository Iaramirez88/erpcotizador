'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AccessLevel, ModuleKey, SedeRole } from '@prisma/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { DASHBOARD_PERMISSION_RULES } from '@/lib/dashboard-permission-catalog'

const ACCESS_LEVELS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']
const SEDE_ROLES: SedeRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']
const MODULE_OPTIONS: ModuleKey[] = [
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

type CapabilityProfileItem = {
  domain: string
  subdomain: string
  level: AccessLevel
  label: string | null
}

type PermissionProfileSummary = {
  id: string
  name: string
  description: string | null
  sedeRole: SedeRole
  globalAccessLevel: AccessLevel
  moduleCount: number
  capabilityCount: number
  createdAt: string
  createdByLabel: string | null
  assignmentCount: number
  moduleLevels: Record<string, AccessLevel>
  capabilityLevels: Record<string, CapabilityProfileItem>
}

type UserOption = {
  id: string
  name: string | null
  email: string
  hasSedeAccess: boolean
}

type Props = {
  profiles: PermissionProfileSummary[]
  users: UserOption[]
}

export function PermissionProfilesManager({ profiles, users }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedProfile, setSelectedProfile] = useState<PermissionProfileSummary | null>(null)
  const [editingProfile, setEditingProfile] = useState<PermissionProfileSummary | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [applying, setApplying] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingProfile, setDeletingProfile] = useState<PermissionProfileSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    description: string
    sedeRole: SedeRole
    globalAccessLevel: AccessLevel
    moduleLevels: Record<string, AccessLevel>
    capabilityLevels: Record<string, CapabilityProfileItem>
  }>({
    name: '',
    description: '',
    sedeRole: 'READER',
    globalAccessLevel: 'NONE',
    moduleLevels: {},
    capabilityLevels: {},
  })

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((user) => {
      if (!term) return true
      return (user.name || '').toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
    })
  }, [search, users])

  function toggleUser(userId: string) {
    setSelectedUserIds((current) => current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId])
  }

  function openEditProfile(profile: PermissionProfileSummary) {
    setEditError(null)
    setEditingProfile(profile)
    setEditForm({
      name: profile.name,
      description: profile.description || '',
      sedeRole: profile.sedeRole,
      globalAccessLevel: profile.globalAccessLevel,
      moduleLevels: { ...profile.moduleLevels },
      capabilityLevels: { ...profile.capabilityLevels },
    })
  }

  async function saveProfileEdits() {
    if (!editingProfile) return
    if (!editForm.name.trim()) {
      setEditError('Debes escribir un nombre para la regla.')
      return
    }

    setSavingEdit(true)
    setEditError(null)
    try {
      const res = await fetch('/api/admin/permisos/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: editingProfile.id,
          name: editForm.name.trim(),
          description: editForm.description.trim() || null,
          sedeRole: editForm.sedeRole,
          globalAccessLevel: editForm.globalAccessLevel,
          moduleLevels: editForm.moduleLevels,
          capabilityLevels: editForm.capabilityLevels,
        }),
      })

      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: { reappliedUsers?: number } } | null
      if (!res.ok || !json?.success) {
        setEditError(json?.error || 'No fue posible actualizar la regla.')
        return
      }

      toast({ title: `Regla actualizada. Cambios propagados a ${json.data?.reappliedUsers ?? 0} usuario(s).` })
      setEditingProfile(null)
      router.refresh()
    } finally {
      setSavingEdit(false)
    }
  }

  async function applyProfile() {
    if (!selectedProfile || !selectedUserIds.length) {
      toast({ title: 'Selecciona al menos un usuario', variant: 'destructive' })
      return
    }

    setApplying(true)
    try {
      const res = await fetch('/api/admin/permisos/profiles/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfile.id, userIds: selectedUserIds }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: { appliedUsers?: number } } | null
      if (!res.ok || !json?.success) {
        toast({ title: json?.error || 'No fue posible aplicar la regla.', variant: 'destructive' })
        return
      }

      toast({ title: `Regla aplicada a ${json.data?.appliedUsers ?? selectedUserIds.length} usuario(s).` })
      setSelectedProfile(null)
      setSelectedUserIds([])
      setSearch('')
      router.refresh()
    } finally {
      setApplying(false)
    }
  }

  async function deleteProfile() {
    if (!deletingProfile) return

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/permisos/profiles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: deletingProfile.id }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; data?: { affectedUsers?: number } } | null
      if (!res.ok || !json?.success) {
        toast({ title: json?.error || 'No fue posible eliminar la regla.', variant: 'destructive' })
        return
      }

      toast({ title: `Regla eliminada. Se limpiaron permisos en ${json.data?.affectedUsers ?? 0} usuario(s).` })
      setDeletingProfile(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Reglas de permisos</CardTitle>
          <CardDescription>Crea perfiles reutilizables desde un usuario y luego aplícalos a muchos usuarios de esta sede.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profiles.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Todavía no hay reglas guardadas. Configura un usuario y usa “Guardar como regla” desde su modal de permisos.
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-2">
            {profiles.map((profile) => (
              <div key={profile.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950">{profile.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{profile.description || 'Sin descripción adicional.'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openEditProfile(profile)}>
                      Editar regla
                    </Button>
                    <Button size="sm" className="rounded-xl" onClick={() => setSelectedProfile(profile)}>
                      Aplicar a usuarios
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => setDeletingProfile(profile)}>
                      Eliminar regla
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Rol sede: {profile.sedeRole}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">General: {profile.globalAccessLevel}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Módulos: {profile.moduleCount}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Submódulos: {profile.capabilityCount}</span>
                  <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-fuchsia-800">Usuarios vinculados: {profile.assignmentCount}</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">
                  Creada {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(profile.createdAt))}
                  {profile.createdByLabel ? ` · por ${profile.createdByLabel}` : ''}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedProfile)} onOpenChange={(open) => {
        if (!open) {
          setSelectedProfile(null)
          setSelectedUserIds([])
          setSearch('')
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Aplicar regla de permisos</DialogTitle>
            <DialogDescription>
              {selectedProfile ? `Selecciona los usuarios que recibirán la regla ${selectedProfile.name}.` : 'Selecciona usuarios.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Buscar usuarios</Label>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o correo..." />
            </div>

            <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-2xl border border-slate-200 p-3">
              {filteredUsers.map((user) => {
                const checked = selectedUserIds.includes(user.id)
                return (
                  <label key={user.id} className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-950">{user.name || user.email}</div>
                      <div className="text-xs text-slate-500">{user.email} · {user.hasSedeAccess ? 'Con acceso en sede' : 'Sin acceso en sede'}</div>
                    </div>
                    <input type="checkbox" checked={checked} onChange={() => toggleUser(user.id)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                  </label>
                )
              })}
              {!filteredUsers.length ? <div className="text-sm text-slate-500">No hay usuarios que coincidan con esa búsqueda.</div> : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProfile(null)}>Cancelar</Button>
            <Button onClick={() => void applyProfile()} disabled={applying || !selectedUserIds.length}>
              {applying ? 'Aplicando...' : `Aplicar a ${selectedUserIds.length} usuario(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingProfile)} onOpenChange={(open) => {
        if (!open) {
          setEditingProfile(null)
          setEditError(null)
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar regla de permisos</DialogTitle>
            <DialogDescription>
              {editingProfile ? `Los cambios se aplicarán automáticamente a los ${editingProfile.assignmentCount} usuario(s) ya vinculados a ${editingProfile.name}.` : 'Editar regla.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {editError ? <div className="text-sm text-red-600">{editError}</div> : null}

            {editingProfile ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <div className="font-semibold">Impacto del cambio</div>
                <div className="mt-1">
                  Al guardar esta regla, el sistema actualizará automáticamente a <span className="font-semibold">{editingProfile.assignmentCount} usuario(s)</span> que ya la tienen asignada.
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Nombre</Label>
                <Input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <Label>Descripción</Label>
                <Input value={editForm.description} onChange={(event) => setEditForm((prev) => ({ ...prev, description: event.target.value }))} />
              </div>
              <div>
                <Label>Rol sede</Label>
                <select
                  value={editForm.sedeRole}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, sedeRole: event.target.value as SedeRole }))}
                  className="w-full h-10 rounded-md border px-3 text-sm"
                >
                  {SEDE_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div>
                <Label>Permiso general</Label>
                <select
                  value={editForm.globalAccessLevel}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, globalAccessLevel: event.target.value as AccessLevel }))}
                  className="w-full h-10 rounded-md border px-3 text-sm"
                >
                  {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Permisos por módulo</div>
                <div className="text-xs text-slate-500">Ajusta el nivel base de cada módulo dentro de la regla.</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {MODULE_OPTIONS.map((moduleKey) => (
                  <div key={moduleKey} className="rounded-xl border border-slate-200 p-3">
                    <Label>{moduleKey}</Label>
                    <select
                      value={editForm.moduleLevels[moduleKey] ?? 'NONE'}
                      onChange={(event) => setEditForm((prev) => ({
                        ...prev,
                        moduleLevels: { ...prev.moduleLevels, [moduleKey]: event.target.value as AccessLevel },
                      }))}
                      className="mt-2 w-full h-10 rounded-md border px-3 text-sm"
                    >
                      {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-slate-950">Permisos por submódulo</div>
                <div className="text-xs text-slate-500">Los cambios aquí tienen prioridad sobre el nivel base del módulo.</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {DASHBOARD_PERMISSION_RULES.map((rule) => {
                  const current = editForm.capabilityLevels[rule.key] ?? {
                    domain: rule.capabilities[0]?.domain ?? '',
                    subdomain: rule.capabilities[0]?.subdomain ?? '',
                    label: rule.label,
                    level: 'NONE' as AccessLevel,
                  }
                  return (
                    <div key={rule.key} className="rounded-xl border border-slate-200 p-3">
                      <div className="text-sm font-medium text-slate-950">{rule.label}</div>
                      <div className="text-xs text-slate-500">{rule.section} · {rule.moduleKey}</div>
                      <select
                        value={current.level}
                        onChange={(event) => setEditForm((prev) => ({
                          ...prev,
                          capabilityLevels: {
                            ...prev.capabilityLevels,
                            [rule.key]: {
                              domain: current.domain,
                              subdomain: current.subdomain,
                              label: current.label,
                              level: event.target.value as AccessLevel,
                            },
                          },
                        }))}
                        className="mt-2 w-full h-10 rounded-md border px-3 text-sm"
                      >
                        {ACCESS_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)} disabled={savingEdit}>Cancelar</Button>
            <Button onClick={() => void saveProfileEdits()} disabled={savingEdit}>
              {savingEdit ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingProfile)} onOpenChange={(open) => {
        if (!open && !deleting) {
          setDeletingProfile(null)
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Eliminar regla de permisos</DialogTitle>
            <DialogDescription>
              {deletingProfile ? `Se eliminará la regla ${deletingProfile.name} y se quitarán sus permisos a los ${deletingProfile.assignmentCount} usuario(s) vinculados.` : 'Confirma la eliminación.'}
            </DialogDescription>
          </DialogHeader>

          {deletingProfile ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
              Esta acción también removerá el acceso de sede, permisos generales, módulos y submódulos que fueron aplicados por esta regla a los usuarios afectados.
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingProfile(null)} disabled={deleting}>Cancelar</Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={() => void deleteProfile()} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar regla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}