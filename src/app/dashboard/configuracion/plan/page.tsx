"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatCOP, getPlanPriceCOP, type BillingCycle, type PlanInfo, type PlanTier } from "@/lib/plans"

type PlanApiResponse =
  | {
      ok: true
      current: PlanInfo
      empresa: {
        planTier: PlanTier
        billingCycle: BillingCycle
        planValidUntil: string | null
      } | null
      lastInvoice: LastInvoice | null
      all: PlanInfo[]
      devDefault: PlanTier
    }
  | {
      ok?: false
      error?: string
    }

type CreateBoldLinkResponse =
  | { ok: true; url: string }
  | { ok?: false; error?: string }

type LastInvoice = {
  id: string
  provider: string
  status: string
  planTier: PlanTier
  billingCycle: BillingCycle
  currency: string
  amountCOP: number
  discountPct: number
  externalReference: string
  checkoutUrl: string | null
  expiresAt: string | null
  paidAt: string | null
  createdAt: string
}

export default function PlanPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<PlanInfo | null>(null)
  const [all, setAll] = useState<PlanInfo[]>([])
  const [empresa, setEmpresa] = useState<{
    planTier: PlanTier
    billingCycle: BillingCycle
    planValidUntil: string | null
  } | null>(null)
  const [lastInvoice, setLastInvoice] = useState<LastInvoice | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>("MONTHLY")
  const [isPaying, setIsPaying] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/plan")
        const json = (await res.json().catch(() => ({}))) as PlanApiResponse

        if (!res.ok) {
          setError(("error" in json && json.error) || "No se pudo cargar el plan")
          return
        }

        if (!cancelled && "ok" in json && json.ok) {
          setCurrent(json.current)
          setEmpresa(json.empresa)
          setCycle(json.empresa?.billingCycle ?? "MONTHLY")
          setAll(json.all)
          setLastInvoice(json.lastInvoice)
          return
        }

        if (!cancelled) {
          setError("Respuesta inválida del servidor")
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error inesperado")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()

    // Si vienes del callback de Bold (?ref=...), refresca unos segundos para capturar el webhook.
    let interval: number | null = null
    let timeout: number | null = null
    try {
      const ref = new URLSearchParams(window.location.search).get("ref")
      if (ref) {
        interval = window.setInterval(() => {
          void load()
        }, 3000)
        timeout = window.setTimeout(() => {
          if (interval) window.clearInterval(interval)
        }, 30000)
      }
    } catch {
      // ignore
    }

    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
      if (timeout) window.clearTimeout(timeout)
    }
  }, [])

  const sortedPlans = useMemo(() => {
    const order: PlanTier[] = ["BASIC", "MEDIO", "INTERMEDIO", "FULL"]
    return [...all].sort((a, b) => order.indexOf(a.tier) - order.indexOf(b.tier))
  }, [all])

  async function startPayment(tier: PlanTier) {
    setIsPaying(true)
    setError(null)
    try {
      const res = await fetch("/api/billing/bold/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, cycle }),
      })

      const json = (await res.json().catch(() => ({}))) as CreateBoldLinkResponse
      if (!res.ok || !("ok" in json) || !json.ok) {
        setError(("error" in json && json.error) || "No se pudo iniciar el pago")
        return
      }

      if (!json.url) {
        setError("Respuesta inválida del servidor (sin url)")
        return
      }

      window.location.href = json.url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado")
    } finally {
      setIsPaying(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plan</h1>
        <p className="text-sm text-gray-600">Gestiona tu plan y facturación.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Plan actual</CardTitle>
          <CardDescription>Este es el plan asociado a tu empresa.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-gray-600">Cargando…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : current ? (
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">{current.nombre}</div>
                <div className="text-sm text-gray-600">{current.descripcion}</div>
                <div className="mt-2 text-sm text-gray-700">
                  <span className="font-medium">{formatCOP(current.precioMensualCOP)}</span> / mes
                </div>
                {empresa?.planValidUntil ? (
                  <div className="mt-1 text-sm text-gray-700">
                    Vigente hasta:{" "}
                    <span className="font-medium">
                      {new Date(empresa.planValidUntil).toLocaleDateString("es-CO", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">No se encontró el plan actual.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturación</CardTitle>
          <CardDescription>Elige mensual o anual (10% de descuento anual).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={cycle === "MONTHLY" ? "default" : "secondary"}
              onClick={() => setCycle("MONTHLY")}
              disabled={isPaying}
            >
              Mensual
            </Button>
            <Button
              type="button"
              variant={cycle === "YEARLY" ? "default" : "secondary"}
              onClick={() => setCycle("YEARLY")}
              disabled={isPaying}
            >
              Anual (-10%)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Último cobro</CardTitle>
          <CardDescription>Estado del último intento de pago registrado.</CardDescription>
        </CardHeader>
        <CardContent>
          {!lastInvoice ? (
            <div className="text-sm text-gray-600">Aún no hay cobros registrados.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded",
                    lastInvoice.status === "PAID"
                      ? "bg-green-50 text-green-700"
                      : lastInvoice.status === "PENDING"
                        ? "bg-yellow-50 text-yellow-800"
                        : lastInvoice.status === "REJECTED"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-100 text-gray-700"
                  )}
                >
                  {lastInvoice.status}
                </span>
                <span className="text-sm text-gray-700">
                  {formatCOP(lastInvoice.amountCOP)} ({lastInvoice.billingCycle === "YEARLY" ? "Anual" : "Mensual"})
                </span>
              </div>

              <div className="text-sm text-gray-700">
                Referencia: <span className="font-mono text-xs">{lastInvoice.externalReference}</span>
              </div>
              <div className="text-xs text-gray-500">
                Creado: {new Date(lastInvoice.createdAt).toLocaleString("es-CO")}
                {lastInvoice.paidAt ? ` · Pagado: ${new Date(lastInvoice.paidAt).toLocaleString("es-CO")}` : ""}
              </div>

              {lastInvoice.status === "PENDING" && lastInvoice.checkoutUrl ? (
                <div className="pt-2">
                  <Button type="button" variant="secondary" onClick={() => (window.location.href = lastInvoice.checkoutUrl!)}>
                    Continuar pago
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sortedPlans.map((p) => {
          const isCurrent = current?.tier === p.tier
          const displayPrice = getPlanPriceCOP(p.tier, cycle)
          const disablePay = isPaying || isLoading || (isCurrent && empresa?.billingCycle === cycle && !!empresa?.planValidUntil)

          return (
            <Card
              key={p.tier}
              className={cn(
                "border",
                isCurrent ? "border-blue-500 ring-1 ring-blue-200" : "border-gray-200"
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.nombre}</span>
                  {isCurrent ? (
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                      Actual
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription>{p.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{formatCOP(displayPrice)}</div>
                <div className="text-sm text-gray-600">{cycle === "YEARLY" ? "COP / año" : "COP / mes"}</div>

                <div className="mt-4">
                  <Button
                    className="w-full"
                    disabled={disablePay}
                    variant={isCurrent ? "secondary" : "default"}
                    onClick={() => startPayment(p.tier)}
                  >
                    {isPaying ? "Redirigiendo…" : isCurrent ? "Plan actual" : "Cambiar a este plan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
