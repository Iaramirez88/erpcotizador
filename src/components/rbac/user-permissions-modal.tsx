'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ModuleKey, type AccessLevel } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  initialHasSedeAccess: boolean
  initialSedeRole: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'
  modules: ModuleKey[]
  initial: Partial<Record<ModuleKey, AccessLevel>>
  initialGlobalAccess: AccessLevel
  initialCapabilities: Record<string, AccessLevel>
  canManagePermissionProfiles?: boolean
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

export function UserPermissionsModal({ sedeId, sedeNombre, user, initialHasSedeAccess, initialSedeRole, modules, initial, initialGlobalAccess, initialCapabilities, canManagePermissionProfiles = false, open: controlledOpen, onOpenChange: controlledOnOpenChange, trigger }: Props) {
  const router = useRouter()
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
  const [showSaveProfileForm, setShowSaveProfileForm] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profileDescription, setProfileDescription] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

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
  const capabilityEditorEntries = useMemo(
    () => sections.flatMap((section) => section.entries.flatMap((entry) => entry.capabilityEntries.map((capability) => ({
      ...capability,
      sectionTitle: section.title,
      moduleKey: entry.moduleKey,
    })))),
    [sections]
  )
  const open = controlledOpen ?? internalOpen

  function getRoleLabel(role: Props['initialSedeRole']) {
    return t(`rbac.sedeRole.${role}`)
  }

  function getAccessLabel(level: AccessChoice | AccessLevel) {
    if (level === 'INHERIT') return 'Heredar del rol de sede'
    return t(`rbac.access.${level}`)
  }

  function getModuleLabel(moduleKey: ModuleKey) {
    return t(`rbac.module.${moduleKey}`)
  }

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

  async function saveAsPermissionProfile() {
    const trimmedName = profileName.trim()
    if (!trimmedName) {
      toast({ title: 'Debes escribir un nombre para la regla.', variant: 'destructive' })
      return
    }

    const moduleLevels = Object.fromEntries(modules.map((moduleKey) => [moduleKey, effectiveLevel(moduleKey)]))
    const capabilityMap = new Map<string, { domain: string; subdomain: string; level: AccessLevel; label: string }>()
    for (const section of sections) {
      for (const entry of section.entries) {
        for (const capability of entry.capabilityEntries) {
          const capabilityId = `${capability.domain}.${capability.subdomain}`
          capabilityMap.set(capabilityId, {
            domain: capability.domain,
            subdomain: capability.subdomain,
            label: capability.label,
            level: capabilityLevels[capability.permissionKey] ?? effectiveLevel(entry.moduleKey),
          })
        }
      }
    }

    setSavingProfile(true)
    try {
      const res = await fetch('/api/admin/permisos/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sedeId,
          name: trimmedName,
          description: profileDescription.trim() || null,
          sedeRole,
          globalAccessLevel: globalLevel,
          moduleLevels,
          capabilityLevels: Object.fromEntries(capabilityMap.entries()),
        }),
      })

      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        toast({ title: json?.error || 'No fue posible guardar la regla.', variant: 'destructive' })
        return
      }

      toast({ title: 'Regla de permisos guardada correctamente.' })
      setShowSaveProfileForm(false)
      setProfileName('')
      setProfileDescription('')
      router.refresh()
    } finally {
      setSavingProfile(false)
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

        <div className="max-h-[78vh] space-y-5 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Estado en sede</div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {hasSedeAccess ? getRoleLabel(sedeRole) : 'Sin acceso en esta sede'}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {hasSedeAccess ? `Acceso activo en ${sedeNombre}.` : `Todavía no pertenece a ${sedeNombre}.`}
              </div>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Permiso general</div>
              <div className="mt-2 text-base font-semibold text-sky-950">{getAccessLabel(globalLevel)}</div>
              <div className="mt-1 text-xs text-sky-800">Aplica como base a nivel empresa.</div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Cobertura</div>
              <div className="mt-2 text-base font-semibold text-emerald-950">{moduleSectionCount} módulos · {capabilityCount} submódulos</div>
              <div className="mt-1 text-xs text-emerald-800">La estructura y el detalle siguen el mismo criterio de las reglas de permisos.</div>
            </div>
          </div>

          {!hasSedeAccess ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <div className="font-semibold">Acceso pendiente en la sede</div>
              <div className="mt-1">Asigna un rol en esta sede para activar el resto de permisos y dejar este usuario con el mismo esquema editable que una regla.</div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Rol sede</Label>
              <select
                value={sedeRole}
                onChange={(e) => {
                  const next = e.target.value as Props['initialSedeRole']
                  setSedeRole(next)
                  void updateRole(next)
                }}
                disabled={savingRole}
                className={cn('mt-2 h-10 w-full rounded-md border px-3 text-sm', getRoleTone(sedeRole))}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {getRoleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Permiso general</Label>
              <select
                value={globalLevel}
                onChange={(e) => {
                  const next = e.target.value as AccessLevel
                  setGlobalLevel(next)
                  void updateGlobalLevel(next)
                }}
                disabled={savingGlobal}
                className={cn('mt-2 h-10 w-full rounded-md border px-3 text-sm', getAccessTone(globalLevel))}
              >
                {ACCESS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getAccessLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Permisos por módulo</div>
              <div className="text-xs text-slate-500">Mismo esquema visual de las reglas, con la diferencia de que aquí puedes heredar del rol base de la sede.</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((moduleKey) => (
                <div key={moduleKey} className="rounded-xl border border-slate-200 p-3">
                  <Label>{getModuleLabel(moduleKey)}</Label>
                  <select
                    value={selectedLevel(moduleKey)}
                    onChange={(e) => void updateModuleLevel(moduleKey, e.target.value as AccessChoice)}
                    disabled={!hasSedeAccess || Boolean(saving[moduleKey])}
                    className={cn('mt-2 h-10 w-full rounded-md border px-3 text-sm', getAccessTone(selectedLevel(moduleKey), effectiveLevel(moduleKey)))}
                  >
                    <option value="INHERIT">{getAccessLabel('INHERIT')}</option>
                    {ACCESS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {getAccessLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">Permisos por submódulo</div>
              <div className="text-xs text-slate-500">Los cambios aquí tienen prioridad sobre el nivel base del módulo, igual que en las reglas de permisos.</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {capabilityEditorEntries.map((capability) => {
                const value = capabilityLevels[capability.permissionKey] ?? 'INHERIT'
                const currentLevel = capabilityLevels[capability.permissionKey] ?? effectiveLevel(capability.moduleKey)
                return (
                  <div key={capability.permissionKey} className="rounded-xl border border-slate-200 p-3">
                    <div className="text-sm font-medium text-slate-950">{capability.label}</div>
                    <div className="text-xs text-slate-500">{capability.sectionTitle} · {getModuleLabel(capability.moduleKey)}</div>
                    <select
                      value={value}
                      onChange={(e) => void updateCapabilityLevel(capability.permissionKey, capability.domain, capability.subdomain, e.target.value as AccessChoice)}
                      disabled={!hasSedeAccess}
                      className={cn('mt-2 h-10 w-full rounded-md border px-3 text-sm', getAccessTone(value, currentLevel))}
                    >
                      <option value="INHERIT">{getAccessLabel('INHERIT')}</option>
                      {ACCESS_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {getAccessLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {canManagePermissionProfiles ? (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-950">Guardar como regla de permisos</div>
                <div className="text-xs text-slate-600">Úsala después para aplicar este mismo esquema a muchos usuarios de la sede.</div>
              </div>
              <Button type="button" variant="outline" onClick={() => setShowSaveProfileForm((current) => !current)}>
                {showSaveProfileForm ? 'Ocultar' : 'Guardar como regla'}
              </Button>
            </div>

            {showSaveProfileForm ? (
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Nombre</label>
                  <Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Ejemplo: Diseñador" />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Descripción</label>
                  <Input value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} placeholder="Permisos estándar para diseño y producción visual" />
                </div>
                <Button type="button" onClick={() => void saveAsPermissionProfile()} disabled={savingProfile || !profileName.trim()}>
                  {savingProfile ? 'Guardando...' : 'Guardar regla'}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
