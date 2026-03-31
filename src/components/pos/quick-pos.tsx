'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileDigit,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  QrCode,
  Receipt,
  ScanLine,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatUnidadMedidaLabel } from '@/lib/utils'
import { type PosCartProduct, usePosCart } from '@/hooks/use-pos-cart'

type PaymentFlow = 'CASH' | 'DATAPHONE' | 'QR' | 'LINK'
type PaymentSource = 'NEQUI' | 'DAVIPLATA' | 'BANCOLOMBIA' | 'OTHER'

type LookupResponse = {
  success?: boolean
  data?: PosCartProduct & {
    warehouse?: { id: string; nombre: string } | null
  }
  error?: string
}

type CreateSaleResponse = {
  success?: boolean
  data?: {
    id: string
    numero: string
    total: number
    status: string
    checkout?: {
      provider: 'BOLD'
      reference: string
      paymentLinkId: string
      url: string
      flow: PaymentFlow
      source: PaymentSource
    }
  }
  error?: string
  invoiceId?: string
  numero?: string
}

type StatusState = {
  kind: 'idle' | 'error' | 'success' | 'info'
  message: string
}

type InvoiceStatusResponse = {
  success?: boolean
  data?: {
    id: string
    numero: string
    status: string
    total: number
  }
  error?: string
}

type ElectronicInvoiceResponse = {
  ok?: boolean
  data?: {
    id: string
    status: string
    numero: string | null
  }
  error?: string
}

type CheckoutSession = NonNullable<NonNullable<CreateSaleResponse['data']>['checkout']>

const FLOW_OPTIONS: Array<{ value: PaymentFlow; label: string; hint: string; icon: typeof Banknote }> = [
  { value: 'CASH', label: 'Efectivo', hint: 'Factura inmediata', icon: Banknote },
  { value: 'DATAPHONE', label: 'Datáfono', hint: 'Cobro con tarjeta', icon: CreditCard },
  { value: 'QR', label: 'QR', hint: 'Transferencia rápida', icon: QrCode },
  { value: 'LINK', label: 'Link', hint: 'Pago remoto', icon: Link2 },
]

const SOURCE_OPTIONS: Array<{ value: PaymentSource; label: string }> = [
  { value: 'NEQUI', label: 'Nequi' },
  { value: 'DAVIPLATA', label: 'Daviplata (vía PSE)' },
  { value: 'BANCOLOMBIA', label: 'Bancolombia' },
  { value: 'OTHER', label: 'Otro' },
]

function flowMessage(flow: PaymentFlow) {
  if (flow === 'DATAPHONE') return 'Se generará un checkout Bold para cobrar con tarjeta.'
  if (flow === 'QR') return 'Se generará un QR de checkout de Bold para mostrar al cliente.'
  if (flow === 'LINK') return 'Se generará un link de checkout de Bold para compartir.'
  return 'Confirma cuánto entrega el cliente y cuánto debe devolverse antes de registrar la venta.'
}

export function QuickPos() {
  const cart = usePosCart()
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingAutoActionRef = useRef(false)
  const rootRef = useRef<HTMLElement>(null)

  const [scanCode, setScanCode] = useState('')
  const [status, setStatus] = useState<StatusState>({ kind: 'idle', message: '' })
  const [scannerBusy, setScannerBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow>('CASH')
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('NEQUI')
  const [lastSale, setLastSale] = useState<{ id: string; numero: string; total: number; status: string } | null>(null)
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null)
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null)
  const [pendingInvoiceNumber, setPendingInvoiceNumber] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [expanded, setExpanded] = useState(false)
  const [creatingElectronic, setCreatingElectronic] = useState(false)
  const [electronicStatus, setElectronicStatus] = useState<string>('')
  const [cashTenderedInput, setCashTenderedInput] = useState('')

  const cashTendered = useMemo(() => {
    const value = Number(cashTenderedInput)
    return Number.isFinite(value) ? value : 0
  }, [cashTenderedInput])

  const cashChange = useMemo(() => Math.max(cashTendered - cart.total, 0), [cashTendered, cart.total])
  const cashShortfall = useMemo(() => Math.max(cart.total - cashTendered, 0), [cashTendered, cart.total])
  const canCompleteCashSale = paymentFlow !== 'CASH' || (cashTenderedInput.trim() !== '' && cashShortfall < 0.01)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      setExpanded(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const salePayload = useMemo(
    () => {
      const payload = {
        clienteNombre: 'Consumidor final',
        ivaPct: 0,
        items: cart.items.map((item) => ({
          materialId: item.id,
          descripcion: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      }

      if (paymentFlow === 'CASH') {
        return {
          ...payload,
          payments: [
            {
              method: 'CASH',
              amount: cart.total,
              provider: 'MANUAL',
              status: 'PAID',
              flow: paymentFlow,
              metadata: {
                cashTendered,
                cashChange,
              },
            },
          ],
        }
      }

      return {
        ...payload,
        asDraft: true,
        checkout: {
          provider: 'BOLD',
          flow: paymentFlow,
          source: paymentSource,
        },
      }
    },
    [cart.items, cart.total, cashChange, cashTendered, paymentFlow, paymentSource],
  )

  const focusScanner = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const resetPendingCheckout = useCallback(() => {
    setCheckoutSession(null)
    setPendingInvoiceId(null)
    setPendingInvoiceNumber(null)
    setQrDataUrl('')
  }, [])

  const openInvoicePdf = useCallback((invoiceId: string) => {
    window.open(`/api/pos/facturas/${invoiceId}/pdf`, '_blank', 'noopener,noreferrer')
  }, [])

  const openCashDialog = useCallback(() => {
    setCashTenderedInput((current) => {
      const parsed = Number(current)
      if (Number.isFinite(parsed) && parsed >= cart.total) return current
      return Number(cart.total.toFixed(2)).toString()
    })
    setCheckoutOpen(true)
  }, [cart.total])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await rootRef.current?.requestFullscreen()
      setExpanded(true)
    } catch {
      setExpanded((current) => !current)
    }
  }, [])

  const processSale = useCallback(async () => {
    if (cart.isEmpty || submitting) return

    setSubmitting(true)
    setElectronicStatus('')
    setStatus({ kind: 'info', message: paymentFlow === 'CASH' ? 'Procesando venta y generando factura...' : 'Creando factura borrador y checkout...' })

    try {
      const response = await fetch('/api/sales/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      })

      const json = (await response.json().catch(() => ({}))) as CreateSaleResponse
      if (!response.ok || !json.success || !json.data) {
        setStatus({ kind: 'error', message: json.error || 'No se pudo completar la venta.' })
        return
      }

      if (json.data.checkout) {
        setPendingInvoiceId(json.data.id)
        setPendingInvoiceNumber(json.data.numero)
        setCheckoutSession(json.data.checkout)
        setCheckoutOpen(true)
        setStatus({ kind: 'info', message: `Checkout listo para la factura ${json.data.numero}. Esperando confirmación del pago.` })
        return
      }

      resetPendingCheckout()
      setLastSale({ id: json.data.id, numero: json.data.numero, total: json.data.total, status: json.data.status })
      setStatus({ kind: 'success', message: `Factura ${json.data.numero} creada correctamente.` })
      setCheckoutOpen(false)
      setCashTenderedInput('')
      cart.clearCart()
      openInvoicePdf(json.data.id)
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo completar la venta.' })
    } finally {
      setSubmitting(false)
      focusScanner()
    }
  }, [cart, focusScanner, openInvoicePdf, paymentFlow, resetPendingCheckout, salePayload, submitting])

  useEffect(() => {
    if (!checkoutSession?.url) {
      setQrDataUrl('')
      return
    }

    let active = true

    QRCode.toDataURL(checkoutSession.url, {
      margin: 1,
      width: 280,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url: string) => {
        if (active) setQrDataUrl(url)
      })
      .catch(() => {
        if (active) setQrDataUrl('')
      })

    return () => {
      active = false
    }
  }, [checkoutSession])

  useEffect(() => {
    if (!pendingInvoiceId || paymentFlow === 'CASH') return

    const intervalId = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/pos/facturas/${pendingInvoiceId}`, { cache: 'no-store' })
        const json = (await response.json().catch(() => ({}))) as InvoiceStatusResponse
        if (!response.ok || !json.success || !json.data) return

        if (json.data.status !== 'PAID') return

        window.clearInterval(intervalId)
        setLastSale({ id: json.data.id, numero: json.data.numero, total: json.data.total, status: json.data.status })
        setStatus({ kind: 'success', message: `Pago confirmado. Factura ${json.data.numero} finalizada correctamente.` })
        setCheckoutOpen(false)
        cart.clearCart()
        resetPendingCheckout()
        openInvoicePdf(json.data.id)
      } catch {
        return
      }
    }, 4000)

    return () => window.clearInterval(intervalId)
  }, [cart, openInvoicePdf, paymentFlow, pendingInvoiceId, resetPendingCheckout])

  useEffect(() => {
    if (!pendingAutoActionRef.current || cart.isEmpty || cart.uniqueItems !== 1) return

    pendingAutoActionRef.current = false

    if (paymentFlow === 'CASH') {
      openCashDialog()
      return
    }

    setCheckoutOpen(true)
  }, [cart.isEmpty, cart.uniqueItems, openCashDialog, paymentFlow])

  const lookupAndAddProduct = useCallback(async () => {
    const code = scanCode.replace(/\s+/g, '').trim()
    if (!code || scannerBusy) return

    setScannerBusy(true)
    setStatus({ kind: 'idle', message: '' })

    try {
      const response = await fetch(`/api/sales/products/by-code?code=${encodeURIComponent(code)}`, { cache: 'no-store' })
      const json = (await response.json().catch(() => ({}))) as LookupResponse

      if (!response.ok || !json.success || !json.data) {
        setStatus({ kind: 'error', message: json.error || 'No encontré un producto para ese código.' })
        return
      }

      if (json.data.stock <= 0) {
        setStatus({ kind: 'error', message: `${json.data.name} no tiene stock disponible.` })
        return
      }

      const willOnlyHaveOneProduct = cart.items.some((item) => item.id === json.data!.id) || cart.uniqueItems === 0
      cart.addProduct(json.data)
      setScanCode('')
      setStatus({ kind: 'info', message: `${json.data.name} agregado al carrito.` })

      if (autoMode && willOnlyHaveOneProduct) {
        pendingAutoActionRef.current = true
      }
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo leer el código.' })
    } finally {
      setScannerBusy(false)
      focusScanner()
    }
  }, [autoMode, cart, focusScanner, paymentFlow, processSale, scanCode, scannerBusy])

  const summaryLabel = useMemo(() => {
    if (!lastSale) return 'Caja lista para la siguiente venta.'
    return `Última factura: ${lastSale.numero} por ${formatCurrency(lastSale.total)}.`
  }, [lastSale])

  const sourceLabel = SOURCE_OPTIONS.find((option) => option.value === paymentSource)?.label ?? 'Otro'
  const flowLabel = FLOW_OPTIONS.find((option) => option.value === paymentFlow)?.label ?? paymentFlow
  const paymentSummaryLabel = paymentFlow === 'CASH' ? flowLabel : `${flowLabel} · ${sourceLabel}`
  const showCashConfirmation = paymentFlow === 'CASH' && !checkoutSession

  const generateElectronicInvoice = useCallback(async () => {
    if (!lastSale || creatingElectronic) return

    setCreatingElectronic(true)
    setElectronicStatus('')

    try {
      const response = await fetch(`/api/pos/facturas/${lastSale.id}/electronic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const json = (await response.json().catch(() => ({}))) as ElectronicInvoiceResponse

      if (!response.ok || !json.ok || !json.data) {
        setElectronicStatus(json.error || 'No se pudo enviar a factura electrónica.')
        return
      }

      setElectronicStatus(
        json.data.numero
          ? `Documento electrónico ${json.data.numero} listo en estado ${json.data.status}.`
          : `Documento electrónico creado en estado ${json.data.status}.`,
      )
    } catch (error) {
      setElectronicStatus(error instanceof Error ? error.message : 'No se pudo enviar a factura electrónica.')
    } finally {
      setCreatingElectronic(false)
    }
  }, [creatingElectronic, lastSale])

  return (
    <main
      ref={rootRef}
      className={`${expanded ? 'fixed inset-0 z-50 h-screen overflow-hidden' : 'h-[calc(100vh-4rem)] overflow-hidden'} bg-[radial-gradient(circle_at_top,#fff7ed_0%,#ffffff_40%,#f8fafc_100%)] px-4 py-5 md:px-6`}
    >
      <div className="mx-auto flex h-full max-w-[1500px] min-h-0 flex-col gap-4">
        <div className="flex shrink-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">Modo caja</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Venta rápida separada del módulo de facturación</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/pos">Volver a POS completo</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void toggleFullscreen()}>
            {expanded ? <Minimize2 className="mr-2 h-4 w-4" /> : <Maximize2 className="mr-2 h-4 w-4" />}
            {expanded ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </Button>
        </div>
        </div>

        <div className="grid min-h-0 flex-1 items-stretch gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(460px,0.95fr)]">
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-200 bg-white shadow-[0_30px_90px_-48px_rgba(234,88,12,0.5)]">
          <div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 via-white to-white px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-600">Punto de venta</p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Venta rápida</h1>
                <p className="mt-1 text-sm text-slate-500">Escanea, cobra y factura desde una caja limpia, grande y sin distraerte.</p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Total</p>
                <p className="text-2xl font-semibold text-slate-900">{formatCurrency(cart.total)}</p>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
            <div className="grid grid-cols-[minmax(0,1.6fr)_110px_140px_64px] gap-3 border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <span>Producto</span>
              <span className="text-center">Cant</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Acción</span>
            </div>

            <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto pr-1">
              {cart.items.length === 0 ? (
                <div className="flex min-h-[20rem] flex-1 flex-col items-center justify-center gap-3 text-center text-slate-500 lg:min-h-[24rem]">
                  <Receipt className="h-10 w-10 text-orange-300" />
                  <div>
                    <p className="text-lg font-medium text-slate-700">El carrito está vacío</p>
                    <p className="text-sm">Escanea un código para empezar a vender.</p>
                  </div>
                </div>
              ) : (
                cart.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1.6fr)_110px_140px_64px] items-center gap-3 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                        {item.code} · {formatUnidadMedidaLabel(item.unit)} · stock {item.stock}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                        onClick={() => cart.setQuantity(item.id, Math.max(1, item.quantity - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center text-base font-semibold text-slate-900">{item.quantity}</span>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
                        onClick={() => cart.setQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-slate-500">{formatCurrency(item.unitPrice)} c/u</p>
                      <p className="text-base font-semibold text-slate-900">{formatCurrency(item.total)}</p>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="rounded-full border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                        onClick={() => cart.removeProduct(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="grid min-h-0 content-start gap-4 overflow-auto pr-1 xl:grid-cols-2">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Escanear</p>
            <div className="mt-3 flex gap-3">
              <div className="relative flex-1">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
                <Input
                  ref={inputRef}
                  value={scanCode}
                  onChange={(event) => setScanCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void lookupAndAddProduct()
                    }
                  }}
                  onBlur={focusScanner}
                  placeholder="Escanea el código"
                  className="h-14 rounded-2xl border-orange-200 pl-10 text-base"
                />
              </div>
              <Button
                type="button"
                className="h-14 rounded-2xl bg-orange-500 px-5 text-white hover:bg-orange-600"
                onClick={() => void lookupAndAddProduct()}
                disabled={scannerBusy}
              >
                {scannerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Escanear'}
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 px-4 py-3 text-sm text-slate-600">
              El scanner entra como teclado. Solo necesita enviar el código y Enter.
            </div>

            {pendingInvoiceId ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Hay una venta en espera de pago: factura {pendingInvoiceNumber}. Cuando Bold confirme, esta caja se limpiará automáticamente.
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Cobro</p>
                <p className="mt-1 text-sm text-slate-600">Selecciona cómo saldrá el pago.</p>
              </div>
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  autoMode ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
                onClick={() => setAutoMode((current) => !current)}
              >
                Auto
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {FLOW_OPTIONS.map((option) => {
                const Icon = option.icon
                const active = paymentFlow === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentFlow(option.value)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-orange-300 bg-orange-50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/40'
                    }`}
                  >
                    <span className={`rounded-2xl p-2 ${active ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-xs text-slate-500">{option.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {paymentFlow === 'CASH' ? (
              <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-600">
                El pago en efectivo se confirma en un modal con valores grandes para caja y cliente.
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPaymentSource(option.value)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                      paymentSource === option.value
                        ? 'border-orange-300 bg-orange-100 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {paymentFlow !== 'CASH' && paymentSource === 'DAVIPLATA' ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Daviplata se procesa por PSE dentro del checkout de Bold; no es un canal QR nativo independiente.
              </div>
            ) : null}
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.8)] xl:col-span-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">Resumen</p>
                <p className="mt-2 text-3xl font-semibold">{formatCurrency(cart.total)}</p>
                <p className="mt-2 text-sm text-slate-300">{cart.quantity} unidades en {cart.uniqueItems} líneas.</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{paymentSummaryLabel}</p>
              </div>
              <Receipt className="h-8 w-8 text-orange-300" />
            </div>

            <Button
              type="button"
              className="mt-5 h-14 w-full rounded-2xl bg-orange-500 text-base font-semibold text-white hover:bg-orange-600"
              disabled={cart.isEmpty || submitting}
              onClick={() => {
                if (paymentFlow === 'CASH') {
                  openCashDialog()
                  return
                }
                setCheckoutOpen(true)
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aceptar'}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-11 w-full rounded-2xl text-slate-200 hover:bg-white/10 hover:text-white"
              disabled={cart.isEmpty || submitting}
              onClick={() => {
                cart.clearCart()
                setStatus({ kind: 'info', message: 'Carrito limpiado.' })
                focusScanner()
              }}
            >
              Limpiar carrito
            </Button>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-sm font-semibold text-white">{summaryLabel}</p>
                  <p className="text-xs text-slate-400">Cliente por defecto: Consumidor final.</p>
                </div>
              </div>

              {lastSale?.status === 'PAID' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-11 w-full rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => void generateElectronicInvoice()}
                  disabled={creatingElectronic}
                >
                  {creatingElectronic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDigit className="mr-2 h-4 w-4" />}
                  Pasar a factura electrónica
                </Button>
              ) : null}

              {status.kind !== 'idle' ? (
                <div
                  className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                    status.kind === 'error'
                      ? 'bg-rose-50 text-rose-700'
                      : status.kind === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-white/10 text-slate-100'
                  }`}
                >
                  {status.message}
                </div>
              ) : null}

              {electronicStatus ? (
                <div className="mt-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-slate-100">{electronicStatus}</div>
              ) : null}
            </div>
          </section>
        </aside>
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent
          container={rootRef.current}
          className={showCashConfirmation ? 'rounded-[32px] border-orange-200 sm:max-w-4xl lg:max-w-5xl' : 'rounded-[28px] border-orange-200 sm:max-w-lg'}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl">Confirmar cobro</DialogTitle>
            <DialogDescription>{flowMessage(paymentFlow)}</DialogDescription>
          </DialogHeader>

          {showCashConfirmation ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.95fr)] lg:items-stretch">
              <div className="space-y-6">
                <div className="rounded-[32px] border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-7 text-center shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-orange-700">Total a cobrar</p>
                  <p className="mt-4 text-6xl font-semibold tracking-tight text-slate-950 md:text-7xl xl:text-[5.5rem]">{formatCurrency(cart.total)}</p>
                </div>

                <div className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Dinero entregado por el cliente</p>
                  <Input
                    type="number"
                    min={cart.total}
                    step="0.01"
                    inputMode="decimal"
                    value={cashTenderedInput}
                    onChange={(event) => setCashTenderedInput(event.target.value)}
                    placeholder="0"
                    className="mt-5 h-28 rounded-[28px] border-orange-200 px-8 text-center text-5xl font-semibold text-slate-950 md:text-6xl xl:text-7xl"
                  />
                </div>
              </div>

              <div className="flex h-full flex-col gap-5">
                <div className="rounded-[32px] border border-slate-200 bg-slate-50 p-6 text-center shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Cliente entrega</p>
                  <p className="mt-4 break-words text-5xl font-semibold tracking-tight text-slate-950 md:text-6xl xl:text-7xl">{formatCurrency(cashTendered)}</p>
                </div>

                <div className="rounded-[32px] border border-emerald-200 bg-emerald-50 p-6 text-center shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">Devuelta</p>
                  <p className="mt-4 break-words text-5xl font-semibold tracking-tight text-emerald-900 md:text-6xl xl:text-7xl">{formatCurrency(cashChange)}</p>
                </div>

                {cashShortfall > 0.009 ? (
                  <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-base font-medium text-rose-700">
                    Faltan {formatCurrency(cashShortfall)} para completar el pago.
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-emerald-200 bg-emerald-100 px-5 py-4 text-base font-medium text-emerald-800">
                    El cambio quedó listo para mostrar al cliente y al registrador.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Canal</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {FLOW_OPTIONS.find((option) => option.value === paymentFlow)?.label} · {SOURCE_OPTIONS.find((option) => option.value === paymentSource)?.label}
                </p>
                <p className="mt-1 text-sm text-slate-500">Total a facturar: {formatCurrency(cart.total)}</p>
                {pendingInvoiceNumber ? <p className="mt-1 text-sm text-slate-500">Factura borrador: {pendingInvoiceNumber}</p> : null}
              </div>

              {checkoutSession?.url ? (
                <>
                  {paymentFlow === 'QR' ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-6">
                      {qrDataUrl ? <img src={qrDataUrl} alt="QR de pago" className="h-64 w-64 rounded-2xl bg-white p-3" /> : <QrCode className="h-20 w-20 text-orange-500" />}
                      <p className="mt-3 text-sm text-slate-600">Escanea este QR para abrir el checkout de Bold.</p>
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50 px-4 py-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Link de checkout Bold</p>
                    <p className="mt-1 break-all">{checkoutSession.url}</p>
                    <div className="mt-3 flex gap-2">
                      <Button type="button" variant="outline" className="rounded-2xl" onClick={() => window.open(checkoutSession.url, '_blank', 'noopener,noreferrer')}>
                        <ExternalLink className="mr-2 h-4 w-4" />Abrir checkout
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setCheckoutOpen(false)}>
              Volver
            </Button>
            {!checkoutSession ? (
              <Button
                type="button"
                className="rounded-2xl bg-orange-500 text-white hover:bg-orange-600"
                onClick={() => void processSale()}
                disabled={submitting || !canCompleteCashSale}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : paymentFlow === 'CASH' ? 'Registrar venta' : 'Generar checkout'}
              </Button>
            ) : (
              <Button type="button" className="rounded-2xl bg-orange-500 text-white hover:bg-orange-600" onClick={() => pendingInvoiceId && openInvoicePdf(pendingInvoiceId)}>
                Abrir borrador PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}