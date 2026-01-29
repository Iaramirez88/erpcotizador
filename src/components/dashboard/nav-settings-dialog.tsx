'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type NavPrefs = Record<string, boolean>

export type NavSettingsItem = {
  name: string
  href: string
}

export function NavSettingsDialog({
  items,
  value,
  onSave,
  trigger,
}: {
  items: NavSettingsItem[]
  value: NavPrefs
  onSave: (next: NavPrefs) => Promise<void> | void
  trigger?: (open: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<NavPrefs>(value)

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [items])

  function resetAll(enabled: boolean) {
    const next: NavPrefs = {}
    for (const it of items) next[it.href] = enabled
    setDraft(next)
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {trigger ? (
        trigger(() => {
          setDraft(value)
          setOpen(true)
        })
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft(value)
            setOpen(true)
          }}
        >
          Personalizar menú
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Personalizar menú</DialogTitle>
            <DialogDescription>
              Activa/desactiva módulos en el sidebar. Esto solo afecta tu usuario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => resetAll(true)} disabled={saving}>
                Mostrar todo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => resetAll(false)} disabled={saving}>
                Ocultar todo
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sorted.map((it) => {
                const checked = draft[it.href] ?? true
                return (
                  <label key={it.href} className="flex items-center gap-2 rounded-md border p-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [it.href]: e.target.checked }))}
                      disabled={saving}
                    />
                    <Label className="cursor-pointer">{it.name}</Label>
                  </label>
                )
              })}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
