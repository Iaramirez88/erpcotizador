"use client"

import type { CSSProperties } from 'react'
import { Input } from '@/components/ui/input'

type CrmColorSwatchInputProps = {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
  allowTransparent?: boolean
}

const CHECKERBOARD_STYLE: CSSProperties = {
  backgroundImage: 'conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%, #e2e8f0 0% 75%, #ffffff 0%)',
  backgroundSize: '12px 12px',
}

function isTransparentColor(value: string) {
  const normalized = (value ?? '').trim().toLowerCase()
  return !normalized || normalized === 'transparent' || normalized === 'rgba(0,0,0,0)' || normalized === '#00000000'
}

function toNativeColorValue(value: string) {
  const normalized = (value ?? '').trim()
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : '#ffffff'
}

export function CrmColorSwatchInput({ value, onChange, ariaLabel, placeholder, allowTransparent = true }: CrmColorSwatchInputProps) {
  const transparent = allowTransparent && isTransparentColor(value)

  return (
    <div className="flex items-center gap-2">
      <label className="relative h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-slate-200" title={ariaLabel}>
        {transparent ? (
          <span className="absolute inset-0" style={CHECKERBOARD_STYLE} />
        ) : (
          <span className="absolute inset-0" style={{ backgroundColor: value || '#ffffff' }} />
        )}
        <input
          type="color"
          value={toNativeColorValue(value)}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={ariaLabel}
        />
      </label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} className="h-11 flex-1 rounded-xl" placeholder={placeholder} />
      {allowTransparent ? (
        <button
          type="button"
          onClick={() => onChange('transparent')}
          aria-pressed={transparent}
          className={transparent
            ? 'h-11 shrink-0 rounded-xl border border-sky-300 bg-sky-50 px-3 text-xs font-semibold text-sky-700'
            : 'h-11 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50'}
        >
          Transparente
        </button>
      ) : null}
    </div>
  )
}
