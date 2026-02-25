'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useI18n } from '@/components/providers/i18n-provider'

type Props = {
  userName?: string | null
  imageUrl?: string | null
}

export function AvatarUploader({ userName, imageUrl }: Props) {
  const { t } = useI18n()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const initials = useMemo(() => {
    const name = (userName ?? '').trim()
    if (!name) return 'U'
    const parts = name.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? 'U'
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (a + b).toUpperCase()
  }, [userName])

  async function upload(file: File) {
    const maxBytes = 700 * 1024
    if (file.size > maxBytes) {
      setStatus(t('profile.avatar.errors.tooLarge'))
      return
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setStatus(t('profile.avatar.errors.unsupportedFormat'))
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error(t('profile.avatar.errors.readFailed')))
      reader.readAsDataURL(file)
    })

    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/me/avatar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      })

      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? t('profile.avatar.errors.updateFailed'))
        return
      }

      setStatus(t('profile.avatar.status.updated'))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch('/api/me/avatar', { method: 'DELETE' })
      const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!res.ok || !json?.success) {
        setStatus(json?.error ?? t('profile.avatar.errors.removeFailed'))
        return
      }
      setStatus(t('profile.avatar.status.removed'))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 rounded-full overflow-hidden bg-slate-900 border border-slate-800">
          {imageUrl ? (
            <img src={imageUrl} alt={t('profile.avatar.alt')} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-slate-100 font-semibold">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1">
          <Label>{t('profile.avatar.label')}</Label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                void upload(file)
                e.currentTarget.value = ''
              }}
            />
            <Button type="button" variant="outline" disabled={busy || !imageUrl} onClick={() => void remove()}>
              {t('common.remove')}
            </Button>
          </div>
          {status ? <p className="text-xs text-muted-foreground mt-1">{status}</p> : null}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('profile.avatar.recommended')}
      </p>
    </div>
  )
}
