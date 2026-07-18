'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/components/providers/i18n-provider'

export function WorkspaceAccessCard() {
  const { t } = useI18n()
  const [workspaceCode, setWorkspaceCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function joinByWorkspaceCode() {
    const code = workspaceCode.trim().toUpperCase()
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
        setStatus(json.error || t('profile.access.errors.invalidCompanyCode'))
        return
      }

      setWorkspaceCode('')
      setStatus(t('profile.access.status.workspaceUpdated'))
      window.location.assign('/dashboard')
    } catch {
      setStatus(t('common.errors.requestFailedTryAgain'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-base">{t('profile.access.otherWorkspaceTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4 text-sm">
        <div className="space-y-2">
          <Label htmlFor="workspace-code">{t('profile.access.workspaceCodeLabel')}</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              id="workspace-code"
              value={workspaceCode}
              onChange={(e) => setWorkspaceCode(e.target.value)}
              placeholder={t('profile.access.workspaceCodePlaceholder')}
              disabled={busy}
              className="max-w-sm font-mono"
            />
            <Button type="button" onClick={() => void joinByWorkspaceCode()} disabled={busy || !workspaceCode.trim()}>
              {busy ? t('common.processing') : t('profile.access.join')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('profile.access.workspaceCodeHelp')}
          </p>
        </div>

        {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}
      </CardContent>
    </Card>
  )
}
