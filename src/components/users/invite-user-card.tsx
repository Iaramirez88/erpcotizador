'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function InviteUserCard() {
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
      setStatus('Ingresa un email.')
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
        const err = (json?.error ?? 'No se pudo enviar la invitación.').trim()
        // Ayuda contextual para el caso más común en producción.
        if (res.status === 409 && /otra\s+entidad/i.test(err)) {
          setStatus(
            `${err}. Si esa persona ya tiene cuenta en otra entidad, debe iniciar sesión allá y usar “Mi perfil → Darme de baja del espacio de trabajo”, luego intenta invitar de nuevo.`
          )
        } else {
          setStatus(err)
        }
        return
      }

      const debug = typeof json.debugCode === 'string' ? ` (Código dev: ${json.debugCode})` : ''
      const msg = (json.message ?? 'Invitación enviada.') + debug
      setStatus(msg)
      setSuccessMessage(msg)
      setSuccessOpen(true)
      setEmail('')
      setSedeId('')
    } catch {
      setStatus('No se pudo enviar la invitación. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitación enviada</DialogTitle>
            <DialogDescription>{successMessage || 'Se envió la invitación correctamente.'}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={() => setSuccessOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

        {sedes.length ? (
          <div className="space-y-2">
            <Label htmlFor="invite-sede">Sede (opcional)</Label>
            <select
              id="invite-sede"
              value={sedeId}
              onChange={(e) => setSedeId(e.target.value)}
              disabled={busy}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Sin sede (usar Principal)</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}{s.codigo ? ` (${s.codigo})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Si no seleccionas sede, el usuario quedará en la sede Principal.
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Se enviará un código para registrarse en esta entidad (si aplica).
        </p>
        </CardContent>
      </Card>
    </>
  )
}
