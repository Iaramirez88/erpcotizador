'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArchiveRestore, CalendarRange, Database, Download, HardDriveDownload, History, Loader2, ShieldCheck, Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type AccessState = {
  isAdmin: boolean
  hasGrant: boolean
  canExport: boolean
  canImport: boolean
}

type BackupModule = {
  id: string
  label: string
  description: string
}

type BackupRow = {
  id: string
  format: 'SQL' | 'XLSX'
  triggerSource: 'AUTO' | 'MANUAL' | 'IMPORT'
  fileName: string
  bytes: number
  rowsCount: number
  periodStart: string | null
  periodEnd: string | null
  importedAt: string | null
  createdAt: string
  createdByUser: { id: string; name: string | null; email: string | null } | null
  importedByUser: { id: string; name: string | null; email: string | null } | null
  modulesJson: string[]
}

type AccessUserRow = {
  id: string
  name: string | null
  email: string | null
  isAdmin: boolean
  hasGrant: boolean
  allowImport: boolean
  grantedAt: string | null
}

type SummaryResponse = {
  modules: BackupModule[]
  access: AccessState
  backups: BackupRow[]
  accessUsers: AccessUserRow[]
}

type EstimateResponse = {
  estimatedBytes: number
  rowsCount: number
  modelsCount: number
}

const MODULE_ICONS: Record<string, typeof Database> = {
  PLATAFORMA: ShieldCheck,
  VENTAS: HardDriveDownload,
  CRM: History,
  OPERACIONES: Database,
  RECURSOS: Download,
  CONTABILIDAD: CalendarRange,
  VERTICALES: ArchiveRestore,
  COTIZADOR: Database,
}

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin fecha'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function currentMonthStart() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
}

function normalizeSearchValue(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-sm">
      <span className="text-slate-500">Página {page} de {totalPages}</span>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </div>
  )
}

export function RespaldoClient({ initialAccess }: { initialAccess: AccessState }) {
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [format, setFormat] = useState<'SQL' | 'XLSX'>('SQL')
  const [from, setFrom] = useState(() => toLocalInputValue(currentMonthStart()))
  const [to, setTo] = useState(() => toLocalInputValue(new Date()))
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null)
  const [estimating, setEstimating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [backupPage, setBackupPage] = useState(1)
  const [accessPage, setAccessPage] = useState(1)
  const [accessSearch, setAccessSearch] = useState('')
  const progressTimerRef = useRef<number | null>(null)

  async function loadSummary() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/respaldo', { cache: 'no-store' })
      const json = (await response.json().catch(() => null)) as { success?: boolean; data?: SummaryResponse; error?: string } | null
      if (!response.ok || !json?.success || !json.data) {
        throw new Error(json?.error || 'No se pudo cargar el módulo de respaldo.')
      }
      const data = json.data
      setSummary(data)
      setSelectedModules((current) => current.length ? current : data.modules.map((item) => item.id))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el módulo de respaldo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSummary()
  }, [])

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current)
      }
    }
  }, [])

  const modules = summary?.modules ?? []
  const backups = summary?.backups ?? []
  const accessUsers = summary?.accessUsers ?? []
  const access = summary?.access ?? initialAccess

  const automaticBackups = useMemo(() => backups.filter((item) => item.triggerSource === 'AUTO'), [backups])
  const manualBackups = useMemo(() => backups.filter((item) => item.triggerSource === 'MANUAL'), [backups])
  const importHistory = useMemo(() => backups.filter((item) => item.triggerSource === 'IMPORT'), [backups])
  const filteredAccessUsers = useMemo(() => {
    const query = normalizeSearchValue(accessSearch)
    if (!query) return accessUsers
    return accessUsers.filter((user) => {
      const haystack = normalizeSearchValue(`${user.name || ''} ${user.email || ''}`)
      return haystack.includes(query)
    })
  }, [accessSearch, accessUsers])

  const backupsPerPage = 5
  const accessUsersPerPage = 5
  const backupTotalPages = Math.max(1, Math.ceil(backups.length / backupsPerPage))
  const accessTotalPages = Math.max(1, Math.ceil(filteredAccessUsers.length / accessUsersPerPage))
  const paginatedBackups = useMemo(() => {
    const start = (backupPage - 1) * backupsPerPage
    return backups.slice(start, start + backupsPerPage)
  }, [backupPage, backups])
  const paginatedAccessUsers = useMemo(() => {
    const start = (accessPage - 1) * accessUsersPerPage
    return filteredAccessUsers.slice(start, start + accessUsersPerPage)
  }, [accessPage, filteredAccessUsers])

  useEffect(() => {
    setBackupPage(1)
  }, [backups.length])

  useEffect(() => {
    setAccessPage(1)
  }, [accessSearch, filteredAccessUsers.length])

  function toggleModule(moduleId: string) {
    setSelectedModules((current) => current.includes(moduleId)
      ? current.filter((item) => item !== moduleId)
      : [...current, moduleId])
  }

  async function handleEstimate() {
    setEstimating(true)
    setError(null)
    try {
      const response = await fetch('/api/respaldo/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleIds: selectedModules, from, to }),
      })
      const json = (await response.json().catch(() => null)) as { success?: boolean; data?: EstimateResponse; error?: string } | null
      if (!response.ok || !json?.success || !json.data) {
        throw new Error(json?.error || 'No se pudo estimar el respaldo.')
      }
      setEstimate(json.data)
    } catch (estimateError) {
      setError(estimateError instanceof Error ? estimateError.message : 'No se pudo estimar el respaldo.')
    } finally {
      setEstimating(false)
    }
  }

  async function handleExport() {
    setExporting(true)
    setError(null)
    setProgress(8)
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => Math.min(current + 7, 92))
    }, 240)

    try {
      const response = await fetch('/api/respaldo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, moduleIds: selectedModules, from, to }),
      })
      const json = (await response.json().catch(() => null)) as { success?: boolean; data?: { id: string }; error?: string } | null
      if (!response.ok || !json?.success || !json.data?.id) {
        throw new Error(json?.error || 'No se pudo crear el respaldo.')
      }
      setProgress(100)
      window.location.href = `/api/respaldo/download/${json.data.id}`
      await loadSummary()
      await handleEstimate()
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo crear el respaldo.')
    } finally {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      window.setTimeout(() => setProgress(0), 900)
      setExporting(false)
    }
  }

  async function handleImport() {
    if (!uploadFile) return
    setImporting(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      const response = await fetch('/api/respaldo/import', { method: 'POST', body: form })
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo restaurar el respaldo.')
      }
      setUploadFile(null)
      await loadSummary()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudo restaurar el respaldo.')
    } finally {
      setImporting(false)
    }
  }

  async function updateAccess(userId: string, enabled: boolean, allowImport: boolean) {
    setError(null)
    try {
      const response = await fetch('/api/respaldo/access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, enabled, allowImport }),
      })
      const json = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || 'No se pudo actualizar el permiso.')
      }
      await loadSummary()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el permiso.')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando módulo de respaldo...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 px-3 pb-5 lg:px-4">
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {modules.map((moduleItem) => {
              const Icon = MODULE_ICONS[moduleItem.id] ?? Database
              const active = selectedModules.includes(moduleItem.id)
              return (
                <button
                  key={moduleItem.id}
                  type="button"
                  onClick={() => toggleModule(moduleItem.id)}
                  className={cn(
                    'rounded-[28px] border px-5 py-6 text-left transition-all',
                    active
                      ? 'border-emerald-600 bg-[linear-gradient(180deg,_rgba(220,252,231,0.98),_rgba(236,253,245,0.94))] shadow-[0_18px_35px_-18px_rgba(5,150,105,0.58)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  )}
                >
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-2xl',
                    active ? 'bg-emerald-600 text-white' : 'bg-sky-100 text-sky-700'
                  )}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-slate-950">{moduleItem.label}</div>
                  <div className="mt-2 text-sm leading-5 text-slate-600">{moduleItem.description}</div>
                  <div className={cn('mt-4 text-xs font-medium', active ? 'text-emerald-700' : 'text-slate-500')}>
                    {active ? 'Incluido en el respaldo' : 'Toca para incluirlo'}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="backup-from">Desde</Label>
                  <Input id="backup-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="backup-to">Hasta</Label>
                  <Input id="backup-to" type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="backup-format">Formato</Label>
                  <select
                    id="backup-format"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={format}
                    onChange={(e) => setFormat(e.target.value === 'XLSX' ? 'XLSX' : 'SQL')}
                  >
                    <option value="SQL">SQL</option>
                    <option value="XLSX">Excel</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label>Módulos seleccionados</Label>
                  <div className="flex items-center rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                    {selectedModules.length} de {modules.length} módulo(s)
                  </div>
                </div>
              </div>

              {progress > 0 ? (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-700">
                    <span>Preparando descarga del respaldo...</span>
                    <span className="font-semibold text-sky-700">{progress}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,_#0ea5e9,_#2563eb)] transition-[width] duration-200" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void handleEstimate()} disabled={estimating || !selectedModules.length}>
                  {estimating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Calcular peso
                </Button>
                <Button type="button" onClick={() => void handleExport()} disabled={exporting || !selectedModules.length}>
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HardDriveDownload className="mr-2 h-4 w-4" />}
                  Crear respaldo y descargar
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-950">Estimación del respaldo</div>
              <div className="mt-3 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Peso estimado</div>
                  <div className="mt-1 text-2xl font-semibold text-slate-950">{formatBytes(estimate?.estimatedBytes ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Filas estimadas</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{estimate?.rowsCount ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.14em] text-slate-500">Modelos incluidos</div>
                  <div className="mt-1 text-xl font-semibold text-slate-950">{estimate?.modelsCount ?? 0}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Historial de respaldos</CardTitle>
            <CardDescription>Incluye automáticos mensuales, manuales generados por usuarios y restauraciones ejecutadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {paginatedBackups.length ? paginatedBackups.map((backup) => (
              <div key={backup.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-950">{backup.fileName}</span>
                      <span className={cn(
                        'rounded-full px-2 py-1 text-[11px] font-semibold',
                        backup.triggerSource === 'AUTO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : backup.triggerSource === 'IMPORT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-800'
                      )}>{backup.triggerSource}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{backup.format}</span>
                    </div>
                    <div className="text-xs text-slate-500">Creado {formatDate(backup.createdAt)}</div>
                    <div className="text-xs text-slate-500">Período: {formatDate(backup.periodStart)} a {formatDate(backup.periodEnd)}</div>
                    <div className="text-xs text-slate-500">Actor: {backup.createdByUser?.name || backup.createdByUser?.email || 'Automático del sistema'}</div>
                    <div className="text-xs text-slate-500">Peso: {formatBytes(backup.bytes)} · Filas: {backup.rowsCount}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => { window.location.href = `/api/respaldo/download/${backup.id}` }}>
                      <Download className="mr-2 h-4 w-4" />
                      Descargar
                    </Button>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-slate-500">Aún no hay respaldos registrados.</div>}
            <PaginationControls page={backupPage} totalPages={backupTotalPages} onPageChange={setBackupPage} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurar respaldo</CardTitle>
              <CardDescription>Sube un SQL generado por SGDigital. El proceso reescribe los datos actuales de esta empresa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="restore-file">Archivo .sql</Label>
                <Input id="restore-file" type="file" accept=".sql,application/sql,text/plain" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button type="button" onClick={() => void handleImport()} disabled={!access.canImport || importing || !uploadFile}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Restaurar respaldo
              </Button>
              {!access.canImport ? <div className="text-xs text-amber-700">Tu usuario puede generar respaldos, pero no restaurarlos.</div> : null}
            </CardContent>
          </Card>

          {access.isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle>Usuarios autorizados</CardTitle>
                <CardDescription>Los administradores pueden dar acceso exclusivo para generar respaldos y, si aplica, restaurarlos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="backup-access-search">Buscar usuario</Label>
                  <Input
                    id="backup-access-search"
                    placeholder="Nombre o correo"
                    value={accessSearch}
                    onChange={(e) => setAccessSearch(e.target.value)}
                  />
                </div>
                {paginatedAccessUsers.length ? paginatedAccessUsers.map((user) => (
                  <div key={user.id} className="rounded-2xl border border-slate-200 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{user.name || user.email || 'Usuario sin nombre'}</div>
                        <div className="text-xs text-slate-500">{user.email || 'Sin correo'}{user.isAdmin ? ' · Administrador' : ''}</div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.isAdmin || user.hasGrant}
                            disabled={user.isAdmin}
                            onChange={(e) => void updateAccess(user.id, e.target.checked, user.allowImport)}
                          />
                          Respaldo
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={user.isAdmin || user.allowImport}
                            disabled={user.isAdmin || !(user.isAdmin || user.hasGrant)}
                            onChange={(e) => void updateAccess(user.id, true, e.target.checked)}
                          />
                          Restaurar
                        </label>
                      </div>
                    </div>
                  </div>
                )) : <div className="text-sm text-slate-500">No hay usuarios que coincidan con la búsqueda.</div>}
                <PaginationControls page={accessPage} totalPages={accessTotalPages} onPageChange={setAccessPage} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}