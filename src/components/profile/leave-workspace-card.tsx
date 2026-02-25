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
import { useI18n } from '@/components/providers/i18n-provider'

export function LeaveWorkspaceCard(props: { empresaNombre: string | null }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const empresaNombre = (props.empresaNombre || '').trim() || t('profile.workspace.defaultName')

  async function leave() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/workspace/leave', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; message?: string; error?: string }
        | null

      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? t('profile.leave.errors.requestFailed'))
        return
      }

      setOpen(false)
      // Lleva al usuario a un estado consistente (su espacio personal).
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
        <CardTitle className="text-base">{t('profile.workspace.title')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3 text-sm">
        <div className="text-muted-foreground">{t('profile.leave.description', { name: empresaNombre })}</div>

        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          {t('profile.leave.openDialog')}
        </Button>

        <Dialog open={open} onOpenChange={(v) => (!busy ? setOpen(v) : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('profile.leave.dialogTitle')}</DialogTitle>
              <DialogDescription>
                {t('profile.leave.dialogDescription', { name: empresaNombre })}
              </DialogDescription>
            </DialogHeader>

            <div className="text-sm text-muted-foreground">
              {t('profile.leave.lastAdminNote')}
            </div>

            {status ? <div className="text-sm text-muted-foreground">{status}</div> : null}

            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="button" variant="destructive" disabled={busy} onClick={() => void leave()}>
                {busy ? t('common.processing') : t('profile.leave.confirmAction')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
