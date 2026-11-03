'use client'

import type { ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type RowActionsMenuProps = {
  label?: string
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  className?: string
  disabled?: boolean
}

/**
 * Menú de acciones por fila centralizado (botón de 3 puntos) para las tablas
 * del sistema. Reemplaza a los botones sueltos de cada fila (ver, editar,
 * aprobar, descargar, enviar por email/WhatsApp, eliminar, etc.).
 */
export function RowActionsMenu({ label, children, align = 'end', className, disabled }: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn('h-9 w-9 rounded-full', className)}
          disabled={disabled}
          aria-label={label ? `Acciones para ${label}` : 'Más acciones'}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        {label ? <DropdownMenuLabel className="truncate">{label}</DropdownMenuLabel> : null}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
