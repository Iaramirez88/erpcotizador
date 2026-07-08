'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { ModuleKey, type AccessLevel } from '@prisma/client'
import { useI18n } from '@/components/providers/i18n-provider'
import { Button } from '@/components/ui/button'
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
import { UserPermissionsModal } from '@/components/rbac/user-permissions-modal'

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

  activeSedeId: string
  activeSedeNombre: string
  initialSedeRole: 'ADMIN' | 'MANAGER' | 'MEMBER' | 'READER'
  modules: ModuleKey[]
  initialAccess: Partial<Record<ModuleKey, AccessLevel>>
  initialCapabilityAccess: Record<string, AccessLevel>
}

export function MemberActionsMenu({
  sedes,
  user,
  userDefaultSedeId,
  initialGlobalAccess,
  activeSedeId,
  activeSedeNombre,
  initialSedeRole,
  modules,
  initialAccess,
  initialCapabilityAccess,
}: Props) {
  const { t } = useI18n()
  const router = useRouter()

  const [defaultSedeOpen, setDefaultSedeOpen] = useState(false)
  const [savingDefaultSede, setSavingDefaultSede] = useState(false)
  const [defaultSedeError, setDefaultSedeError] = useState<string | null>(null)

  const options = useMemo(() => sedes, [sedes])
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

  const displayName = user.name ?? user.email

  return (
    <>
      <DropdownMenu>
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
              setSelectedDefaultSedeId(userDefaultSedeId ?? '')
              setDefaultSedeError(null)
              setDefaultSedeOpen(true)
            }}
          >
            {t('rbac.defaultSede.assign')}
          </DropdownMenuItem>

          <UserPermissionsModal
            sedeId={activeSedeId}
            sedeNombre={activeSedeNombre}
            user={user}
            initialSedeRole={initialSedeRole}
            modules={modules}
            initial={initialAccess}
            initialGlobalAccess={initialGlobalAccess}
            initialCapabilities={initialCapabilityAccess}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                {t('rbac.userPermissions.button')}
              </DropdownMenuItem>
            }
          />
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
    </>
  )
}
