'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Database, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'

type SampleVoucher = {
  id: string
  code: string
  voucherType: string
  status: string
  date: string
  description: string
  totalDebit: number
}

type SampleStatus = {
  tag: string
  hasSampleData: boolean
  vouchers: SampleVoucher[]
  voucherCount: number
  ruleCount: number
  accountCount: number
  periodCount: number
  totalDebit: number
}

const VOUCHER_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  POSTED: 'Contabilizado',
  VOIDED: 'Anulado',
}

const VOUCHER_TYPE_LABEL: Record<string, string> = {
  DIARIO: 'Diario',
  INGRESO: 'Ingreso',
  EGRESO: 'Egreso',
  AJUSTE: 'Ajuste',
  CIERRE: 'Cierre',
  APERTURA: 'Apertura',
}

type StatusPayload = {
  ok?: boolean
  data?: SampleStatus
  error?: string
}

type MutationPayload = {
  ok?: boolean
  data?: {
    vouchers?: number
    accountsCreated?: number
    periodCreated?: boolean
    ruleCreated?: boolean
    journalEntries?: number
    rules?: number
    accounts?: number
    periods?: number
  }
  error?: string
}

/** Marca local (por navegador) para no repetir la invitación en cada visita. */
const PROMPT_STORAGE_KEY = 'sgdigital:contabilidad-datos-prueba:v1'

function readPromptChoice(): string | null {
  try {
    return window.localStorage.getItem(PROMPT_STORAGE_KEY)
  } catch {
    return null
  }
}

function writePromptChoice(choice: 'accepted' | 'dismissed' | 'seen') {
  try {
    window.localStorage.setItem(PROMPT_STORAGE_KEY, choice)
  } catch {
    /* almacenamiento no disponible: la invitación volverá a mostrarse en la próxima visita */
  }
}

export function AccountingSampleDataCard() {
  const [status, setStatus] = useState<SampleStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'seed' | 'remove' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [welcome, setWelcome] = useState(false)
  const welcomeRef = useRef(false)
  const promptedRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contabilidad/datos-ejemplo', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as StatusPayload | null
      if (!res.ok || !json?.ok || !json.data) {
        throw new Error(json?.error ?? 'No fue posible consultar los datos de ejemplo')
      }
      setStatus(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible consultar los datos de ejemplo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Invitación de primera visita: opcional, se muestra una sola vez por navegador.
  useEffect(() => {
    if (promptedRef.current || loading || !status) return
    promptedRef.current = true

    if (status.hasSampleData) {
      if (!readPromptChoice()) writePromptChoice('seen')
      return
    }
    if (readPromptChoice()) return

    welcomeRef.current = true
    setWelcome(true)
    setOpen(true)
  }, [loading, status])

  const seedSample = useCallback(async () => {
    setBusy('seed')
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/contabilidad/datos-ejemplo', { method: 'POST' })
      const json = (await res.json().catch(() => null)) as MutationPayload | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'No fue posible cargar los datos de ejemplo')
      }

      const created = json.data?.vouchers ?? 0
      const accountsCreated = json.data?.accountsCreated ?? 0
      const ruleCreated = json.data?.ruleCreated ? ' y 1 regla contable' : ''
      const periodCreated = json.data?.periodCreated ? ' y un período abierto para el mes en curso' : ''
      setMessage(
        `${created} comprobante(s) de ejemplo cargados${ruleCreated}${periodCreated}${
          accountsCreated > 0 ? `, con ${accountsCreated} cuenta(s) base creadas` : ''
        }.`,
      )
      await load()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible cargar los datos de ejemplo')
      return false
    } finally {
      setBusy(null)
    }
  }, [load])

  const removeSample = useCallback(async () => {
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            'Se eliminarán solo los registros marcados como ejemplo (comprobantes, reglas, cuentas y períodos de ejemplo). La información real no se toca. ¿Continuar?',
          )
    if (!confirmed) return

    setBusy('remove')
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/contabilidad/datos-ejemplo', { method: 'DELETE' })
      const json = (await res.json().catch(() => null)) as MutationPayload | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'No fue posible quitar los datos de ejemplo')
      }

      const vouchers = json.data?.vouchers ?? 0
      const extras = [
        json.data?.journalEntries ? `${json.data.journalEntries} asiento(s)` : null,
        json.data?.rules ? `${json.data.rules} regla(s)` : null,
        json.data?.accounts ? `${json.data.accounts} cuenta(s)` : null,
        json.data?.periods ? `${json.data.periods} período(s)` : null,
      ].filter((entry): entry is string => Boolean(entry))

      setMessage(
        vouchers === 0 && extras.length === 0
          ? 'No había datos de ejemplo para quitar.'
          : `Datos de ejemplo eliminados: ${vouchers} comprobante(s)${
              extras.length > 0 ? ` y ${extras.join(', ')}` : ''
            }.`,
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible quitar los datos de ejemplo')
    } finally {
      setBusy(null)
    }
  }, [load])

  const openPanel = useCallback(() => {
    welcomeRef.current = false
    setWelcome(false)
    setError(null)
    setMessage(null)
    setOpen(true)
  }, [])

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      setOpen(true)
      return
    }
    if (welcomeRef.current) writePromptChoice('dismissed')
    welcomeRef.current = false
    setWelcome(false)
    setOpen(false)
  }, [])

  const handleActivate = useCallback(async () => {
    const ok = await seedSample()
    if (!ok) return
    writePromptChoice('accepted')
    welcomeRef.current = false
    setWelcome(false)
    setOpen(false)
  }, [seedSample])

  const hasSampleData = status?.hasSampleData ?? false
  const vouchers = status?.vouchers ?? []
  const isBusy = busy !== null
  const tooltipLabel = hasSampleData
    ? 'Datos de prueba activos · haz clic para revisarlos o quitarlos'
    : 'Datos de prueba · carga comprobantes de ejemplo (opcional)'

  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={openPanel}
              aria-label="Datos de prueba"
              aria-haspopup="dialog"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/85 text-slate-600 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
            >
              <Database className="h-4 w-4" aria-hidden />
              {hasSampleData ? (
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              ) : null}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-[240px] text-[11px] leading-4">
            {tooltipLabel}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{welcome ? '¿Quieres activar datos de prueba?' : 'Datos de prueba'}</DialogTitle>
            <DialogDescription>
              {welcome
                ? 'Son registros de ejemplo para conocer el módulo antes de cargar tu información real. Es opcional: puedes omitirlo ahora y activarlo cuando quieras desde el ícono de datos.'
                : 'Comprobantes de ejemplo con marca interna. Se pueden quitar en cualquier momento sin tocar tu información real.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            {message ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {message}
              </div>
            ) : null}

            {welcome ? (
              <ul className="space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
                <li className="flex gap-2">
                  <span className="text-slate-400" aria-hidden>
                    •
                  </span>
                  Tres comprobantes balanceados: ingreso, egreso y ajuste.
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400" aria-hidden>
                    •
                  </span>
                  1 regla contable de ejemplo (venta gravada con IVA 19%).
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400" aria-hidden>
                    •
                  </span>
                  Cuentas base faltantes y el período abierto del mes en curso.
                </li>
                <li className="flex gap-2">
                  <span className="text-slate-400" aria-hidden>
                    •
                  </span>
                  Todo queda marcado como ejemplo y se puede quitar con un clic.
                </li>
              </ul>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                      hasSampleData
                        ? 'border-sky-200 bg-sky-50 text-sky-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600',
                    )}
                  >
                    {loading ? 'Consultando…' : hasSampleData ? 'Cargados' : 'Sin cargar'}
                  </span>
                  <span className="text-[11px] text-slate-500">Marca interna: {status?.tag ?? 'DEMO_CONTABLE'}</span>
                </div>

                {hasSampleData ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Comprobantes', value: String(status?.voucherCount ?? 0) },
                      { label: 'Reglas', value: String(status?.ruleCount ?? 0) },
                      { label: 'Cuentas demo', value: String(status?.accountCount ?? 0) },
                      { label: 'Débito total', value: formatCurrency(status?.totalDebit ?? 0) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-slate-50 px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {item.label}
                        </div>
                        <div className="truncate text-sm font-semibold text-slate-900">{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {vouchers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
                    {loading ? 'Buscando datos de ejemplo…' : 'Todavía no hay datos de ejemplo en esta empresa.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {vouchers.map((voucher) => (
                      <div
                        key={voucher.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-800">
                            {voucher.code} · {VOUCHER_TYPE_LABEL[voucher.voucherType] ?? voucher.voucherType}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">
                            {voucher.description} · {formatDateShort(voucher.date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-900">{formatCurrency(voucher.totalDebit)}</div>
                          <div className="text-[11px] text-slate-500">
                            {VOUCHER_STATUS_LABEL[voucher.status] ?? voucher.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  Al quitar el ejemplo se eliminan únicamente los comprobantes, reglas, cuentas y períodos marcados
                  como ejemplo. Las cuentas con movimientos reales y los períodos con otros comprobantes se conservan.
                </p>
              </>
            )}
          </div>

          {welcome ? (
            <DialogFooter className="gap-2">
              <Button size="sm" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy === 'seed'}>
                Ahora no
              </Button>
              <Button size="sm" onClick={() => void handleActivate()} disabled={busy === 'seed'}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {busy === 'seed' ? 'Cargando…' : 'Sí, cargar datos de prueba'}
              </Button>
            </DialogFooter>
          ) : (
            <DialogFooter className="gap-2">
              {hasSampleData ? (
                <Button size="sm" variant="destructive" onClick={() => void removeSample()} disabled={isBusy || loading}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {busy === 'remove' ? 'Quitando…' : 'Quitar datos de ejemplo'}
                </Button>
              ) : null}
              <Button
                size="sm"
                variant={hasSampleData ? 'outline' : 'default'}
                onClick={() => void seedSample()}
                disabled={isBusy || loading}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {busy === 'seed' ? 'Cargando…' : hasSampleData ? 'Volver a cargar ejemplo' : 'Cargar datos de ejemplo'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

