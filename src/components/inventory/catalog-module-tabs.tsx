"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"

type CatalogModuleTabItem = {
  href: string
  label: string
  match: (pathname: string, params: URLSearchParams) => boolean
}

const INVENTORY_ITEMS: CatalogModuleTabItem[] = [
  {
    href: "/dashboard/productos",
    label: "Catálogo",
    match: (pathname: string) => pathname.startsWith("/dashboard/productos") || pathname.startsWith("/dashboard/materiales") || pathname.startsWith("/dashboard/terminados"),
  },
  {
    href: "/dashboard/inventario",
    label: "Existencias",
    match: (pathname: string, params: URLSearchParams) => pathname === "/dashboard/inventario" && (params.get('view') ?? 'stock') !== 'movements',
  },
  {
    href: "/dashboard/inventario?view=movements",
    label: "Movimientos",
    match: (pathname: string, params: URLSearchParams) => pathname === "/dashboard/inventario" && params.get('view') === 'movements',
  },
  {
    href: "/dashboard/inventario/traslados",
    label: "Traslados",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario/traslados"),
  },
  {
    href: "/dashboard/configuracion/desperdicios",
    label: "Desperdicios",
    match: (pathname: string) => pathname.startsWith("/dashboard/configuracion/desperdicios"),
  },
] as const

const PURCHASE_ITEMS: CatalogModuleTabItem[] = [
  {
    href: "/dashboard/inventario/abastecimiento",
    label: "Solicitudes de compra",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario/abastecimiento"),
  },
  {
    href: "/dashboard/compras?mode=order",
    label: "Órdenes de compra",
    match: (pathname: string, params: URLSearchParams) => pathname === "/dashboard/compras" && params.get('mode') === 'order',
  },
  {
    href: "/dashboard/compras",
    label: "Recepciones",
    match: (pathname: string, params: URLSearchParams) => pathname === "/dashboard/compras" && (params.get('mode') ?? 'purchase') !== 'order',
  },
  {
    href: "/dashboard/proveedores",
    label: "Proveedores",
    match: (pathname: string) => pathname.startsWith("/dashboard/proveedores"),
  },
] as const

type CatalogModuleTabsProps = {
  group: 'inventory' | 'purchases'
}

export function CatalogModuleTabs({ group }: CatalogModuleTabsProps) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const currentParams = new URLSearchParams(searchParams?.toString() ?? '')
  const items = group === 'purchases' ? PURCHASE_ITEMS : INVENTORY_ITEMS

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {items.map((item) => {
          const isActive = item.match(pathname, currentParams)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold leading-none transition",
                isActive
                  ? "bg-[#FF9800] text-white shadow-sm ring-1 ring-[#FF9800]"
                  : "text-slate-600 hover:bg-[#f0dcc7] hover:text-slate-950"
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}