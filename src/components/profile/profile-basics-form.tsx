'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/providers/i18n-provider'

type Props = {
  initialName?: string | null
  initialTelefono?: string | null
  initialCargo?: string | null
  initialSedeDefaultId?: string | null
  sedes?: Array<{ id: string; nombre: string; codigo?: string | null }>
}

export function ProfileBasicsForm({ initialName, initialTelefono, initialCargo, initialSedeDefaultId, sedes }: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [name, setName] = useState(initialName ?? '')
  const [telefono, setTelefono] = useState(initialTelefono ?? '')
  const [cargo, setCargo] = useState(initialCargo ?? '')
  const [sedeDefaultId, setSedeDefaultId] = useState(initialSedeDefaultId ?? '')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, telefono, cargo, sedeDefaultId }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? t('profile.basics.errors.saveFailed'))
        return
      }
      setStatus(t('profile.basics.status.saved'))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t('profile.basics.nameLabel')}</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('profile.basics.namePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('profile.basics.phoneLabel')}</Label>
        <Input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder={t('profile.basics.phonePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('profile.basics.roleLabel')}</Label>
        <Input
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          placeholder={t('profile.basics.rolePlaceholder')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('profile.basics.sedeDefaultLabel')}</Label>
        <select
          className="px-3 py-2 border rounded-md w-full"
          value={sedeDefaultId}
          onChange={(e) => setSedeDefaultId(e.target.value)}
        >
          <option value="">{t('profile.basics.sedeDefaultPlaceholder')}</option>
          {(sedes ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
        {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
      </div>
    </div>
  )
}
