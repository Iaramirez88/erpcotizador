"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const ITEMS = [
  {
    href: "/dashboard/productos",
    label: "Productos",
    match: (pathname: string) => pathname.startsWith("/dashboard/productos") || pathname.startsWith("/dashboard/materiales"),
  },
  {
    href: "/dashboard/inventario",
    label: "Inventario",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario") && !pathname.startsWith("/dashboard/inventario/abastecimiento") && !pathname.startsWith("/dashboard/inventario/traslados"),
  },
  {
    href: "/dashboard/inventario/abastecimiento",
    label: "Abastecimiento",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario/abastecimiento"),
  },
  {
    href: "/dashboard/inventario/traslados",
    label: "Traslados",
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario/traslados"),
  },
  {
    href: "/dashboard/compras",
    label: "Compras",
    match: (pathname: string) => pathname.startsWith("/dashboard/compras"),
  },
  {
    href: "/dashboard/proveedores",
    label: "Proveedores",
    match: (pathname: string) => pathname.startsWith("/dashboard/proveedores"),
  },
  {
    href: "/dashboard/configuracion/desperdicios",
    label: "Desperdicios",
    match: (pathname: string) => pathname.startsWith("/dashboard/configuracion/desperdicios"),
  },
] as const

export function CatalogModuleTabs() {
  const pathname = usePathname() ?? ""

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-2 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {ITEMS.map((item) => {
          const isActive = item.match(pathname)

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