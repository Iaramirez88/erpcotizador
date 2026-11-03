'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/components/providers/i18n-provider'
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

function limitLabelKey(key: string): string {
  switch (key) {
    case 'COTIZACIONES_PER_MONTH':
      return 'planLimit.limit.cotizaciones'
    case 'ORDENES_PER_MONTH':
      return 'planLimit.limit.ordenes'
    case 'REMISIONES_PER_MONTH':
      return 'planLimit.limit.remisiones'
    case 'PRODUCTOS_MAX':
      return 'planLimit.limit.productos'
    case 'CLIENTES_MAX':
      return 'planLimit.limit.clientes'
    case 'PROVEEDORES_MAX':
      return 'planLimit.limit.proveedores'
    case 'SEDES_MAX':
      return 'planLimit.limit.sedes'
    case 'USUARIOS_MAX':
      return 'planLimit.limit.usuarios'
    default:
      return 'planLimit.limit.default'
  }
}

export default function PlanLimitModal() {
  const router = useRouter()
  const { t } = useI18n()
  const { open, payload, hide } = usePlanLimitStore()

  const title = t('planLimit.title')

  const description = useMemo(() => {
    if (!payload) return t('planLimit.defaultDescription')
    const label = t(limitLabelKey(payload.limitKey))
    return `${payload.message}\n\n${t('planLimit.details', { label, current: payload.current, max: payload.max })}`
  }, [payload, t])

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
            {t('common.close')}
          </Button>
          <Button onClick={upgrade}>{t('planLimit.upgrade')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
