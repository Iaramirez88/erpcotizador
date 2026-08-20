"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const ITEMS = [
  {
    href: "/dashboard/productos",
    label: "Productos",
    description: "Catálogo y precios",
    match: (pathname: string) => pathname.startsWith("/dashboard/productos") || pathname.startsWith("/dashboard/materiales"),
  },
  {
    href: "/dashboard/inventario",
    label: "Inventario",
    description: "Stock y movimientos",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario") && !pathname.startsWith("/dashboard/inventario/abastecimiento") && !pathname.startsWith("/dashboard/inventario/traslados"),
  },
  {
    href: "/dashboard/inventario/abastecimiento",
    label: "Abastecimiento",
    description: "Solicitudes entre sedes",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario/abastecimiento"),
  },
  {
    href: "/dashboard/inventario/traslados",
    label: "Traslados",
    description: "Movimientos entre bodegas",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario/traslados"),
  },
  {
    href: "/dashboard/compras",
    label: "Compras",
    description: "Órdenes y abastecimiento",
    match: (pathname: string) => pathname.startsWith("/dashboard/compras"),
  },
  {
    href: "/dashboard/proveedores",
    label: "Proveedores",
    description: "Aliados y condiciones",
    match: (pathname: string) => pathname.startsWith("/dashboard/proveedores"),
  },
  {
    href: "/dashboard/configuracion/desperdicios",
    label: "Desperdicios",
    description: "Merma y consumo base",
    match: (pathname: string) => pathname.startsWith("/dashboard/configuracion/desperdicios"),
  },
] as const

export function CatalogModuleTabs() {
  const pathname = usePathname() ?? ""

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-1 shadow-sm">
      <div className="flex flex-wrap gap-1">
        {ITEMS.map((item) => {
          const isActive = item.match(pathname)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "min-w-[180px] flex-1 rounded-[20px] px-4 py-3 text-left transition sm:min-w-[190px]",
                isActive
                  ? "bg-[#FF9800] text-white shadow-sm ring-1 ring-[#FF9800]"
                  : "text-slate-600 hover:bg-[#f0dcc7] hover:text-slate-950"
              )}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className={cn("text-xs", isActive ? "text-white/85" : "text-slate-500")}>{item.description}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}