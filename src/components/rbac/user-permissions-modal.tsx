'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Plus } from 'lucide-react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  initialHasSedeAccess: boolean
  initialSedeRole: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'
  modules: ModuleKey[]
  initial: Partial<Record<ModuleKey, AccessLevel>>
  initialGlobalAccess: AccessLevel
  initialCapabilities: Record<string, AccessLevel>
  open?: boolean
  onOpenChange?: (open: boolean) => void
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
  domain: string
  subdomain: string
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

export function UserPermissionsModal({ sedeId, sedeNombre, user, initialHasSedeAccess, initialSedeRole, modules, initial, initialGlobalAccess, initialCapabilities, open: controlledOpen, onOpenChange: controlledOnOpenChange, trigger }: Props) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [internalOpen, setInternalOpen] = useState(false)
  const [levels, setLevels] = useState<Partial<Record<ModuleKey, AccessLevel>>>(initial)
  const [saving, setSaving] = useState<Partial<Record<ModuleKey, boolean>>>({})
  const [hasSedeAccess, setHasSedeAccess] = useState(initialHasSedeAccess)
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
          const primaryCapability = item.capabilities[0]
          if (primaryCapability) {
            current.capabilityEntries.push({
              permissionKey: item.key,
              label: item.label,
              includeLabels: item.includeLabels,
              domain: primaryCapability.domain,
              subdomain: primaryCapability.subdomain,
            })
          }
        } else {
          const primaryCapability = item.capabilities[0]
          byModule.set(item.moduleKey, {
            moduleKey: item.moduleKey,
            submodules: [...item.includeLabels],
            capabilityEntries: primaryCapability
              ? [{
                  permissionKey: item.key,
                  label: item.label,
                  includeLabels: item.includeLabels,
                  domain: primaryCapability.domain,
                  subdomain: primaryCapability.subdomain,
                }]
              : [],
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

  const capabilityAliasesByKey = useMemo(() => {
    const aliases = new Map<string, string[]>()
    const byCapability = new Map<string, string[]>()

    for (const section of sections) {
      for (const entry of section.entries) {
        for (const capability of entry.capabilityEntries) {
          const capabilityId = `${capability.domain}.${capability.subdomain}`
          const current = byCapability.get(capabilityId) ?? []
          current.push(capability.permissionKey)
          byCapability.set(capabilityId, current)
        }
      }
    }

    for (const permissionKeys of byCapability.values()) {
      for (const permissionKey of permissionKeys) {
        aliases.set(permissionKey, permissionKeys)
      }
    }

    return aliases
  }, [sections])

  const moduleSectionCount = sections.reduce((total, section) => total + section.entries.length, 0)
  const capabilityCount = sections.reduce(
    (total, section) => total + section.entries.reduce((entryTotal, entry) => entryTotal + entry.capabilityEntries.length, 0),
    0
  )
  const open = controlledOpen ?? internalOpen

  function handleOpenChange(nextOpen: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen)
      return
    }
    setInternalOpen(nextOpen)
  }

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

  async function updateCapabilityLevel(permissionKey: string, domain: string, subdomain: string, nextLevel: AccessChoice) {
    setSaving((prev) => ({ ...prev, [permissionKey]: true as unknown as boolean }))
    try {
      const res = await fetch('/api/admin/permisos/capability-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sedeId, userId: user.id, domain, subdomain, level: nextLevel }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { level?: AccessLevel | null } } | null
      if (res.ok && json?.success) {
        setCapabilityLevels((prev) => {
          const aliasKeys = capabilityAliasesByKey.get(permissionKey) ?? [permissionKey]
          if (nextLevel === 'INHERIT' || json.data?.level == null) {
            const next = { ...prev }
            for (const aliasKey of aliasKeys) {
              delete next[aliasKey]
            }
            return next
          }

          const next = { ...prev }
          for (const aliasKey of aliasKeys) {
            next[aliasKey] = json.data.level
          }
          return next
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
        setHasSedeAccess(true)
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button type="button" variant="outline" size="icon" aria-label={t('rbac.userPermissions.button')}>
            <Plus className="h-4 w-4" />
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

        <Tabs defaultValue="summary" className="space-y-3">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-slate-100/90 p-1">
            <TabsTrigger value="summary" className="rounded-lg">Resumen</TabsTrigger>
            <TabsTrigger value="access" className="rounded-lg">Accesos</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="max-h-[70vh] space-y-3 overflow-auto pr-1">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estado en sede</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {hasSedeAccess ? t(`rbac.sedeRole.${sedeRole}`) : 'Sin acceso en esta sede'}
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {hasSedeAccess ? `Acceso activo en ${sedeNombre}.` : `Todavía no pertenece a ${sedeNombre}.`}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Permiso general</div>
                <div className="mt-2 text-base font-semibold text-sky-950">{t(`rbac.access.${globalLevel}`)}</div>
                <div className="mt-1 text-xs text-sky-800">Aplica como base a nivel empresa.</div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Cobertura</div>
                <div className="mt-2 text-base font-semibold text-emerald-950">{moduleSectionCount} módulos · {capabilityCount} submódulos</div>
                <div className="mt-1 text-xs text-emerald-800">Puedes afinarlos desde la pestaña de accesos.</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-sm">{t('rbac.userPermissions.section.role')}</div>
              <div className="rounded border px-3 py-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  {hasSedeAccess ? (
                    <div className="text-sm text-muted-foreground">{t('rbac.userPermissions.current')}: {t(`rbac.sedeRole.${sedeRole}`)}</div>
                  ) : (
                    <>
                      <div className="text-sm font-medium text-amber-700">Sin acceso todavía en esta sede</div>
                      <div className="text-xs text-muted-foreground">Asigna un rol aquí para agregar a este usuario a {sedeNombre} y luego habilitar módulos específicos.</div>
                    </>
                  )}
                </div>
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

            {!hasSedeAccess ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Primero asigna un rol en esta sede. Después podrás ajustar módulos y submódulos individuales.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                El rol define la base. En la pestaña de accesos puedes subir, bajar o heredar permisos por módulo según la operación real del usuario.
              </div>
            )}
          </TabsContent>

          <TabsContent value="access" className="max-h-[70vh] space-y-3 overflow-auto pr-1">
            {!hasSedeAccess ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Esta matriz se activa apenas asignes un rol en la sede.
              </div>
            ) : null}

            {sections.map((section) => (
              <section key={section.key} className={cn('space-y-3', section.tone.container)}>
                <div className="flex items-center justify-between gap-3">
                  <div className={cn('font-semibold text-sm uppercase tracking-[0.12em]', section.tone.title)}>{section.title}</div>
                  <div className="text-xs text-slate-500">{section.entries.length} módulo{section.entries.length === 1 ? '' : 's'}</div>
                </div>
                <div className={cn('rounded-xl border shadow-sm', section.tone.panel)}>
                  {section.entries.map((entry) => (
                    <div
                      key={`${section.key}-${entry.moduleKey}`}
                      className="border-b border-inherit px-4 py-3 last:border-b-0"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{t(`rbac.module.${entry.moduleKey}`)}</div>
                          {entry.capabilityEntries.length ? (
                            <div className="mt-1 text-xs text-slate-500">{entry.capabilityEntries.length} submódulo{entry.capabilityEntries.length === 1 ? '' : 's'} configurable{entry.capabilityEntries.length === 1 ? '' : 's'}</div>
                          ) : null}
                        </div>
                        <select
                          className={cn(
                            'w-full rounded-md border px-3 py-2 transition-colors md:w-60',
                            getAccessTone(selectedLevel(entry.moduleKey), effectiveLevel(entry.moduleKey))
                          )}
                          value={selectedLevel(entry.moduleKey)}
                          onChange={(e) => void updateModuleLevel(entry.moduleKey, e.target.value as AccessChoice)}
                          disabled={!hasSedeAccess || Boolean(saving[entry.moduleKey])}
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
                                  onChange={(e) => void updateCapabilityLevel(capability.permissionKey, capability.domain, capability.subdomain, e.target.value as AccessChoice)}
                                  disabled={!hasSedeAccess}
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
