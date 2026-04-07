'use client'

import { useEffect, useRef, useState } from 'react'

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
    <label className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          const next = event.target.checked
          setChecked(next)
          getNotificationCheckboxes().forEach((checkbox) => {
            checkbox.checked = next
            checkbox.dispatchEvent(new Event('change', { bubbles: true }))
          })
        }}
      />
      Seleccionar todas
    </label>
  )
}