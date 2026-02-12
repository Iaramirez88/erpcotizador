'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function LeaveWorkspaceCard(props: { empresaNombre: string | null }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const empresaNombre = (props.empresaNombre || '').trim() || 'este espacio de trabajo'

  async function leave() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/workspace/leave', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string }
        | null

      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? 'No se pudo completar la solicitud.')
        return
      }

      setOpen(false)
      // Lleva al usuario a un estado consistente (su espacio personal).
      window.location.assign('/dashboard')
    } catch {
      setStatus('No se pudo completar la solicitud. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Espacio de trabajo</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 text-sm">
        <div className="text-muted-foreground">
          Si ya no deseas usar <span className="font-medium text-foreground">{empresaNombre}</span>, puedes darte de baja.
        </div>

        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Darme de baja del espacio de trabajo
        </Button>

        <Dialog open={open} onOpenChange={(v) => (!busy ? setOpen(v) : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar baja</DialogTitle>
              <DialogDescription>
                Esta acción te quitará el acceso a la información y configuración de “{empresaNombre}”.
                Para volver a entrar necesitarás que un administrador te invite nuevamente.
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm text-muted-foreground">
              Si eres el último administrador del espacio, el sistema no permitirá la baja.
            </div>

            {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void leave()}>
                {busy ? 'Procesando…' : 'Sí, darme de baja'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
