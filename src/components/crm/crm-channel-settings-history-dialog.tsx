'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

type SettingsVersion = {
  id: string
  versionNumber: number
  changeNote?: string | null
  createdByUser?: { id: string; name?: string | null; email?: string | null } | null
  createdAt: string
}

function formatVersionDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

export function CrmChannelSettingsHistoryDialog({
  channelId,
  open,
  onOpenChange,
  onRestored,
}: {
  channelId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRestored?: () => void
}) {
  const { toast } = useToast()
  const [versions, setVersions] = useState<SettingsVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!channelId) return
    setLoading(true)
    try {
      const response = await fetch(`/api/crm/channels/${channelId}/settings-versions`, { cache: 'no-store' })
      const payload = (await response.json().catch(() => null)) as { data?: SettingsVersion[]; error?: string } | null
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'No se pudieron cargar las versiones')
      setVersions(payload.data)
    } catch (error) {
      toast({
        title: 'No se pudo cargar el historial',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [channelId, toast])

  useEffect(() => {
    if (open && channelId) void load()
  }, [open, channelId, load])

  async function restore(version: SettingsVersion) {
    if (!channelId) return
    if (!window.confirm(`¿Restaurar la versión ${version.versionNumber}? Se guardará un respaldo del estado actual antes de restaurar.`)) return
    setRestoringId(version.id)
    try {
      const response = await fetch(`/api/crm/channels/${channelId}/settings-versions/${version.id}/restore`, { method: 'POST' })
      const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'No se pudo restaurar la versión')
      toast({ title: `Versión ${version.versionNumber} restaurada` })
      onRestored?.()
      await load()
    } catch (error) {
      toast({
        title: 'No se pudo restaurar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Historial de versiones</DialogTitle>
          <DialogDescription>
            Respaldos automáticos de la configuración del canal. Restaura una versión anterior si algo se perdió.
          </DialogDescription>
        </DialogHeader>

        {loading && !versions.length ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : !versions.length ? (
          <p className="py-8 text-center text-sm text-slate-500">Aún no hay versiones guardadas.</p>
        ) : (
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {versions.map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Versión {version.versionNumber}</p>
                  <p className="truncate text-xs text-slate-500">
                    {formatVersionDate(version.createdAt)} · {version.createdByUser?.name || version.createdByUser?.email || 'Sistema'}
                    {version.changeNote ? ` · ${version.changeNote}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void restore(version)} disabled={restoringId !== null}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {restoringId === version.id ? 'Restaurando…' : 'Restaurar'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
