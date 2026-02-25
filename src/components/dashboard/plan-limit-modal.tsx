'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePlanLimitStore } from '@/lib/plan-limit-store'

function labelForLimitKey(key: string): string {
  switch (key) {
    case 'COTIZACIONES_PER_MONTH':
      return 'Cotizaciones (por mes)'
    case 'ORDENES_PER_MONTH':
      return 'Órdenes de trabajo (por mes)'
    case 'REMISIONES_PER_MONTH':
      return 'Remisiones (por mes)'
    case 'PRODUCTOS_MAX':
      return 'Productos'
    case 'CLIENTES_MAX':
      return 'Clientes'
    case 'PROVEEDORES_MAX':
      return 'Proveedores'
    case 'SEDES_MAX':
      return 'Sedes'
    case 'USUARIOS_MAX':
      return 'Usuarios'
    default:
      return 'Límite'
  }
}

export default function PlanLimitModal() {
  const router = useRouter()
  const { open, payload, hide } = usePlanLimitStore()

  const title = 'Límite alcanzado'

  const description = useMemo(() => {
    if (!payload) return 'Has alcanzado el límite de tu plan.'
    const label = labelForLimitKey(payload.limitKey)
    return `${payload.message}\n\n${label}: ${payload.current} de ${payload.max}`
  }, [payload])

  function upgrade() {
    const url = payload?.upgradeUrl || '/dashboard/configuracion/plan'
    hide()
    router.push(url)
  }

  if (!open || !payload) return null

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : hide())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={hide}>
            Cerrar
          </Button>
          <Button onClick={upgrade}>Mejorar plan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
