'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function WorkspaceAccessCard() {
  const [companyCode, setCompanyCode] = useState('')
  const [workspaceCode, setWorkspaceCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function claimByCode() {
    const code = companyCode.trim()
    if (!code) return

    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/plan/company-code/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setStatus(json.error || 'No se pudo validar el código')
        return
      }

      setCompanyCode('')
      setStatus('Listo. Tu espacio de trabajo fue actualizado.')
      window.location.assign('/dashboard')
    } catch {
      setStatus('No se pudo completar la solicitud. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  async function requestAccess() {
    const code = workspaceCode.trim().toUpperCase()
    if (!code) return

    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/workspace/request-access', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceCode: code }),
      })

      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) {
        setStatus(json.error || 'No se pudo enviar la solicitud')
        return
      }

      setWorkspaceCode('')
      setStatus('Solicitud enviada. Un administrador debe aprobarte o compartirte el código.')
    } catch {
      setStatus('No se pudo completar la solicitud. Verifica tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">Acceso a otro espacio</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4 text-sm">
        <div className="space-y-2">
          <Label htmlFor="company-code">Tengo el código de empresa</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              id="company-code"
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
              placeholder="EMP-..."
              autoComplete="one-time-code"
              disabled={busy}
              className="max-w-sm"
            />
            <Button type="button" variant="outline" onClick={() => void claimByCode()} disabled={busy || !companyCode.trim()}>
              {busy ? 'Procesando…' : 'Unirme'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Si te compartieron un código global del espacio de trabajo, puedes usarlo aquí para cambiar tu empresa activa.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-code">Solicitar acceso con código de espacio</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              id="workspace-code"
              value={workspaceCode}
              onChange={(e) => setWorkspaceCode(e.target.value)}
              placeholder="WS-XXXXXXXX"
              disabled={busy}
              className="max-w-sm font-mono"
            />
            <Button type="button" onClick={() => void requestAccess()} disabled={busy || !workspaceCode.trim()}>
              {busy ? 'Enviando…' : 'Solicitar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Esto notifica a los administradores del espacio para que te inviten o te compartan el código.
          </p>
        </div>

        {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}
      </CardContent>
    </Card>
  )
}
