/**
 * Página Principal del Dashboard
 * 
 * Muestra estadísticas generales y acceso rápido a módulos
 * Protegida por autenticación
 */

import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getServerLanguage } from "@/lib/i18n/server"
import { translate } from "@/lib/i18n/messages"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

function fmtDate(date: Date | null | undefined, locale: string, naText: string) {
  if (!date) return naText
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
  } catch {
    return String(date)
  }
}

function fmtCOP(value: number | null | undefined, locale: string) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0
  return new Intl.NumberFormat(locale, { style: "currency", currency: "COP" }).format(numberValue)
}

type SearchParams = {
  sedeId?: string
  from?: string
  to?: string
  scope?: string
}

type RecentCotizacion = {
  id: string
  numero: string
  total: number
  estado: string
  createdAt: Date
  cliente: { nombre: string }
}

type RecentOrden = {
  id: string
  numero: string
  estado: string
  total: number
  createdAt: Date
  cliente: { nombre: string }
}

type RecentCompra = {
  id: string
  proveedorNombre: string
  estado: string
  total: number
  fechaCompra: Date
  numeroFactura: string | null
}

type RecentScan = {
  id: string
  tipo: string
  status: string
  approved: boolean
  originalFileName: string | null
  createdAt: Date
}

type RecentNotification = {
  id: string
  type: string
  title: string
  body: string | null
  createdAt: Date
  readAt: Date | null
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>
}) {
  const language = await getServerLanguage()
  const t = (key: string, vars?: Record<string, string | number>) => translate(language, key, vars)
  const locale = language === 'en' ? 'en-US' : 'es-CO'
  const naText = t('common.na')

  // Verificar sesión
  const session = await auth()
  
  if (!session || !session.user) {
    redirect("/auth/login")
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const sessionUserId = session.user.id
  const sessionEmail = session.user.email

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(sessionUserId ? [{ id: sessionUserId }] : []),
        ...(sessionEmail ? [{ email: sessionEmail }] : []),
      ],
    },
    select: {
      id: true,
      name: true,
      sedeMemberships: {
        select: {
          id: true,
          role: true,
          sede: { select: { id: true, nombre: true, codigo: true } },
        },
      },
    },
  })

  if (!user) {
    redirect("/auth/login")
  }

  const allowedSedes = user.sedeMemberships.map((m) => m.sede).filter((s) => !!s?.id)
  const allowedSedeIds = allowedSedes.map((s) => s.id)
  const defaultSedeId = allowedSedeIds[0] ?? null

  const rawSedeId = typeof resolvedSearchParams?.sedeId === "string" ? resolvedSearchParams.sedeId : null
  const sedeId = rawSedeId && allowedSedeIds.includes(rawSedeId) ? rawSedeId : defaultSedeId
  const sedeScope = sedeId
    ? { sedeId }
    : allowedSedeIds.length
      ? { sedeId: { in: allowedSedeIds } }
      : { sedeId: '__NO_SEDE__' }

  // Algunos modelos (POS) no aceptan sedeId null. En ese caso, usamos un filtro "imposible"
  // para retornar 0 filas cuando no hay sede resoluble.
  const posSedeScope = sedeId
    ? { sedeId }
    : allowedSedeIds.length
      ? { sedeId: { in: allowedSedeIds } }
      : { sedeId: '__NO_SEDE__' }

  const activeMembershipRole = sedeId
    ? (user.sedeMemberships.find((m) => m.sede.id === sedeId)?.role ?? null)
    : null

  const canSeeSedeActivity =
    session.user.role === "ADMIN" || activeMembershipRole === "ADMIN" || activeMembershipRole === "MANAGER"

  const rawFrom = typeof resolvedSearchParams?.from === "string" ? resolvedSearchParams.from : ""
  const rawTo = typeof resolvedSearchParams?.to === "string" ? resolvedSearchParams.to : ""

  const rawScope = typeof resolvedSearchParams?.scope === "string" ? resolvedSearchParams.scope : ""
  const scope = rawScope === "sede" && canSeeSedeActivity ? "sede" : "me"
  const showMeActivity = scope === "me"
  const showSedeActivity = scope === "sede"

  function buildDateRange(whereKey: "createdAt" | "fechaCompra") {
    const range: { gte?: Date; lt?: Date } = {}

    if (rawFrom) {
      const fromDate = new Date(`${rawFrom}T00:00:00`)
      if (!Number.isNaN(fromDate.getTime())) range.gte = fromDate
    }
    if (rawTo) {
      const toDate = new Date(`${rawTo}T00:00:00`)
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setDate(toDate.getDate() + 1)
        range.lt = toDate
      }
    }

    return Object.keys(range).length ? { [whereKey]: range } : {}
  }

  function buildDateRangeAny(whereKey: string) {
    const range: { gte?: Date; lt?: Date } = {}

    if (rawFrom) {
      const fromDate = new Date(`${rawFrom}T00:00:00`)
      if (!Number.isNaN(fromDate.getTime())) range.gte = fromDate
    }
    if (rawTo) {
      const toDate = new Date(`${rawTo}T00:00:00`)
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setDate(toDate.getDate() + 1)
        range.lt = toDate
      }
    }

    return Object.keys(range).length ? ({ [whereKey]: range } as Record<string, unknown>) : {}
  }

  const cotWhere = { vendedorId: user.id, ...sedeScope, ...buildDateRange("createdAt") }
  const ordWhere = { vendedorId: user.id, ...sedeScope, ...buildDateRange("createdAt") }
  const compraWhere = { userId: user.id, ...sedeScope, ...buildDateRange("fechaCompra") }
  const scanWhere = { userId: user.id, ...sedeScope, ...buildDateRange("createdAt") }
  const notifWhere = {
    userId: user.id,
    ...(sedeId ? { sedeId } : allowedSedeIds.length ? { sedeId: { in: allowedSedeIds } } : { sedeId: '__NO_SEDE__' }),
    ...buildDateRange("createdAt"),
  }

  const sedeNotifWhere = {
    ...(sedeId ? { sedeId } : allowedSedeIds.length ? { sedeId: { in: allowedSedeIds } } : { sedeId: '__NO_SEDE__' }),
    ...buildDateRange("createdAt"),
  }

  const sedeCotWhere = { ...sedeScope, ...buildDateRange("createdAt") }
  const sedeOrdWhere = { ...sedeScope, ...buildDateRange("createdAt") }
  const sedeCompraWhere = { ...sedeScope, ...buildDateRange("fechaCompra") }
  const sedeScanWhere = { ...sedeScope, ...buildDateRange("createdAt") }

  const posInvoiceWhere = {
    ...(showMeActivity ? { createdById: user.id } : {}),
    ...posSedeScope,
    ...buildDateRangeAny("createdAt"),
  }
  const posReturnWhere = {
    ...(showMeActivity ? { createdById: user.id } : {}),
    ...posSedeScope,
    ...buildDateRangeAny("createdAt"),
  }
  const posPaymentWhere = {
    ...(showMeActivity
      ? { invoice: { createdById: user.id, ...posSedeScope } }
      : { invoice: { ...posSedeScope } }),
    ...buildDateRangeAny("receivedAt"),
  }

  const sedePosInvoiceWhere = { ...posSedeScope, ...buildDateRangeAny("createdAt") }
  const sedePosReturnWhere = { ...posSedeScope, ...buildDateRangeAny("createdAt") }
  const sedePosPaymentWhere = { invoice: { ...posSedeScope }, ...buildDateRangeAny("receivedAt") }

  const compraPagoWhere = {
    ...(showMeActivity ? { userId: user.id } : {}),
    ...(sedeId ? { sedeId } : allowedSedeIds.length ? { sedeId: { in: allowedSedeIds } } : { sedeId: '__NO_SEDE__' }),
    ...buildDateRangeAny("fecha"),
  }

  const sedeCompraPagoWhere = {
    ...(sedeId ? { sedeId } : allowedSedeIds.length ? { sedeId: { in: allowedSedeIds } } : { sedeId: '__NO_SEDE__' }),
    ...buildDateRangeAny("fecha"),
  }

  const [
    totalCotizaciones,
    cotizacionesPendientes,
    cotizacionesAprobadas,
    totalOrdenes,
    comprasCount,
    escaneosCount,
    notificacionesCount,
    cotizacionesAprobadasTotal,
    ordenesTotal,
    comprasTotal,
    pagosProveedoresEnRango,
    pagosAcumuladosCompras,
    posVentasBrutas,
    posDevoluciones,
    posCobros,
    recentCotizaciones,
    recentOrdenes,
    recentCompras,
    recentScans,
    recentNotifications,
    sedeTotalCotizaciones,
    sedeCotizacionesPendientes,
    sedeCotizacionesAprobadas,
    sedeTotalOrdenes,
    sedeComprasCount,
    sedeEscaneosCount,
    sedeNotificacionesCount,
    sedeCotizacionesAprobadasTotal,
    sedeOrdenesTotal,
    sedeComprasTotal,
    sedePagosProveedoresEnRango,
    sedePagosAcumuladosCompras,
    sedePosVentasBrutas,
    sedePosDevoluciones,
    sedePosCobros,
    sedeRecentCotizaciones,
    sedeRecentOrdenes,
    sedeRecentCompras,
    sedeRecentScans,
    sedeRecentNotifications,
  ] = await Promise.all([
    prisma.cotizacion.count({ where: cotWhere }),
    prisma.cotizacion.count({ where: { ...cotWhere, estado: "ENVIADA" } }),
    prisma.cotizacion.count({ where: { ...cotWhere, estado: "APROBADA" } }),
    prisma.ordenTrabajo.count({ where: ordWhere }),
    prisma.compra.count({ where: compraWhere }),
    prisma.documentScan.count({ where: scanWhere }),
    prisma.notification.count({ where: notifWhere }),
    prisma.cotizacion
      .aggregate({ where: { ...cotWhere, estado: "APROBADA" }, _sum: { total: true } })
      .then((r) => r._sum?.total ?? 0),
    prisma.ordenTrabajo.aggregate({ where: ordWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0),
    prisma.compra.aggregate({ where: compraWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0),
    prisma.compraPago.aggregate({ where: compraPagoWhere, _sum: { monto: true } }).then((r) => r._sum?.monto ?? 0),
    prisma.compraPago
      .aggregate({ where: { compra: compraWhere }, _sum: { monto: true } })
      .then((r) => r._sum?.monto ?? 0),
    prisma.posInvoice.aggregate({ where: posInvoiceWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0),
    prisma.posReturn.aggregate({ where: posReturnWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0),
    prisma.posPayment.aggregate({ where: posPaymentWhere, _sum: { amount: true } }).then((r) => r._sum?.amount ?? 0),
    prisma.cotizacion.findMany({
      where: cotWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        numero: true,
        total: true,
        estado: true,
        createdAt: true,
        cliente: { select: { nombre: true } },
      },
    }),
    prisma.ordenTrabajo.findMany({
      where: ordWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        numero: true,
        estado: true,
        total: true,
        createdAt: true,
        cliente: { select: { nombre: true } },
      },
    }),
    prisma.compra.findMany({
      where: compraWhere,
      orderBy: { fechaCompra: "desc" },
      take: 6,
      select: {
        id: true,
        proveedorNombre: true,
        estado: true,
        total: true,
        fechaCompra: true,
        numeroFactura: true,
      },
    }),
    prisma.documentScan.findMany({
      where: scanWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        tipo: true,
        status: true,
        approved: true,
        originalFileName: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({
      where: notifWhere,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, type: true, title: true, body: true, createdAt: true, readAt: true },
    }),

    // Actividad por sede (solo si se está viendo "Actividad de la sede").
    showSedeActivity ? prisma.cotizacion.count({ where: sedeCotWhere }) : Promise.resolve(0),
    showSedeActivity ? prisma.cotizacion.count({ where: { ...sedeCotWhere, estado: "ENVIADA" } }) : Promise.resolve(0),
    showSedeActivity ? prisma.cotizacion.count({ where: { ...sedeCotWhere, estado: "APROBADA" } }) : Promise.resolve(0),
    showSedeActivity ? prisma.ordenTrabajo.count({ where: sedeOrdWhere }) : Promise.resolve(0),
    showSedeActivity ? prisma.compra.count({ where: sedeCompraWhere }) : Promise.resolve(0),
    showSedeActivity ? prisma.documentScan.count({ where: sedeScanWhere }) : Promise.resolve(0),
    showSedeActivity ? prisma.notification.count({ where: sedeNotifWhere }) : Promise.resolve(0),
    showSedeActivity
      ? prisma.cotizacion
          .aggregate({ where: { ...sedeCotWhere, estado: "APROBADA" }, _sum: { total: true } })
          .then((r) => r._sum?.total ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.ordenTrabajo.aggregate({ where: sedeOrdWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.compra.aggregate({ where: sedeCompraWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.compraPago.aggregate({ where: sedeCompraPagoWhere, _sum: { monto: true } }).then((r) => r._sum?.monto ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.compraPago
          .aggregate({ where: { compra: sedeCompraWhere }, _sum: { monto: true } })
          .then((r) => r._sum?.monto ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.posInvoice.aggregate({ where: sedePosInvoiceWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.posReturn.aggregate({ where: sedePosReturnWhere, _sum: { total: true } }).then((r) => r._sum?.total ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.posPayment.aggregate({ where: sedePosPaymentWhere, _sum: { amount: true } }).then((r) => r._sum?.amount ?? 0)
      : Promise.resolve(0),
    showSedeActivity
      ? prisma.cotizacion.findMany({
          where: sedeCotWhere,
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            numero: true,
            total: true,
            estado: true,
            createdAt: true,
            cliente: { select: { nombre: true } },
          },
        })
      : Promise.resolve([] as RecentCotizacion[]),
    showSedeActivity
      ? prisma.ordenTrabajo.findMany({
          where: sedeOrdWhere,
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            numero: true,
            estado: true,
            total: true,
            createdAt: true,
            cliente: { select: { nombre: true } },
          },
        })
      : Promise.resolve([] as RecentOrden[]),
    showSedeActivity
      ? prisma.compra.findMany({
          where: sedeCompraWhere,
          orderBy: { fechaCompra: "desc" },
          take: 6,
          select: {
            id: true,
            proveedorNombre: true,
            estado: true,
            total: true,
            fechaCompra: true,
            numeroFactura: true,
          },
        })
      : Promise.resolve([] as RecentCompra[]),
    showSedeActivity
      ? prisma.documentScan.findMany({
          where: sedeScanWhere,
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            tipo: true,
            status: true,
            approved: true,
            originalFileName: true,
            createdAt: true,
          },
        })
      : Promise.resolve([] as RecentScan[]),
    showSedeActivity
      ? prisma.notification.findMany({
          where: sedeNotifWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, type: true, title: true, body: true, createdAt: true, readAt: true },
        })
      : Promise.resolve([] as RecentNotification[]),
  ])

  const resumen = showSedeActivity
    ? {
        cotizacionesAprobadasTotal: sedeCotizacionesAprobadasTotal,
        ordenesTotal: sedeOrdenesTotal,
        comprasTotal: sedeComprasTotal,
        pagosProveedoresEnRango: sedePagosProveedoresEnRango,
        pagosAcumuladosCompras: sedePagosAcumuladosCompras,
        posVentasBrutas: sedePosVentasBrutas,
        posDevoluciones: sedePosDevoluciones,
        posCobros: sedePosCobros,
      }
    : {
        cotizacionesAprobadasTotal,
        ordenesTotal,
        comprasTotal,
        pagosProveedoresEnRango,
        pagosAcumuladosCompras,
        posVentasBrutas,
        posDevoluciones,
        posCobros,
      }

  const posVentasNetas = (resumen.posVentasBrutas ?? 0) - (resumen.posDevoluciones ?? 0)
  const saldoProveedores = (resumen.comprasTotal ?? 0) - (resumen.pagosAcumuladosCompras ?? 0)

  const activeSedeLabel = sedeId
    ? allowedSedes.find((s) => s.id === sedeId)
    : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {session.user.name || session.user.email
            ? t('dashboard.header.welcomeBack', { name: session.user.name ?? session.user.email ?? '' })
            : t('dashboard.header.welcomeBackGeneric')}
        </h1>
        <p className="text-muted-foreground">
          {activeSedeLabel
            ? t('dashboard.header.activityWithSede', { sede: activeSedeLabel.nombre })
            : t('dashboard.header.activity')}
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{t('dashboard.filters.title')}</CardTitle>
          <CardDescription>{t('dashboard.filters.description')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <form method="get" className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label>{t('dashboard.filters.warehouse')}</Label>
              <select
                name="sedeId"
                defaultValue={sedeId ?? ""}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                {allowedSedes.length ? (
                  allowedSedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}{s.codigo ? ` (${s.codigo})` : ""}
                    </option>
                  ))
                ) : (
                  <option value="">{t('dashboard.filters.noWarehouses')}</option>
                )}
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t('dashboard.filters.scopeLabel')}</Label>
              <select
                name="scope"
                defaultValue={scope}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="me">{t('dashboard.filters.scope.me')}</option>
                {canSeeSedeActivity ? <option value="sede">{t('dashboard.filters.scope.sede')}</option> : null}
              </select>
            </div>

            <div className="space-y-1">
              <Label>{t('dashboard.filters.from')}</Label>
              <Input name="from" type="date" defaultValue={rawFrom} />
            </div>

            <div className="space-y-1">
              <Label>{t('dashboard.filters.to')}</Label>
              <Input name="to" type="date" defaultValue={rawTo} />
            </div>

            <div>
              <button className="h-10 w-full rounded-md bg-slate-900 text-slate-50 text-sm font-medium hover:bg-slate-800">
                {t('dashboard.filters.apply')}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resumen general */}
      <div>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-xl font-semibold">{t('dashboard.summary.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.summary.line', {
                view: showSedeActivity ? t('dashboard.summary.view.sede') : t('dashboard.summary.view.me'),
              })}
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link href="/dashboard/reportes" className="text-sky-600 hover:underline">
              {t('dashboard.summary.links.reports')}
            </Link>
            <Link href="/dashboard/pos" className="text-sky-600 hover:underline">
              {t('dashboard.summary.links.pos')}
            </Link>
            <Link href="/dashboard/compras" className="text-sky-600 hover:underline">
              {t('dashboard.summary.links.purchases')}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.posNetSales.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(posVentasNetas, locale)}</div>
              <p className="text-xs text-muted-foreground">
                {t('dashboard.cards.posNetSales.subtitle', {
                  gross: fmtCOP(resumen.posVentasBrutas, locale),
                  returns: fmtCOP(resumen.posDevoluciones, locale),
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.posCollections.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(resumen.posCobros, locale)}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.cards.posCollections.subtitle')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.approvedQuotes.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(resumen.cotizacionesAprobadasTotal, locale)}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.cards.approvedQuotes.subtitle')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.ordersTotal.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(resumen.ordenesTotal, locale)}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.cards.ordersTotal.subtitle')}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.purchasesTotal.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(resumen.comprasTotal, locale)}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.cards.purchasesTotal.subtitle')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.supplierPayments.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(resumen.pagosProveedoresEnRango, locale)}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.cards.supplierPayments.subtitle')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('dashboard.cards.supplierBalance.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtCOP(saldoProveedores, locale)}</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.cards.supplierBalance.subtitle')}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mi actividad */}
      {showMeActivity ? (
      <div>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-xl font-semibold">{t('dashboard.me.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('dashboard.me.description')}</p>
          </div>
          <Link href="/dashboard/perfil" className="text-sm text-sky-600 hover:underline">
            {t('dashboard.me.viewProfile')}
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.totalQuotes')}</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCotizaciones}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.totalQuotesHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.pending')}</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cotizacionesPendientes}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.pendingHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.approved')}</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <path d="M8 12l2 2 5-5" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cotizacionesAprobadas}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.approvedHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.orders')}</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M9 12h6" />
              <path d="M9 16h6" />
              <path d="M9 8h6" />
              <path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrdenes}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.ordersHint')}</p>
          </CardContent>
        </Card>
      </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.purchases')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{comprasCount}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.filteredRecords')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.scans')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{escaneosCount}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.filteredRecords')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.notifications')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notificacionesCount}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.me.stats.filteredRecords')}</p>
          </CardContent>
        </Card>

        <Link href="/dashboard/notificaciones">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle>{t('dashboard.notifications.center.title')}</CardTitle>
              <CardDescription>{t('dashboard.notifications.center.description')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('dashboard.recent.quotes.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentCotizaciones.length ? (
              recentCotizaciones.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.numero} · {c.cliente.nombre}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(c.createdAt, locale, naText)} · {String(c.estado)}</div>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap">
                    {fmtCOP(c.total, locale)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{t('dashboard.recent.quotes.empty')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('dashboard.recent.orders.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentOrdenes.length ? (
              recentOrdenes.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.numero} · {o.cliente.nombre}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(o.createdAt, locale, naText)} · {String(o.estado)}</div>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap">
                    {fmtCOP(o.total, locale)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{t('dashboard.recent.orders.empty')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('dashboard.recent.purchases.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentCompras.length ? (
              recentCompras.map((co) => (
                <div key={co.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {co.proveedorNombre}{co.numeroFactura ? ` · ${t('dashboard.recent.invoicePrefix', { number: co.numeroFactura })}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">{fmtDate(co.fechaCompra, locale, naText)} · {String(co.estado)}</div>
                  </div>
                  <div className="text-sm font-semibold whitespace-nowrap">
                    {fmtCOP(co.total, locale)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{t('dashboard.recent.purchases.empty')}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('dashboard.recent.scans.title')}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {recentScans.length ? (
              recentScans.map((s) => (
                <div key={s.id} className="border rounded-lg px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium truncate">{s.originalFileName ?? t('dashboard.recent.scanFallback', { id: s.id.slice(0, 8) })}</div>
                    <span className="text-xs rounded-md border px-2 py-0.5">{String(s.tipo)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {fmtDate(s.createdAt, locale, naText)} · {String(s.status)}{s.approved ? ` · ${t('dashboard.recent.scanApproved')}` : ""}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">{t('dashboard.recent.scans.empty')}</div>
            )}
          </CardContent>
        </Card>
      </div>

        <Card className="mt-4">
        <CardHeader className="py-3">
          <CardTitle className="text-base">{t('dashboard.notifications.byWarehouse.title')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {recentNotifications.length ? (
            recentNotifications.map((n) => (
              <div key={n.id} className="border rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{n.title}</div>
                  <span className="text-xs rounded-md border px-2 py-0.5">{String(n.type)}</span>
                </div>
                {n.body ? <div className="text-sm text-muted-foreground mt-1">{n.body}</div> : null}
                <div className="text-xs text-muted-foreground mt-1">{fmtDate(n.createdAt, locale, naText)} · {n.readAt ? t('dashboard.notifications.read') : t('dashboard.notifications.unread')}</div>
              </div>
            ))
          ) : (
            <div className="text-muted-foreground">{t('dashboard.notifications.empty')}</div>
          )}
        </CardContent>
      </Card>

      </div>
      ) : null}

      {/* Actividad por sede (ADMIN/MANAGER) */}
      {showSedeActivity ? (
        <div className="pt-2">
          <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="text-xl font-semibold">{t('dashboard.sede.title')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('dashboard.sede.description')}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.labels.quotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeTotalCotizaciones}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.totalFilter')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.pending')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeCotizacionesPendientes}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.stateIs', { state: 'ENVIADA' })}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.approved')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeCotizacionesAprobadas}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.stateIs', { state: 'APROBADA' })}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.orders')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeTotalOrdenes}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.totalFilter')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.purchases')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeComprasCount}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.totalFilter')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.scans')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeEscaneosCount}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.totalFilter')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('dashboard.me.stats.notifications')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{sedeNotificacionesCount}</div>
                <p className="text-xs text-muted-foreground">{t('dashboard.sede.cards.totalFilter')}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{t('dashboard.sede.recent.quotes.title')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {sedeRecentCotizaciones.length ? (
                  sedeRecentCotizaciones.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.numero} · {c.cliente.nombre}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(c.createdAt, locale, naText)} · {String(c.estado)}</div>
                      </div>
                      <div className="text-sm font-semibold whitespace-nowrap">
                        {fmtCOP(c.total, locale)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">{t('dashboard.recent.quotes.empty')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{t('dashboard.sede.recent.orders.title')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {sedeRecentOrdenes.length ? (
                  sedeRecentOrdenes.map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{o.numero} · {o.cliente.nombre}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(o.createdAt, locale, naText)} · {String(o.estado)}</div>
                      </div>
                      <div className="text-sm font-semibold whitespace-nowrap">
                        {fmtCOP(o.total, locale)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">{t('dashboard.recent.orders.empty')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{t('dashboard.sede.recent.purchases.title')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {sedeRecentCompras.length ? (
                  sedeRecentCompras.map((co) => (
                    <div key={co.id} className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {co.proveedorNombre}{co.numeroFactura ? ` · ${t('dashboard.recent.invoicePrefix', { number: co.numeroFactura })}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtDate(co.fechaCompra, locale, naText)} · {String(co.estado)}</div>
                      </div>
                      <div className="text-sm font-semibold whitespace-nowrap">
                        {fmtCOP(co.total, locale)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">{t('dashboard.recent.purchases.empty')}</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{t('dashboard.sede.recent.scans.title')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {sedeRecentScans.length ? (
                  sedeRecentScans.map((s) => (
                    <div key={s.id} className="border rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{s.originalFileName ?? t('dashboard.recent.scanFallback', { id: s.id.slice(0, 8) })}</div>
                        <span className="text-xs rounded-md border px-2 py-0.5">{String(s.tipo)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {fmtDate(s.createdAt, locale, naText)} · {String(s.status)}{s.approved ? ` · ${t('dashboard.recent.scanApproved')}` : ""}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground">{t('dashboard.recent.scans.empty')}</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader className="py-3">
              <CardTitle className="text-base">{t('dashboard.sede.recent.notifications.title')}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {sedeRecentNotifications.length ? (
                sedeRecentNotifications.map((n) => (
                  <div key={n.id} className="border rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{n.title}</div>
                      <span className="text-xs rounded-md border px-2 py-0.5">{String(n.type)}</span>
                    </div>
                    {n.body ? <div className="text-sm text-muted-foreground mt-1">{n.body}</div> : null}
                    <div className="text-xs text-muted-foreground mt-1">{fmtDate(n.createdAt, locale, naText)} · {n.readAt ? t('dashboard.notifications.read') : t('dashboard.notifications.unread')}</div>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">{t('dashboard.notifications.empty')}</div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

    </div>
  )
}
