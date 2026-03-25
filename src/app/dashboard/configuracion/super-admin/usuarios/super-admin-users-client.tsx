'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/providers/i18n-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PlanTier } from '@/lib/plans'

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

function fmtDate(value: string | null | undefined, locale: string, naText: string): string {
  if (!value) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function SuperAdminUsersClient() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

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
          setError(('error' in json && json.error) || t('superAdmin.users.errors.loadFailed'))
          setItems([])
          setTotal(0)
          return
        }

        if (!cancelled) {
          setItems(json.items)
          setTotal(json.total)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('common.unexpectedError'))
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
        alert(('error' in json && json.error) || t('superAdmin.users.errors.saveFailed'))
        return
      }

      setItems((prev) => prev.map((it) => (it.id === editing.id ? json.user : it)))
      setEditOpen(false)
      setEditing(null)
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteUser(row: Row) {
    if (!confirm(t('superAdmin.users.confirm.delete', { email: row.email }))) return
    setDeletingId(row.id)
    try {
      const res = await fetch(`/api/super-admin/users/${row.id}`, { method: 'DELETE' })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        alert(json.error || t('superAdmin.users.errors.deleteFailed'))
        return
      }

      // Reload simple: remove from list + adjust total.
      setItems((prev) => prev.filter((it) => it.id !== row.id))
      setTotal((t) => Math.max(0, t - 1))
    } catch (e) {
      alert(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('superAdmin.users.title')}</h1>
          <p className="text-sm text-gray-600">{t('superAdmin.users.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/empresas">{t('superAdmin.nav.companies')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/configuracion/super-admin/modulos-por-plan">{t('superAdmin.nav.modulesByPlan')}</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('superAdmin.users.list.title')}</CardTitle>
          <CardDescription>{t('superAdmin.users.list.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <div className="min-w-[240px] flex-1">
              <Input placeholder={t('superAdmin.users.searchPlaceholder')} value={search} onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }} />
            </div>
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t('common.previous')}
            </Button>
            <div className="text-sm text-muted-foreground">
              {t('superAdmin.pagination.pageOf', { page: String(page), totalPages: String(totalPages) })}
            </div>
            <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              {t('common.next')}
            </Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground py-6">{t('common.loading')}</div>
          ) : error ? (
            <div className="text-sm text-red-600 py-6">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6">{t('superAdmin.users.empty')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">{t('superAdmin.users.columns.user')}</th>
                    <th className="py-2 text-left">{t('common.email')}</th>
                    <th className="py-2 text-left">{t('superAdmin.users.columns.company')}</th>
                    <th className="py-2 text-left">{t('superAdmin.users.columns.plan')}</th>
                    <th className="py-2 text-left">{t('superAdmin.users.columns.role')}</th>
                    <th className="py-2 text-left">{t('superAdmin.users.columns.createdAt')}</th>
                    <th className="py-2 text-right">{t('superAdmin.users.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2">
                        <div className="font-medium">{u.name || naText}</div>
                        <div className="text-xs text-muted-foreground">{u.id}</div>
                      </td>
                      <td className="py-2">{u.email}</td>
                      <td className="py-2">{u.empresa?.nombre || naText}</td>
                      <td className="py-2">{u.empresa?.planTier || naText}</td>
                      <td className="py-2">{u.role}</td>
                      <td className="py-2">{fmtDate(u.createdAt, locale, naText)}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={deletingId === u.id}
                            onClick={() => void deleteUser(u)}
                          >
                            {deletingId === u.id ? t('superAdmin.users.deleting') : t('common.delete')}
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
            <DialogTitle>{t('superAdmin.users.edit.title')}</DialogTitle>
            <DialogDescription>{t('superAdmin.users.edit.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>{t('superAdmin.users.fields.name')}</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>{t('superAdmin.users.fields.role')}</Label>
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
              <div className="text-muted-foreground">{t('superAdmin.users.fields.company')}</div>
              <div className="font-medium">{editing?.empresa?.nombre || naText}</div>
              <div className="text-muted-foreground mt-2">{t('superAdmin.users.fields.plan')}</div>
              <div className="font-medium">{editing?.empresa?.planTier || naText}</div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void saveEdit()} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
