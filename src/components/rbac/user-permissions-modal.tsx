'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ModuleKey, type AccessLevel } from '@prisma/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useI18n } from '@/components/providers/i18n-provider'
import { useToast } from '@/hooks/use-toast'
import { buildDashboardPermissionEntries } from '@/lib/dashboard-permission-catalog'
import { cn } from '@/lib/utils'

type UserRef = {
  id: string
  name: string | null
  email: string
}

type Props = {
  sedeId: string
  sedeNombre: string
  user: UserRef
  initialSedeRole: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'
  modules: ModuleKey[]
  initial: Partial<Record<ModuleKey, AccessLevel>>
  initialGlobalAccess: AccessLevel
  initialCapabilities: Record<string, AccessLevel>
  trigger?: ReactNode
}

type Section = {
  key: string
  title: string
  entries: ModuleEntry[]
  tone: {
    container: string
    title: string
    panel: string
  }
}

type ModuleEntry = {
  moduleKey: ModuleKey
  submodules: string[]
  capabilityEntries: CapabilityEntry[]
}

type CapabilityEntry = {
  permissionKey: string
  label: string
  includeLabels: string[]
}

type AccessChoice = AccessLevel | 'INHERIT'

const ACCESS_OPTIONS: AccessLevel[] = ['NONE', 'READ', 'WRITE', 'ADMIN']

const SECTION_TONES = [
  {
    container: 'rounded-2xl border border-sky-200 bg-sky-50/70 p-3',
    title: 'text-sky-900',
    panel: 'border-sky-200/90 bg-white/95',
  },
  {
    container: 'rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3',
    title: 'text-emerald-900',
    panel: 'border-emerald-200/90 bg-white/95',
  },
  {
    container: 'rounded-2xl border border-amber-200 bg-amber-50/70 p-3',
    title: 'text-amber-900',
    panel: 'border-amber-200/90 bg-white/95',
  },
  {
    container: 'rounded-2xl border border-fuchsia-200 bg-fuchsia-50/70 p-3',
    title: 'text-fuchsia-900',
    panel: 'border-fuchsia-200/90 bg-white/95',
  },
  {
    container: 'rounded-2xl border border-slate-200 bg-slate-50/80 p-3',
    title: 'text-slate-900',
    panel: 'border-slate-200/90 bg-white/95',
  },
] as const

function getAccessTone(level: AccessChoice | AccessLevel, fallbackLevel?: AccessLevel) {
  const resolved = level === 'INHERIT' ? (fallbackLevel ?? 'READ') : level

  switch (resolved) {
    case 'ADMIN':
      return 'border-lime-300 bg-lime-100 text-lime-950 hover:bg-lime-100 focus-visible:ring-lime-300'
    case 'WRITE':
      return 'border-teal-300 bg-teal-100 text-teal-950 hover:bg-teal-100 focus-visible:ring-teal-300'
    case 'READ':
      return 'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-100 focus-visible:ring-amber-300'
    case 'NONE':
      return 'border-rose-300 bg-rose-100 text-rose-950 hover:bg-rose-100 focus-visible:ring-rose-300'
    default:
      return 'border-slate-300 bg-white text-slate-900 focus-visible:ring-slate-300'
  }
}

function getRoleTone(role: Props['initialSedeRole']) {
  return getAccessTone(baseAccessForSedeRole(role))
}

function baseAccessForSedeRole(role: Props['initialSedeRole']): AccessLevel {
  switch (role) {
    case 'ADMIN':
      return 'ADMIN'
    case 'MANAGER':
      return 'WRITE'
    case 'MEMBER':
      return 'WRITE'
    case 'READER':
    default:
      return 'READ'
  }
}

function hasExplicitLevel(levels: Partial<Record<ModuleKey, AccessLevel>>, moduleKey: ModuleKey) {
  return Object.prototype.hasOwnProperty.call(levels, moduleKey)
}

export function UserPermissionsModal({ sedeId, sedeNombre, user, initialSedeRole, modules, initial, initialGlobalAccess, initialCapabilities, trigger }: Props) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [levels, setLevels] = useState<Partial<Record<ModuleKey, AccessLevel>>>(initial)
  const [saving, setSaving] = useState<Partial<Record<ModuleKey, boolean>>>({})
  const [sedeRole, setSedeRole] = useState<Props['initialSedeRole']>(initialSedeRole)
  const [savingRole, setSavingRole] = useState(false)
  const [globalLevel, setGlobalLevel] = useState<AccessLevel>(initialGlobalAccess)
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [capabilityLevels, setCapabilityLevels] = useState<Record<string, AccessLevel>>(initialCapabilities)

  const baseLevel = useMemo(() => baseAccessForSedeRole(sedeRole), [sedeRole])

  const effectiveLevel = (moduleKey: ModuleKey): AccessLevel => {
    const explicit = levels[moduleKey]
    return hasExplicitLevel(levels, moduleKey) ? (explicit ?? 'NONE') : baseLevel
  }

  const selectedLevel = (moduleKey: ModuleKey): AccessChoice => {
    return hasExplicitLevel(levels, moduleKey) ? (levels[moduleKey] ?? 'NONE') : 'INHERIT'
  }

  const roleOptions: Props['initialSedeRole'][] = ['ADMIN', 'MANAGER', 'MEMBER', 'READER']

  const sections: Section[] = useMemo(
    () => {
      const allowedModules = new Set<ModuleKey>(modules)
      const grouped = new Map<string, Map<ModuleKey, ModuleEntry>>()

      for (const item of buildDashboardPermissionEntries({ t })) {
        if (!allowedModules.has(item.moduleKey)) continue
        const byModule = grouped.get(item.section) ?? new Map<ModuleKey, ModuleEntry>()
        const current = byModule.get(item.moduleKey)
        if (current) {
          current.submodules.push(...item.includeLabels.filter((label) => !current.submodules.includes(label)))
          current.capabilityEntries.push({
            permissionKey: item.key,
            label: item.label,
            includeLabels: item.includeLabels,
          })
        } else {
          byModule.set(item.moduleKey, {
            moduleKey: item.moduleKey,
            submodules: [...item.includeLabels],
            capabilityEntries: [{
              permissionKey: item.key,
              label: item.label,
              includeLabels: item.includeLabels,
            }],
          })
        }
        grouped.set(item.section, byModule)
      }

      const orderedSections = Array.from(grouped.entries()).map(([key, value], index) => ({
        key,
        title: key,
        entries: [...value.values()],
        tone: SECTION_TONES[index % SECTION_TONES.length],
      }))

      const knownModules = new Set(orderedSections.flatMap((section) => section.entries.map((entry) => entry.moduleKey)))
      const extraEntries = modules.filter((moduleKey) => !knownModules.has(moduleKey)).map((moduleKey) => ({
        moduleKey,
        submodules: [],
        capabilityEntries: [],
      }))

      return extraEntries.length
        ? [
            ...orderedSections,
            {
              key: 'Otros',
              title: t('rbac.userPermissions.section.other'),
              entries: extraEntries,
              tone: SECTION_TONES[orderedSections.length % SECTION_TONES.length],
            },
          ]
        : orderedSections
    },
    [modules, t]
  )

  async function updateModuleLevel(moduleKey: ModuleKey, value: AccessChoice) {
    setSaving((prev) => ({ ...prev, [moduleKey]: true }))
    try {
      const res = await fetch('/api/admin/permisos/module-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sedeId, userId: user.id, module: moduleKey, level: value }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { level?: AccessLevel | null } } | null
      if (res.ok && json?.success) {
        setLevels((prev) => {
          if (value === 'INHERIT' || json.data?.level == null) {
            const next = { ...prev }
            delete next[moduleKey]
            return next
          }

          return { ...prev, [moduleKey]: json.data.level }
        })
        toast({ title: 'Permiso actualizado correctamente' })
      } else {
        toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
    } finally {
      setSaving((prev) => ({ ...prev, [moduleKey]: false }))
    }
  }

  async function updateGlobalLevel(nextLevel: AccessLevel) {
    setSavingGlobal(true)
    try {
      const res = await fetch('/api/admin/permisos/global-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, level: nextLevel }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { level?: AccessLevel } } | null
      if (res.ok && json?.success) {
        setGlobalLevel(json.data?.level ?? nextLevel)
        toast({ title: 'Permiso actualizado correctamente' })
      } else {
        toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
    } finally {
      setSavingGlobal(false)
    }
  }

  async function updateCapabilityLevel(permissionKey: string, nextLevel: AccessChoice) {
    setSaving((prev) => ({ ...prev, [permissionKey]: true as unknown as boolean }))
    try {
      const [domain, subdomain] = permissionKey.split('.') as [string, string, string?]
      const res = await fetch('/api/admin/permisos/capability-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sedeId, userId: user.id, domain, subdomain, level: nextLevel }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { level?: AccessLevel | null } } | null
      if (res.ok && json?.success) {
        setCapabilityLevels((prev) => {
          if (nextLevel === 'INHERIT' || json.data?.level == null) {
            const next = { ...prev }
            delete next[permissionKey]
            return next
          }
          return { ...prev, [permissionKey]: json.data.level }
        })
        toast({ title: 'Permiso actualizado correctamente' })
      } else {
        toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
    } finally {
      setSaving((prev) => {
        const next = { ...prev }
        delete next[permissionKey as unknown as ModuleKey]
        return next
      })
    }
  }

  async function updateRole(nextRole: Props['initialSedeRole']) {
    setSavingRole(true)
    try {
      const res = await fetch('/api/admin/permisos/sede-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sedeId, userId: user.id, role: nextRole }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { role?: Props['initialSedeRole'] } } | null
      if (res.ok && json?.success) {
        setSedeRole(json.data?.role ?? nextRole)
        toast({ title: 'Permiso actualizado correctamente' })
      } else {
        toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' })
    } finally {
      setSavingRole(false)
    }
  }

  const displayName = user.name ?? user.email

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button type="button" variant="outline" size="sm">
            {t('rbac.userPermissions.button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-6xl">
        <DialogHeader>
          <DialogTitle>{t('rbac.userPermissions.title')}</DialogTitle>
          <DialogDescription>
            {displayName} · {t('rbac.userPermissions.sede', { sede: sedeNombre })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto pr-1 space-y-3">
          <div className="space-y-2">
            <div className="font-semibold text-sm">{t('rbac.userPermissions.section.role')}</div>
            <div className="rounded border px-3 py-2 flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">{t('rbac.userPermissions.current')}: {t(`rbac.sedeRole.${sedeRole}`)}</div>
              <select
                className={cn(
                  'rounded-md border px-3 py-2 transition-colors',
                  getRoleTone(sedeRole)
                )}
                value={sedeRole}
                onChange={(e) => {
                  const next = e.target.value as Props['initialSedeRole']
                  setSedeRole(next)
                  void updateRole(next)
                }}
                disabled={savingRole}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {t(`rbac.sedeRole.${r}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-sm">{t('rbac.globalAccess.title')}</div>
            <div className="rounded border px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">{t('rbac.userPermissions.current')}: {t(`rbac.access.${globalLevel}`)}</div>
              <select
                className={cn(
                  'rounded-md border px-3 py-2 transition-colors',
                  getAccessTone(globalLevel)
                )}
                value={globalLevel}
                onChange={(e) => {
                  const next = e.target.value as AccessLevel
                  setGlobalLevel(next)
                  void updateGlobalLevel(next)
                }}
                disabled={savingGlobal}
              >
                {ACCESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {t(`rbac.access.${option}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-muted-foreground">{t('rbac.userPermissions.generalHint')}</div>
          </div>

          {sections.map((section) => (
            <section key={section.key} className={cn('space-y-3', section.tone.container)}>
              <div className={cn('font-semibold text-sm uppercase tracking-[0.12em]', section.tone.title)}>{section.title}</div>
              <div className={cn('rounded-xl border shadow-sm', section.tone.panel)}>
                {section.entries.map((entry) => (
                  <div
                    key={`${section.key}-${entry.moduleKey}`}
                    className="border-b border-inherit px-4 py-3 last:border-b-0"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t(`rbac.module.${entry.moduleKey}`)}</div>
                      </div>
                      <select
                        className={cn(
                          'w-full rounded-md border px-3 py-2 transition-colors md:w-60',
                          getAccessTone(selectedLevel(entry.moduleKey), effectiveLevel(entry.moduleKey))
                        )}
                        value={selectedLevel(entry.moduleKey)}
                        onChange={(e) => void updateModuleLevel(entry.moduleKey, e.target.value as AccessChoice)}
                        disabled={Boolean(saving[entry.moduleKey])}
                      >
                        <option value="INHERIT">{t('rbac.userPermissions.inherit')}</option>
                        {ACCESS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {t(`rbac.access.${option}`)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {entry.capabilityEntries.length ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('rbac.userPermissions.section.submodules')}</div>
                        {entry.capabilityEntries.map((capability) => {
                          const value = capabilityLevels[capability.permissionKey] ?? 'INHERIT'
                          const currentLevel = capabilityLevels[capability.permissionKey] ?? effectiveLevel(entry.moduleKey)
                          return (
                            <div key={capability.permissionKey} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{capability.label}</div>
                              </div>
                              <select
                                className={cn(
                                  'w-full rounded-md border px-3 py-2 transition-colors md:w-60',
                                  getAccessTone(value, currentLevel)
                                )}
                                value={value}
                                onChange={(e) => void updateCapabilityLevel(capability.permissionKey, e.target.value as AccessChoice)}
                              >
                                <option value="INHERIT">{t('rbac.userPermissions.inherit')}</option>
                                {ACCESS_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {t(`rbac.access.${option}`)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
