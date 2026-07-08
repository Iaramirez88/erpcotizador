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
import { buildDashboardPermissionEntries } from '@/lib/dashboard-access'

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

      const orderedSections = Array.from(grouped.entries()).map(([key, value]) => ({
        key,
        title: key,
        entries: [...value.values()],
      }))

      const knownModules = new Set(orderedSections.flatMap((section) => section.entries.map((entry) => entry.moduleKey)))
      const extraEntries = modules.filter((moduleKey) => !knownModules.has(moduleKey)).map((moduleKey) => ({
        moduleKey,
        submodules: [],
        capabilityEntries: [],
      }))

      return extraEntries.length
        ? [...orderedSections, { key: 'Otros', title: t('rbac.userPermissions.section.other'), entries: extraEntries }]
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
      }
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
      }
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
      }
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
      }
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
      <DialogContent className="max-w-2xl">
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
                className="px-3 py-2 border rounded-md"
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
                className="px-3 py-2 border rounded-md"
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
            <div key={section.key} className="space-y-2">
              <div className="font-semibold text-sm">{section.title}</div>
              <div className="rounded border">
                {section.entries.map((entry) => (
                  <div
                    key={`${section.key}-${entry.moduleKey}`}
                    className="border-b px-3 py-2 last:border-b-0"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{t(`rbac.module.${entry.moduleKey}`)}</div>
                        <div className="text-xs text-muted-foreground">
                          {hasExplicitLevel(levels, entry.moduleKey)
                            ? `${t('rbac.userPermissions.current')}: ${t(`rbac.access.${effectiveLevel(entry.moduleKey)}`)}`
                            : `${t('rbac.userPermissions.inherited')}: ${t(`rbac.access.${baseLevel}`)}`}
                        </div>
                        {entry.submodules.length ? (
                          <div className="text-xs text-muted-foreground">
                            {t('rbac.userPermissions.includes')}: {entry.submodules.join(', ')}
                          </div>
                        ) : null}
                      </div>
                      <select
                        className="w-full rounded-md border px-3 py-2 md:w-52"
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
                      <div className="mt-3 space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/60 p-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t('rbac.userPermissions.section.submodules')}</div>
                        {entry.capabilityEntries.map((capability) => {
                          const value = capabilityLevels[capability.permissionKey] ?? 'INHERIT'
                          const currentLevel = capabilityLevels[capability.permissionKey] ?? effectiveLevel(entry.moduleKey)
                          return (
                            <div key={capability.permissionKey} className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 md:flex-row md:items-center md:justify-between">
                              <div className="min-w-0">
                                <div className="text-sm font-medium">{capability.label}</div>
                                <div className="text-xs text-muted-foreground">{t('rbac.userPermissions.current')}: {t(`rbac.access.${currentLevel}`)}</div>
                                <div className="text-xs text-muted-foreground">{t('rbac.userPermissions.includes')}: {capability.includeLabels.join(', ')}</div>
                              </div>
                              <select
                                className="w-full rounded-md border px-3 py-2 md:w-52"
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
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
