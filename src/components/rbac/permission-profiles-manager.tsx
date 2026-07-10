'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AccessLevel, SedeRole } from '@prisma/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

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
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [applying, setApplying] = useState(false)

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
                  <Button size="sm" className="rounded-xl" onClick={() => setSelectedProfile(profile)}>
                    Aplicar a usuarios
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Rol sede: {profile.sedeRole}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">General: {profile.globalAccessLevel}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Módulos: {profile.moduleCount}</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">Submódulos: {profile.capabilityCount}</span>
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
    </>
  )
}