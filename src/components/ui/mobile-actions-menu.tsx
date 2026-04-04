'use client'

import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

type MobileActionsMenuProps = {
  label?: string
  children: ReactNode
}

export function MobileActionsMenu({ label, children }: MobileActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full md:hidden"
          aria-label={label ? `Acciones para ${label}` : 'Más acciones'}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 md:hidden">
        {label ? <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel> : null}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}