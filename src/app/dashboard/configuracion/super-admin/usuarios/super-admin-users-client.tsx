'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type PlanTier = 'BASIC' | 'MEDIO' | 'INTERMEDIO' | 'FULL'

type UserRole = 'ADMIN' | 'USER' | 'VENDEDOR' | 'PRODUCCION' | 'CLIENTE'

type Row = {
  id: string
  email: string
  name: string | null
  role: UserRole
  createdAt: string
  empresa: null | {
    id: string
    nombre: string
    planTier: PlanTier
  }
}

type GetResponse =
  | {
      ok: true
      page: number
      limit: number
      total: number
      items: Row[]
    }
  | { ok?: false; error?: string }

type PutResponse =
  | {
      ok: true
      user: Row
    }
  | { ok?: false; error?: string }

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function SuperAdminUsersClient() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<Row[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const totalPages = useMemo(() => {
    const n = Math.ceil((total || 0) / limit)
    return n <= 0 ? 1 : n
  }, [total, limit])

  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Row | null>(null)

  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('USER')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        if (search.trim()) params.set('search', search.trim())

        const res = await fetch(`/api/super-admin/users?${params.toString()}`, { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as GetResponse

        if (!res.ok || !('ok' in json) || !json.ok) {
          setError(('error' in json && json.error) || 'No se pudo cargar')
          setItems([])
          setTotal(0)
          return
        }

        if (!cancelled) {
          setItems(json.items)
          setTotal(json.total)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error inesperado')
        setItems([])
        setTotal(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [page, limit, search])

  function openEdit(row: Row) {
    setEditing(row)
    setEditName(row.name ?? '')
    setEditRole(row.role)
    setEditOpen(true)
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName || null, role: editRole }),
      })

      const json = (await res.json().catch(() => ({}))) as PutResponse
      if (!res.ok || !('ok' in json) || !json.ok) {
        alert(('error' in json && json.error) || 'No se pudo guardar')
        return
      }

      setItems((prev) => prev.map((it) => (it.id === editing.id ? json.user : it)))
      setEditOpen(false)
      setEditing(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(row: Row) {
    if (!confirm(`¿Eliminar el usuario ${row.email}?`)) return
    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/super-admin/users/${row.id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        alert(json.error || 'No se pudo eliminar')
        return
      }

      // Reload simple: remove from list + adjust total.
      setItems((prev) => prev.filter((it) => it.id !== row.id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Super Admin · Usuarios</h1>
          <p className="text-sm text-gray-600">Listado global de usuarios (con empresa y plan).</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/modulos-por-plan">Módulos por plan</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>Paginado de 10 en 10</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="min-w-[240px] flex-1">
              <Input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }} />
            </div>
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              Página {page} / {totalPages}
            </div>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Siguiente
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-6">Cargando…</div>
          ) : error ? (
            <div className="text-sm text-red-600 py-6">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">Sin usuarios</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Usuario</th>
                    <th className="py-2 text-left">Email</th>
                    <th className="py-2 text-left">Empresa</th>
                    <th className="py-2 text-left">Plan</th>
                    <th className="py-2 text-left">Rol</th>
                    <th className="py-2 text-left">Creado</th>
                    <th className="py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2">
                        <div className="font-medium">{u.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{u.id}</div>
                      </td>
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{u.empresa?.nombre || '—'}</td>
                      <td className="py-2">{u.empresa?.planTier || '—'}</td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">{fmtDate(u.createdAt)}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={deletingId === u.id}
                            onClick={() => void deleteUser(u)}
                          >
                            {deletingId === u.id ? 'Eliminando…' : 'Eliminar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => {
        setEditOpen(v)
        if (!v) setEditing(null)
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>Actualiza nombre y rol.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Rol</Label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="USER">USER</option>
                <option value="VENDEDOR">VENDEDOR</option>
                <option value="PRODUCCION">PRODUCCION</option>
                <option value="CLIENTE">CLIENTE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="rounded border p-3 text-sm">
              <div className="text-muted-foreground">Empresa</div>
              <div className="font-medium">{editing?.empresa?.nombre || '—'}</div>
              <div className="text-muted-foreground mt-2">Plan</div>
              <div className="font-medium">{editing?.empresa?.planTier || '—'}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
