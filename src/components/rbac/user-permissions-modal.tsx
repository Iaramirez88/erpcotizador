'use client'

import { useMemo, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { useI18n } from '@/components/providers/i18n-provider'

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
}

type Section = {
  key: string
  title: string
  modules: ModuleKey[]
}

function isEnabled(level: AccessLevel | undefined): boolean {
  return (level ?? 'NONE') !== 'NONE'
}

export function UserPermissionsModal({ sedeId, sedeNombre, user, initialSedeRole, modules, initial }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [levels, setLevels] = useState<Partial<Record<ModuleKey, AccessLevel>>>(initial)
  const [saving, setSaving] = useState<Partial<Record<ModuleKey, boolean>>>({})
  const [sedeRole, setSedeRole] = useState<Props['initialSedeRole']>(initialSedeRole)
  const [savingRole, setSavingRole] = useState(false)

  const sections: Section[] = useMemo(
    () => [
      {
        key: 'comercial',
        title: t('rbac.userPermissions.section.commercial'),
        modules: ['COTIZADOR', 'COTIZACIONES', 'CLIENTES'],
      },
      {
        key: 'produccion',
        title: t('rbac.userPermissions.section.production'),
        modules: ['ORDENES', 'REMISIONES', 'INVENTARIO', 'MATERIALES'],
      },
      {
        key: 'compras',
        title: t('rbac.userPermissions.section.purchases'),
        modules: ['COMPRAS', 'PROVEEDORES'],
      },
      {
        key: 'operacion',
        title: t('rbac.userPermissions.section.operations'),
        modules: ['DASHBOARD', 'POS', 'ESCANEOS', 'REPORTES', 'NOTIFICACIONES', 'CONFIG'],
      },
    ],
    [t]
  )

  const used = useMemo(() => new Set(sections.flatMap((s) => s.modules)), [sections])
  const extraModules = useMemo(() => modules.filter((m) => !used.has(m)), [modules, used])

  async function toggle(moduleKey: ModuleKey, enabled: boolean) {
    setSaving((prev) => ({ ...prev, [moduleKey]: true }))
    try {
      const res = await fetch('/api/admin/permisos/module-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sedeId, userId: user.id, module: moduleKey, enabled }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { level?: AccessLevel } } | null
      if (res.ok && json?.success) {
        setLevels((prev) => ({ ...prev, [moduleKey]: json.data?.level ?? (enabled ? 'READ' : 'NONE') }))
      }
    } finally {
      setSaving((prev) => ({ ...prev, [moduleKey]: false }))
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
        <Button type="button" variant="outline" size="sm">
          {t('rbac.userPermissions.button')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('rbac.userPermissions.title')}</DialogTitle>
          <DialogDescription>
            {displayName} · {t('rbac.userPermissions.sede', { sede: sedeNombre })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto pr-1 space-y-4">
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
                <option value="ADMIN">{t('rbac.sedeRole.ADMIN')}</option>
                <option value="MANAGER">{t('rbac.sedeRole.MANAGER')}</option>
                <option value="MEMBER">{t('rbac.sedeRole.MEMBER')}</option>
                <option value="READER">{t('rbac.sedeRole.READER')}</option>
              </select>
            </div>
          </div>

          {sections.map((section) => (
            <div key={section.key} className="space-y-2">
              <div className="font-semibold text-sm">{section.title}</div>
              <div className="rounded border">
                {section.modules.map((moduleKey) => (
                  <div
                    key={moduleKey}
                    className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t(`rbac.module.${moduleKey}`)}</div>
                      <div className="text-xs text-muted-foreground">{t('rbac.userPermissions.current')}: {t(`rbac.access.${levels[moduleKey] ?? 'NONE'}`)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={isEnabled(levels[moduleKey])}
                        onCheckedChange={(v) => void toggle(moduleKey, Boolean(v))}
                        disabled={Boolean(saving[moduleKey])}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {extraModules.length ? (
            <div className="space-y-2">
              <div className="font-semibold text-sm">{t('rbac.userPermissions.section.other')}</div>
              <div className="rounded border">
                {extraModules.map((moduleKey) => (
                  <div
                    key={moduleKey}
                    className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t(`rbac.module.${moduleKey}`)}</div>
                      <div className="text-xs text-muted-foreground">{t('rbac.userPermissions.current')}: {t(`rbac.access.${levels[moduleKey] ?? 'NONE'}`)}</div>
                    </div>
                    <Switch
                      checked={isEnabled(levels[moduleKey])}
                      onCheckedChange={(v) => void toggle(moduleKey, Boolean(v))}
                      disabled={Boolean(saving[moduleKey])}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
