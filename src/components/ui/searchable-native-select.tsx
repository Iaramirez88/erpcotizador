'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'

export type SearchableNativeSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SearchableNativeSelectOption[]
  disabled?: boolean
  selectClassName?: string
  searchClassName?: string
  searchPlaceholder?: string
  emptyText?: string
  includeAllOption?: { value: string; label: string }
}

export function SearchableNativeSelect({
  value,
  onChange,
  options,
  disabled,
  selectClassName,
  searchClassName,
  searchPlaceholder = 'Buscar…',
  emptyText = 'Sin resultados',
  includeAllOption,
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div className="space-y-1">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={searchClassName}
        placeholder={searchPlaceholder}
        disabled={disabled}
      />
      <select
        className={selectClassName}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {includeAllOption ? <option value={includeAllOption.value}>{includeAllOption.label}</option> : null}
        {filtered.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {filtered.length === 0 ? (
          <option value={value || ''} disabled>
            {emptyText}
          </option>
        ) : null}
      </select>
    </div>
  )
}
