'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DataViewToggle } from '@/components/dashboard/data-view-toggle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useDataViewMode } from '@/hooks/use-data-view-mode'
import { useI18n } from '@/components/providers/i18n-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ModuleKey } from '@prisma/client'
import type { PlanTier } from '@/lib/plans'

type BillingCycle = 'MONTHLY' | 'YEARLY'
type UserRole = 'ADMIN' | 'USER' | 'VENDEDOR' | 'PRODUCCION' | 'CLIENTE'
type SedeRole = 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'
type AccessLevel = 'NONE' | 'READ' | 'WRITE' | 'ADMIN'

type UserSegment = 'ALL' | 'NEW' | 'TRIAL' | 'NO_COMPANY' | 'WITH_COMPANY'

type Row = {
  id: string
  email: string
  name: string | null
  role: UserRole
  createdAt: string
  isNew: boolean
  empresa: null | {
    id: string
    nombre: string
    nit: string
    planTier: PlanTier
    planValidUntil: string | null
    trialTier: PlanTier | null
    trialValidUntil: string | null
  }
}

type GetResponse =
  | {
      ok: true
      page: number
      limit: number
      total: number
      segment?: UserSegment
      items: Row[]
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
  role: UserRole
  createdAt: string
  empresa: null | {
    id: string
    nombre: string
    nit: string
    planTier: PlanTier
    billingCycle: BillingCycle
    planValidUntil: string | null
    trialTier: PlanTier | null
    trialValidUntil: string | null
  }
  globalAccessLevel: AccessLevel
  sedeDefaultId: string | null
  sedes: ManagementSede[]
  selectedSedeId: string | null
}

type ManagementResponse =
  | { ok: true; user: ManagementUser }
  | { ok?: false; error?: string }

function fmtDate(value: string | null | undefined, locale: string, naText: string): string {
  if (!value) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isFutureDate(value: string | null | undefined): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time > Date.now()
}

export default function SuperAdminUsersClient() {
  const { t, language } = useI18n()
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')
  const { mode: dataViewMode, setMode: setDataViewMode } = useDataViewMode('superadmin.users.history', 'list')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Row[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<UserSegment>('ALL')

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewingUserId, setPreviewingUserId] = useState<string | null>(null)
  const [managementLoading, setManagementLoading] = useState(false)
  const [managementError, setManagementError] = useState<string | null>(null)
  const [management, setManagement] = useState<ManagementUser | null>(null)

  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('USER')
  const [editPlanTier, setEditPlanTier] = useState<PlanTier>('FULL')
  const [editBillingCycle, setEditBillingCycle] = useState<BillingCycle>('MONTHLY')
  const [editPlanValidUntil, setEditPlanValidUntil] = useState('')
  const [editIsPaid, setEditIsPaid] = useState(false)
  const [editIsPaidTouched, setEditIsPaidTouched] = useState(false)
  const [editClearTrial, setEditClearTrial] = useState(false)
  const [selectedSedeId, setSelectedSedeId] = useState('')
  const [sedeStates, setSedeStates] = useState<ManagementSede[]>([])

  const totalPages = useMemo(() => {
    const value = Math.ceil((total || 0) / limit)
    return value <= 0 ? 1 : value
  }, [limit, total])

  const selectedSede = useMemo(
    () => sedeStates.find((item) => item.sedeId === selectedSedeId) ?? null,
    [sedeStates, selectedSedeId],
  )

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', String(limit))
        params.set('segment', segment)
        if (search.trim()) params.set('search', search.trim())

        const res = await fetch(`/api/super-admin/users?${params.toString()}`, { cache: 'no-store' })
        const json = (await res.json().catch(() => ({}))) as GetResponse

        if (!res.ok || !('ok' in json) || !json.ok) {
          if (!cancelled) {
            setItems([])
            setTotal(0)
            setError(('error' in json && json.error) || t('superAdmin.users.errors.loadFailed'))
          }
          return
        }

        if (!cancelled) {
          setItems(json.items)
          setTotal(json.total)
        }
      } catch {
        if (!cancelled) {
          setItems([])
          setTotal(0)
          setError(t('superAdmin.users.errors.loadFailed'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [limit, page, search, segment, t])

  function resetEditState() {
    setEditing(null)
    setManagement(null)
    setManagementError(null)
    setManagementLoading(false)
    setEditName('')
    setEditRole('USER')
    setEditPlanTier('FULL')
    setEditBillingCycle('MONTHLY')
    setEditPlanValidUntil('')
    setEditIsPaid(false)
    setEditIsPaidTouched(false)
    setEditClearTrial(false)
    setSelectedSedeId('')
    setSedeStates([])
  }

  async function openEdit(row: Row) {
    setEditOpen(true)
    setEditing(row)
    setEditName(row.name ?? '')
    setEditRole(row.role)
    setManagement(null)
    setManagementError(null)
    setManagementLoading(true)

    try {
      const res = await fetch(`/api/super-admin/users/${row.id}/management`, { cache: 'no-store' })
      const json = (await res.json().catch(() => ({}))) as ManagementResponse

      if (!res.ok || !('ok' in json) || !json.ok) {
        setManagementError(('error' in json && json.error) || t('superAdmin.users.errors.loadManagementFailed'))
        return
      }

      const detail = json.user
      setManagement(detail)
      setEditName(detail.name ?? '')
      setEditRole(detail.role)
      setEditPlanTier(detail.empresa?.planTier ?? 'FULL')
      setEditBillingCycle(detail.empresa?.billingCycle ?? 'MONTHLY')
      setEditPlanValidUntil(toDateInputValue(detail.empresa?.planValidUntil))
      setEditIsPaid(isFutureDate(detail.empresa?.planValidUntil))
      setEditIsPaidTouched(false)
      setEditClearTrial(false)
      setSelectedSedeId(detail.selectedSedeId ?? detail.sedes[0]?.sedeId ?? '')
      setSedeStates(detail.sedes)
    } catch {
      setManagementError(t('superAdmin.users.errors.loadManagementFailed'))
    } finally {
      setManagementLoading(false)
    }
  }

  async function saveEdit() {
    if (!editing || !management) return

    setSaving(true)
    try {
      const res = await fetch(`/api/super-admin/users/${editing.id}/management`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim() || null,
          role: editRole,
          planTier: management.empresa ? editPlanTier : undefined,
          billingCycle: management.empresa ? editBillingCycle : undefined,
          planValidUntil: management.empresa ? (editPlanValidUntil || null) : undefined,
          clearTrial: management.empresa ? editClearTrial : undefined,
          isPaid: management.empresa && editIsPaidTouched ? editIsPaid : undefined,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as ManagementResponse

      if (!res.ok || !('ok' in json) || !json.ok) {
        alert(('error' in json && json.error) || t('superAdmin.users.errors.saveFailed'))
        return
      }

      const detail = json.user
      setItems((prev) => prev.map((item) => item.id === detail.id
        ? {
            ...item,
            name: detail.name,
            role: detail.role,
            empresa: detail.empresa
              ? {
                  id: detail.empresa.id,
                  nombre: detail.empresa.nombre,
                  nit: detail.empresa.nit,
                  planTier: detail.empresa.planTier,
                  planValidUntil: detail.empresa.planValidUntil,
                  trialTier: detail.empresa.trialTier,
                  trialValidUntil: detail.empresa.trialValidUntil,
                }
              : null,
          }
        : item))
      setEditOpen(false)
      resetEditState()
    } catch {
      alert(t('superAdmin.users.errors.saveFailed'))
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

      setItems((prev) => prev.filter((item) => item.id !== row.id))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch {
      alert(t('superAdmin.users.errors.deleteFailed'))
    } finally {
      setDeletingId(null)
    }
  }

  async function viewAsUser(userId: string) {
    setPreviewingUserId(userId)
    const previewWindow = typeof window !== 'undefined'
      ? window.open('', '_blank', 'noopener,noreferrer')
      : null

    try {
      const res = await fetch(`/api/super-admin/users/${userId}/enter-workspace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        accessUrl?: string
      }

      if (!res.ok || !json.ok || !json.accessUrl) {
        if (previewWindow) previewWindow.close()
        alert(json.error || t('superAdmin.users.errors.viewAsUserFailed'))
        return
      }

      if (previewWindow) {
        previewWindow.location.href = json.accessUrl
      } else {
        window.open(json.accessUrl, '_blank', 'noopener,noreferrer')
      }
    } catch {
      if (previewWindow) previewWindow.close()
      alert(t('superAdmin.users.errors.viewAsUserFailed'))
    } finally {
      setPreviewingUserId(null)
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <ErpPageHero
        breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Administración' }, { label: t('superAdmin.users.title') }]}
        eyebrow="Super admin"
        title={t('superAdmin.users.title')}
        description={t('superAdmin.users.subtitle')}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{t('superAdmin.users.list.title')}</CardTitle>
              <CardDescription>{t('superAdmin.users.list.subtitle')}</CardDescription>
            </div>
            <DataViewToggle mode={dataViewMode} onChange={setDataViewMode} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <Input
              placeholder={t('superAdmin.users.searchPlaceholder')}
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
            />
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'NEW', 'TRIAL', 'NO_COMPANY', 'WITH_COMPANY'] as UserSegment[]).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={segment === value ? 'default' : 'outline'}
                  onClick={() => {
                    setPage(1)
                    setSegment(value)
                  }}
                >
                  {t(`superAdmin.users.filters.${value}`)}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : error ? (
            <div className="py-3 text-sm text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="py-6 text-sm text-muted-foreground">{t('superAdmin.users.empty')}</div>
          ) : dataViewMode === 'grid' ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((user) => (
                <Card key={user.id} className="rounded-2xl border bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">{user.name || naText}</div>
                        <div className="mt-1 text-sm text-muted-foreground break-all">{user.email}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{user.role}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {user.isNew ? (
                        <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                          {t('superAdmin.users.badges.new')}
                        </span>
                      ) : null}
                      {isFutureDate(user.empresa?.trialValidUntil) ? (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          {t('superAdmin.users.badges.trial')}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">{t('superAdmin.users.columns.company')}</div>
                        <div className="font-medium text-foreground">{user.empresa?.nombre ?? naText}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{t('superAdmin.users.columns.plan')}</div>
                        <div className="font-medium text-foreground">{user.empresa?.planTier ?? naText}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">{t('superAdmin.users.columns.createdAt')}</div>
                        <div className="font-medium text-foreground">{fmtDate(user.createdAt, locale, naText)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!user.empresa || previewingUserId === user.id}
                        onClick={() => void viewAsUser(user.id)}
                      >
                        {previewingUserId === user.id ? t('common.processing') : t('superAdmin.users.actions.viewAsUser')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => void openEdit(user)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === user.id}
                        onClick={() => void deleteUser(user)}
                      >
                        {deletingId === user.id ? t('superAdmin.users.deleting') : t('common.delete')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] sm:min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">{t('superAdmin.users.columns.user')}</th>
                    <th className="py-2 pr-4">{t('common.email')}</th>
                    <th className="py-2 pr-4">{t('superAdmin.users.columns.company')}</th>
                    <th className="py-2 pr-4">{t('superAdmin.users.columns.plan')}</th>
                    <th className="py-2 pr-4">{t('superAdmin.users.columns.access')}</th>
                    <th className="py-2 pr-4">{t('superAdmin.users.columns.role')}</th>
                    <th className="py-2 pr-4">{t('superAdmin.users.columns.createdAt')}</th>
                    <th className="py-2 text-right">{t('superAdmin.users.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => (
                    <tr key={user.id} className="border-b align-top">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{user.name || naText}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {user.isNew ? (
                            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                              {t('superAdmin.users.badges.new')}
                            </span>
                          ) : null}
                          {isFutureDate(user.empresa?.trialValidUntil) ? (
                            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              {t('superAdmin.users.badges.trial')}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4">
                        {user.empresa ? (
                          <div>
                            <div className="font-medium">{user.empresa.nombre}</div>
                            <div className="text-xs text-muted-foreground">{user.empresa.nit}</div>
                          </div>
                        ) : (
                          naText
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {user.empresa ? (
                          <div>
                            <div className="font-medium">{user.empresa.planTier}</div>
                            <div>{t('superAdmin.users.labels.validUntil')}: {fmtDate(user.empresa.planValidUntil, locale, naText)}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('superAdmin.users.labels.trialUntil')}: {fmtDate(user.empresa.trialValidUntil, locale, naText)}
                            </div>
                          </div>
                        ) : (
                          naText
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {user.empresa ? (
                          <Link href={`/dashboard/configuracion/super-admin/empresas?empresa=${user.empresa.id}`} className="text-primary underline underline-offset-4">
                            {t('superAdmin.companies.actions.viewDetail')}
                          </Link>
                        ) : (
                          naText
                        )}
                      </td>
                      <td className="py-3 pr-4">{user.role}</td>
                      <td className="py-3 pr-4">{fmtDate(user.createdAt, locale, naText)}</td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!user.empresa || previewingUserId === user.id}
                            onClick={() => void viewAsUser(user.id)}
                          >
                            {previewingUserId === user.id ? t('common.processing') : t('superAdmin.users.actions.viewAsUser')}
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => void openEdit(user)}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            disabled={deletingId === user.id}
                            onClick={() => void deleteUser(user)}
                          >
                            {deletingId === user.id ? t('superAdmin.users.deleting') : t('common.delete')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <div>{t('superAdmin.pagination.pageOf', { page: String(page), totalPages: String(totalPages) })}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                {t('common.previous')}
              </Button>
              <Button type="button" variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                {t('common.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(value) => {
        setEditOpen(value)
        if (!value) resetEditState()
      }}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('superAdmin.users.edit.title')}</DialogTitle>
            <DialogDescription>{t('superAdmin.users.edit.description')}</DialogDescription>
          </DialogHeader>

          {managementLoading ? (
            <div className="py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : managementError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{managementError}</div>
          ) : management ? (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="text-sm font-semibold">{t('superAdmin.users.sections.profile')}</div>

                  <div className="space-y-2">
                    <Label htmlFor="super-admin-user-name">{t('superAdmin.users.fields.name')}</Label>
                    <Input id="super-admin-user-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="super-admin-user-role">{t('superAdmin.users.fields.role')}</Label>
                    <select
                      id="super-admin-user-role"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as UserRole)}
                    >
                      {(['ADMIN', 'USER', 'VENDEDOR', 'PRODUCCION', 'CLIENTE'] as UserRole[]).map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-md bg-muted/40 p-3 text-sm">
                    <div className="text-muted-foreground">{t('common.email')}</div>
                    <div className="font-medium">{management.email}</div>
                    <div className="mt-3 text-muted-foreground">{t('superAdmin.users.fields.company')}</div>
                    <div className="font-medium">{management.empresa?.nombre ?? t('superAdmin.users.labels.noCompanyAssigned')}</div>
                    {management.empresa ? <div className="text-xs text-muted-foreground">{management.empresa.nit}</div> : null}
                    {management.empresa ? (
                      <div className="mt-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={previewingUserId === management.id}
                          onClick={() => void viewAsUser(management.id)}
                        >
                          {previewingUserId === management.id ? t('common.processing') : t('superAdmin.users.actions.viewAsUser')}
                        </Button>
                      </div>
                    ) : null}
                    <div className="mt-3 text-muted-foreground">{t('superAdmin.users.columns.createdAt')}</div>
                    <div>{fmtDate(management.createdAt, locale, naText)}</div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                  <div className="text-sm font-semibold">{t('superAdmin.users.sections.plan')}</div>

                  {management.empresa ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="super-admin-plan-tier">{t('superAdmin.users.fields.plan')}</Label>
                          <select
                            id="super-admin-plan-tier"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={editPlanTier}
                            onChange={(e) => setEditPlanTier(e.target.value as PlanTier)}
                          >
                            {(['CRM', 'BASIC', 'MEDIO', 'INTERMEDIO', 'FULL'] as PlanTier[]).map((plan) => (
                              <option key={plan} value={plan}>{plan}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="super-admin-billing-cycle">{t('superAdmin.users.fields.billingCycle')}</Label>
                          <select
                            id="super-admin-billing-cycle"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={editBillingCycle}
                            onChange={(e) => setEditBillingCycle(e.target.value as BillingCycle)}
                          >
                            <option value="MONTHLY">MONTHLY</option>
                            <option value="YEARLY">YEARLY</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="super-admin-plan-valid-until">{t('superAdmin.users.fields.planValidUntil')}</Label>
                        <Input
                          id="super-admin-plan-valid-until"
                          type="date"
                          value={editPlanValidUntil}
                          onChange={(e) => setEditPlanValidUntil(e.target.value)}
                        />
                      </div>

                      <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <div className="font-medium">{t('superAdmin.users.fields.activatePlan')}</div>
                          <div className="text-xs text-muted-foreground">{t('superAdmin.users.fields.activatePlanHelp')}</div>
                        </div>
                        <Switch
                          checked={editIsPaid}
                          onCheckedChange={(checked) => {
                            setEditIsPaid(checked)
                            setEditIsPaidTouched(true)
                          }}
                        />
                      </label>

                      <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <div className="font-medium">{t('superAdmin.users.fields.clearTrial')}</div>
                          <div className="text-xs text-muted-foreground">{t('superAdmin.users.fields.clearTrialHelp')}</div>
                        </div>
                        <Switch checked={editClearTrial} onCheckedChange={setEditClearTrial} />
                      </label>

                      <div className="rounded-md bg-muted/40 p-3 text-sm">
                        <div>
                          {t('superAdmin.users.labels.validUntil')}: <span className="font-medium">{fmtDate(management.empresa.planValidUntil, locale, naText)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {t('superAdmin.users.labels.trialUntil')}: {fmtDate(management.empresa.trialValidUntil, locale, naText)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border p-3 text-sm text-muted-foreground">
                      {t('superAdmin.users.labels.noCompanyAssigned')}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <div>
                  <div className="text-sm font-semibold">{t('superAdmin.users.sections.access')}</div>
                  <div className="text-xs text-muted-foreground">{t('superAdmin.users.fields.accessHelp')}</div>
                </div>

                {sedeStates.length === 0 ? (
                  <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    {t('superAdmin.users.labels.noSedeAssigned')}
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {sedeStates.map((sede) => (
                        <button
                          key={sede.sedeId}
                          type="button"
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedSedeId === sede.sedeId ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                          onClick={() => setSelectedSedeId(sede.sedeId)}
                        >
                          <div className="font-medium">{sede.sedeNombre}</div>
                          <div className="text-xs text-muted-foreground">{t(`rbac.sedeRole.${sede.sedeRole}`)}</div>
                        </button>
                      ))}
                    </div>

                    {selectedSede ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-md border bg-slate-50 p-3 text-sm">
                            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Rol sede</div>
                            <div className="mt-2 font-semibold text-slate-900">{t(`rbac.sedeRole.${selectedSede.sedeRole}`)}</div>
                          </div>
                          <div className="rounded-md border bg-slate-50 p-3 text-sm">
                            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Permiso general</div>
                            <div className="mt-2 font-semibold text-slate-900">{t(`rbac.access.${management.globalAccessLevel}`)}</div>
                          </div>
                          <div className="rounded-md border bg-slate-50 p-3 text-sm">
                            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Regla aplicada</div>
                            <div className="mt-2 font-semibold text-slate-900">{selectedSede.permissionProfile?.name ?? 'Sin regla'}</div>
                          </div>
                        </div>

                        <div className="rounded-md border p-4">
                          <div className="text-sm font-medium text-slate-900">Snapshot centralizado</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Esta vista usa la misma resolución central de permisos que el panel operativo. Para ver exactamente la navegación y accesos resultantes, usa "Ver como usuario" en una nueva ventana.
                          </div>
                          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {Object.entries(selectedSede.initialAccess).length ? Object.entries(selectedSede.initialAccess).map(([moduleKey, level]) => (
                              <div key={moduleKey} className="rounded-md border px-3 py-2 text-sm">
                                <div className="font-medium">{t(`rbac.module.${moduleKey}`)}</div>
                                <div className="text-[11px] text-muted-foreground">{moduleKey}</div>
                                <div className="mt-1 text-xs text-slate-700">Explícito: {t(`rbac.access.${level}`)}</div>
                              </div>
                            )) : (
                              <div className="rounded-md border px-3 py-3 text-sm text-muted-foreground">
                                No hay overrides explícitos por módulo en esta sede.
                              </div>
                            )}
                          </div>
                          <div className="mt-4 rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700">
                            Submódulos/capacidades con override explícito: {Object.keys(selectedSede.initialCapabilities).length}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void saveEdit()} disabled={saving || managementLoading || !management}>
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
