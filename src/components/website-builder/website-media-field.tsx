'use client'

import { useState } from 'react'
import { ExternalLink, FolderOpen, Image as ImageIcon, Trash2 } from 'lucide-react'
import { CrmFileLibraryPicker } from '@/components/crm/crm-file-library-picker'
import type { CrmFileItem, CrmFileItemType } from '@/components/crm/crm-files-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  value?: string
  onChange: (value: string) => void
  readOnly?: boolean
  acceptedTypes: CrmFileItemType[]
  label: string
}

export function WebsiteMediaField({ value, onChange, readOnly, acceptedTypes, label }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)

  function selectItem(item: CrmFileItem) {
    if (!item.url) throw new Error('Este archivo no tiene una URL utilizable en la página pública.')
    onChange(item.url)
  }

  const isImage = Boolean(value) && !acceptedTypes.includes('video')

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-slate-700">{label}</div>
      {value ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
          {isImage ? <img src={value} alt="Vista previa" className="h-28 w-full object-cover" /> : <div className="flex h-20 items-center justify-center text-slate-500"><ImageIcon className="h-6 w-6" /></div>}
          <div className="flex items-center gap-1 border-t border-slate-200 bg-white p-2">
            <a href={value} target="_blank" rel="noreferrer" className="inline-flex min-w-0 flex-1 items-center gap-1 truncate text-[11px] text-blue-700"><ExternalLink className="h-3 w-3 shrink-0" />{value}</a>
            {!readOnly ? <Button type="button" size="icon" variant="ghost" aria-label="Quitar medio" onClick={() => onChange('')}><Trash2 className="h-3.5 w-3.5" /></Button> : null}
          </div>
        </div>
      ) : null}
      <Input value={value || ''} onChange={(event) => onChange(event.target.value)} placeholder="https://..." disabled={readOnly} />
      <Button type="button" variant="outline" className="w-full" onClick={() => setPickerOpen(true)} disabled={readOnly}>
        <FolderOpen className="h-4 w-4" />
        Elegir de Drive
      </Button>
      <CrmFileLibraryPicker open={pickerOpen} onOpenChange={setPickerOpen} onPick={selectItem} title={`Seleccionar ${label.toLowerCase()}`} allowFolders={false} acceptedTypes={acceptedTypes} />
    </div>
  )
}