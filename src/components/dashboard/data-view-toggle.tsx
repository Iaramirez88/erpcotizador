'use client'

import { LayoutGrid, Rows3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DataViewMode } from '@/lib/payroll'

type DataViewToggleProps = {
  mode: DataViewMode
  onChange: (mode: DataViewMode) => void
  className?: string
}

export function DataViewToggle({ mode, onChange, className }: DataViewToggleProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1', className)}>
      <Button type="button" size="sm" variant={mode === 'list' ? 'default' : 'ghost'} className="h-8 rounded-lg px-2.5" onClick={() => onChange('list')}>
        <Rows3 className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant={mode === 'grid' ? 'default' : 'ghost'} className="h-8 rounded-lg px-2.5" onClick={() => onChange('grid')}>
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  )
}