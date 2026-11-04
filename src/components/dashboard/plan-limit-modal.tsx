'use client'

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

  const description = (() => {
    if (!payload) return t('planLimit.defaultDescription')
    const label = t(limitLabelKey(payload.limitKey))
    return `${payload.message}\n\n${t('planLimit.details', { label, current: payload.current, max: payload.max })}`
  })()

  function upgrade() {
    const url = payload?.upgradeUrl || '/dashboard/configuracion/plan'
    hide()
    router.push(url)
  }

  if (!open || !payload) return null

  const percentage = typeof payload.percentage === 'number' ? Math.min(100, Math.max(0, Math.round(payload.percentage))) : null

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : hide())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line">{description}</DialogDescription>
        </DialogHeader>

        {percentage !== null ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Consumo del plan</span>
              <span>{percentage}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${percentage}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {payload.current.toLocaleString('es-CO')} de {payload.max.toLocaleString('es-CO')} {payload.unit || ''} usados
              {payload.resource ? ` · recurso: ${payload.resource}` : ''}
            </p>
          </div>
        ) : null}

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
