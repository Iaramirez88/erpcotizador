'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { ModuleKey, type AccessLevel } from '@prisma/client'
import { useI18n } from '@/components/providers/i18n-provider'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SedeRef = { id: string; nombre: string; codigo: string | null }

type UserRef = {
  id: string
  name: string | null
  email: string
}

type Props = {
  sedes: SedeRef[]
  user: UserRef
  userDefaultSedeId: string | null
  initialGlobalAccess: AccessLevel
  initialHasSedeAccess: boolean

  activeSedeId: string
  activeSedeNombre: string
  initialSedeRole: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'
  modules: ModuleKey[]
  initialAccess: Partial<Record<ModuleKey, AccessLevel>>
  initialCapabilityAccess: Record<string, AccessLevel>
  canManagePermissionProfiles?: boolean
}

export function MemberActionsMenu({
  sedes,
  user,
  userDefaultSedeId,
  initialGlobalAccess,
  initialHasSedeAccess,
  activeSedeId,
  activeSedeNombre,
  initialSedeRole,
  modules,
  initialAccess,
  initialCapabilityAccess,
  canManagePermissionProfiles = false,
}: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const { toast } = useToast()

  const [menuOpen, setMenuOpen] = useState(false)
  const [defaultSedeOpen, setDefaultSedeOpen] = useState(false)
  const [savingDefaultSede, setSavingDefaultSede] = useState(false)
  const [defaultSedeError, setDefaultSedeError] = useState<string | null>(null)
  const [resetPermissionsOpen, setResetPermissionsOpen] = useState(false)
  const [resettingPermissions, setResettingPermissions] = useState(false)
  const [resetPermissionsError, setResetPermissionsError] = useState<string | null>(null)

  const options = useMemo(() => {
    const merged = [...sedes]
    if (initialHasSedeAccess && !merged.some((item) => item.id === activeSedeId)) {
      merged.push({ id: activeSedeId, nombre: activeSedeNombre, codigo: null })
    }
    return merged
  }, [activeSedeId, activeSedeNombre, initialHasSedeAccess, sedes])
  const [selectedDefaultSedeId, setSelectedDefaultSedeId] = useState<string>(userDefaultSedeId ?? '')

  async function saveDefaultSede() {
    setSavingDefaultSede(true)
    setDefaultSedeError(null)
    try {
      const res = await fetch('/api/admin/permisos/user-default-sede', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, sedeDefaultId: selectedDefaultSedeId || null }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        setDefaultSedeError(json?.error || t('common.unexpectedError'))
        return
      }
      setDefaultSedeOpen(false)
      router.refresh()
    } catch (e) {
      setDefaultSedeError(e instanceof Error ? e.message : t('common.unexpectedError'))
    } finally {
      setSavingDefaultSede(false)
    }
  }

  async function resetPermissions() {
    setResettingPermissions(true)
    setResetPermissionsError(null)
    try {
      const res = await fetch('/api/admin/permisos/reset-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, sedeId: activeSedeId }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        setResetPermissionsError(json?.error || t('common.unexpectedError'))
        return
      }

      setResetPermissionsOpen(false)
      toast({ title: 'Permisos reiniciados. Ya puedes configurarlos de nuevo.' })
      router.refresh()
    } catch (error) {
      setResetPermissionsError(error instanceof Error ? error.message : t('common.unexpectedError'))
    } finally {
      setResettingPermissions(false)
    }
  }

  const displayName = user.name ?? user.email

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={t('rbac.common.options')}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setMenuOpen(false)
              setSelectedDefaultSedeId(userDefaultSedeId ?? '')
              setDefaultSedeError(null)
              setDefaultSedeOpen(true)
            }}
          >
            {t('rbac.defaultSede.assign')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-rose-700 focus:text-rose-800"
            onSelect={(e) => {
              e.preventDefault()
              setMenuOpen(false)
              setResetPermissionsError(null)
              setResetPermissionsOpen(true)
            }}
          >
            Resetear permisos
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={defaultSedeOpen} onOpenChange={setDefaultSedeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('rbac.defaultSede.dialogTitle')}</DialogTitle>
            <DialogDescription>{displayName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('rbac.common.sedeLabel')}</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={selectedDefaultSedeId}
              onChange={(e) => setSelectedDefaultSedeId(e.target.value)}
              disabled={savingDefaultSede}
            >
              <option value="">{t('rbac.defaultSede.none')}</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                  {s.codigo ? ` (${s.codigo})` : ''}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-600">
              Solo aparecen sedes ya asignadas al usuario. La sede por defecto organiza su perfil, pero no crea acceso nuevo.
            </div>
            {defaultSedeError ? <div className="text-sm text-red-600">{defaultSedeError}</div> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDefaultSedeOpen(false)} disabled={savingDefaultSede}>
              {t('common.cancel')}
            </Button>
            <Button type="button" onClick={() => void saveDefaultSede()} disabled={savingDefaultSede}>
              {savingDefaultSede ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPermissionsOpen} onOpenChange={setResetPermissionsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resetear permisos del usuario</DialogTitle>
            <DialogDescription>
              Esto limpiará reglas, módulos, submódulos y permiso general de {displayName} en {activeSedeNombre}. El usuario quedará con rol base de lectura para configurarlo otra vez desde cero.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Usa esta acción solo cuando un usuario quede desincronizado o con permisos corruptos.
          </div>

          {resetPermissionsError ? <div className="text-sm text-red-600">{resetPermissionsError}</div> : null}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setResetPermissionsOpen(false)} disabled={resettingPermissions}>
              {t('common.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void resetPermissions()} disabled={resettingPermissions}>
              {resettingPermissions ? 'Reseteando...' : 'Resetear permisos'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
