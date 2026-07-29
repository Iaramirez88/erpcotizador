"use client"

import { useEffect, useState } from 'react'
import { getAvatarInitials } from '@/lib/chat-avatar'
import { cn } from '@/lib/utils'

type Props = {
  label?: string | null
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  fallbackImageUrl?: string | null
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'h-9 w-9 text-[11px]',
  md: 'h-11 w-11 text-xs',
  lg: 'h-14 w-14 text-sm',
}

export function IdentityAvatar({ label, imageUrl, size = 'md', fallbackImageUrl, className }: Props) {
  const initials = getAvatarInitials(label)
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(imageUrl || fallbackImageUrl || null)

  useEffect(() => {
    setResolvedImageUrl(imageUrl || fallbackImageUrl || null)
  }, [fallbackImageUrl, imageUrl])

  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 font-semibold text-slate-700', SIZE_CLASSES[size], className)}>
      {resolvedImageUrl ? (
        <img
          src={resolvedImageUrl}
          alt={label || 'Avatar'}
          className="h-full w-full object-cover"
          onError={() => {
            if (fallbackImageUrl && resolvedImageUrl !== fallbackImageUrl) {
              setResolvedImageUrl(fallbackImageUrl)
              return
            }
            setResolvedImageUrl(null)
          }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}