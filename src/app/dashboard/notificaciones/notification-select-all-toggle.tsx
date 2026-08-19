'use client'

import { useEffect, useRef, useState } from 'react'
import { ListChecks } from 'lucide-react'

function getNotificationCheckboxes() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="ids"]'))
}

export default function NotificationSelectAllToggle() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const sync = () => {
      const checkboxes = getNotificationCheckboxes()
      const total = checkboxes.length
      const selected = checkboxes.filter((checkbox) => checkbox.checked).length
      const allChecked = total > 0 && selected === total
      const partiallyChecked = selected > 0 && selected < total

      setChecked(allChecked)
      if (inputRef.current) {
        inputRef.current.indeterminate = partiallyChecked
      }
    }

    const bind = () => {
      const checkboxes = getNotificationCheckboxes()
      sync()
      checkboxes.forEach((checkbox) => checkbox.addEventListener('change', sync))
      return () => {
        checkboxes.forEach((checkbox) => checkbox.removeEventListener('change', sync))
      }
    }

    const cleanup = bind()
    return cleanup
  }, [])

  return (
    <label
      className={checked
        ? 'inline-flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 transition-colors'
        : 'inline-flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900'}
      title="Seleccionar todas"
      aria-label="Seleccionar todas"
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        className="sr-only"
        onChange={(event) => {
          const next = event.target.checked
          setChecked(next)
          getNotificationCheckboxes().forEach((checkbox) => {
            checkbox.checked = next
            checkbox.dispatchEvent(new Event('change', { bubbles: true }))
          })
        }}
      />
      <ListChecks className="h-4 w-4" />
    </label>
  )
}