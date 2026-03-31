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
    match: (pathname: string) => pathname.startsWith("/dashboard/inventario"),
  },
] as const

export function CatalogModuleTabs() {
  const pathname = usePathname() ?? ""

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-1 shadow-sm">
      <div className="grid gap-1 sm:grid-cols-2">
        {ITEMS.map((item) => {
          const isActive = item.match(pathname)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[20px] px-4 py-3 text-left transition",
                isActive ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className={cn("text-xs", isActive ? "text-slate-200" : "text-slate-500")}>{item.description}</div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}