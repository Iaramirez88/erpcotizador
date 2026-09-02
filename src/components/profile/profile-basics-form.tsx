'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useI18n } from '@/components/providers/i18n-provider'

type Props = {
  initialName?: string | null
  initialEmail?: string | null
  initialTelefono?: string | null
  initialCargo?: string | null
  initialSedeDefault?: { id: string; nombre: string; codigo?: string | null } | null
  hasSedeDefaultAccess?: boolean
  requestableSedes?: Array<{ id: string; nombre: string; codigo?: string | null }>
}

type SaveProfileResponse = {
  success?: boolean
  error?: string
  message?: string
  emailVerificationRequired?: boolean
  emailDeliveryWarning?: string | null
}

export function ProfileBasicsForm({ initialName, initialEmail, initialTelefono, initialCargo, initialSedeDefault, hasSedeDefaultAccess = false, requestableSedes }: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [name, setName] = useState(initialName ?? '')
  const [email, setEmail] = useState(initialEmail ?? '')
  const [telefono, setTelefono] = useState(initialTelefono ?? '')
  const [cargo, setCargo] = useState(initialCargo ?? '')
  const [saving, setSaving] = useState(false)
  const [requestingSede, setRequestingSede] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [sedeRequestStatus, setSedeRequestStatus] = useState<string | null>(null)
  const [requestedSedeId, setRequestedSedeId] = useState('')
  const [sedeRequestReason, setSedeRequestReason] = useState('')

  const defaultSedeLabel = initialSedeDefault
    ? `${initialSedeDefault.nombre}${initialSedeDefault.codigo ? ` (${initialSedeDefault.codigo})` : ''}`
    : 'Sin sede por defecto configurada'

  async function save() {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, telefono, cargo }),
      })
      const json = (await res.json().catch(() => null)) as SaveProfileResponse | null
      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? t('profile.basics.errors.saveFailed'))
        return
      }
      setStatus(json.message || t('profile.basics.status.saved'))
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function requestSedeChange() {
    if (!requestedSedeId) {
      setSedeRequestStatus('Selecciona primero la sede que quieres solicitar.')
      return
    }

    setRequestingSede(true)
    setSedeRequestStatus(null)
    try {
      const res = await fetch('/api/me/sede-change-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSedeId: requestedSedeId, reason: sedeRequestReason }),
      })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string; message?: string } | null
      if (!res.ok || !json?.success) {
        setSedeRequestStatus(json?.error || 'No se pudo enviar la solicitud de cambio de sede.')
        return
      }
      setRequestedSedeId('')
      setSedeRequestReason('')
      setSedeRequestStatus(json.message || 'Solicitud enviada al administrador.')
    } finally {
      setRequestingSede(false)
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
        <Label>Correo</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
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
        <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-700">{defaultSedeLabel}</div>
        <p className="text-xs text-muted-foreground">
          La sede por defecto la ajusta un administrador cuando aprueba el cambio o la asignación correspondiente.
        </p>
        {initialSedeDefault && !hasSedeDefaultAccess ? (
          <p className="text-xs text-amber-700">
            La sede guardada en tu perfil no coincide con tus asignaciones activas. Solicita el ajuste al administrador.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </Button>
        {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
      </div>

      {requestableSedes?.length ? (
        <div className="space-y-3 rounded-xl border border-dashed border-slate-200 p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-900">Solicitar cambio de sede</p>
            <p className="text-xs text-muted-foreground">Si necesitas operar desde otra sede, envía la solicitud y un administrador podrá autorizarla.</p>
          </div>

          <div className="space-y-2">
            <Label>Sede solicitada</Label>
            <select
              className="px-3 py-2 border rounded-md w-full"
              value={requestedSedeId}
              onChange={(e) => setRequestedSedeId(e.target.value)}
            >
              <option value="">Selecciona una sede...</option>
              {requestableSedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nombre}{sede.codigo ? ` (${sede.codigo})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Motivo para el administrador</Label>
            <Textarea
              value={sedeRequestReason}
              onChange={(e) => setSedeRequestReason(e.target.value)}
              rows={3}
              placeholder="Explica por qué necesitas cambiar tu sede o agregar una nueva asignación."
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void requestSedeChange()} disabled={requestingSede}>
              {requestingSede ? 'Enviando...' : 'Solicitar autorización'}
            </Button>
            {sedeRequestStatus ? <span className="text-xs text-muted-foreground">{sedeRequestStatus}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
