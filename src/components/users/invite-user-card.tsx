'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/providers/i18n-provider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function InviteUserCard() {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const [successOpen, setSuccessOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string>('')

  const [sedes, setSedes] = useState<Array<{ id: string; nombre: string; codigo: string | null }>>([])
  const [sedeId, setSedeId] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadSedes() {
      try {
        const res = await fetch('/api/sedes', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: Array<{ id: string; nombre: string; codigo: string | null }> }
          | null
        if (cancelled) return
        if (res.ok && json?.success && Array.isArray(json.data)) {
          setSedes(json.data)
        }
      } catch {
        // ignore
      }
    }
    void loadSedes()
    return () => {
      cancelled = true
    }
  }, [])

  async function sendInvite() {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      setStatus(t('rbac.invite.errors.emailRequired'))
      return
    }

    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, sedeId: sedeId || undefined }),
      })

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string; debugCode?: string }
        | null

      if (!res.ok || !json?.success) {
        const err = (json?.error ?? t('rbac.invite.errors.sendFailed')).trim()
        // Ayuda contextual para el caso más común en producción.
        if (res.status === 409 && /otra\s+entidad/i.test(err)) {
          setStatus(
            t('rbac.invite.errors.conflictHint', { error: err })
          )
        } else {
          setStatus(err)
        }
        return
      }

      const debug = typeof json.debugCode === 'string' ? t('rbac.invite.debugCode', { code: json.debugCode }) : ''
      const msg = (json.message ?? t('rbac.invite.successSent')) + debug
      setStatus(msg)
      setSuccessMessage(msg)
      setSuccessOpen(true)
      setEmail('')
      setSedeId('')
    } catch {
      setStatus(t('rbac.invite.errors.network'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('rbac.invite.dialog.title')}</DialogTitle>
            <DialogDescription>{successMessage || t('rbac.invite.dialog.descriptionFallback')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setSuccessOpen(false)}>
              {t('rbac.invite.dialog.ok')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>{t('rbac.invite.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="invite-email">{t('rbac.invite.emailLabel')}</Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              value={email}
              placeholder={t('rbac.invite.emailPlaceholder')}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="button" disabled={busy} onClick={() => void sendInvite()}>
              {busy ? t('rbac.invite.sending') : t('rbac.invite.sendCode')}
            </Button>
          </div>
          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        </div>

        {sedes.length ? (
          <div className="space-y-2">
            <Label htmlFor="invite-sede">{t('rbac.invite.sedeLabel')}</Label>
            <select
              id="invite-sede"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              disabled={busy}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t('rbac.invite.noSedeOption')}</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {t('rbac.invite.sedeHint')}
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {t('rbac.invite.footerHint')}
        </p>
        </CardContent>
      </Card>
    </>
  )
}
