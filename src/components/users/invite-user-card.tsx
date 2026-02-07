'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function InviteUserCard() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function sendInvite() {
    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      setStatus('Ingresa un email.')
      return
    }

    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized }),
      })

      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string; debugCode?: string }
        | null

      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? 'No se pudo enviar la invitación.')
        return
      }

      const debug = typeof json.debugCode === 'string' ? ` (Código dev: ${json.debugCode})` : ''
      setStatus((json.message ?? 'Invitación enviada.') + debug)
      setEmail('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invitar por correo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              value={email}
              placeholder="usuario@correo.com"
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="button" disabled={busy} onClick={() => void sendInvite()}>
              {busy ? 'Enviando…' : 'Enviar código'}
            </Button>
          </div>
          {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Se enviará un código para registrarse en esta entidad (si aplica).
        </p>
      </CardContent>
    </Card>
  )
}
