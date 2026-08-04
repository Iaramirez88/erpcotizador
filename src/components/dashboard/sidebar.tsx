/**
 * Componente Sidebar
 * 
 * Barra lateral de navegación del dashboard
 */
"use client"

import Link from "next/link"
import { Lock, Building2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/lib/ui-store"
import { NavSettingsDialog, type NavSettingsItem, type SidebarTooltipPrefs } from "@/components/dashboard/nav-settings-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Image from "next/image"
import { useI18n } from "@/components/providers/i18n-provider"
import { useTheme } from "@/components/providers/theme-provider"
import { buildDashboardNavDefinitions, getDashboardSectionOrder, isOnboardingScopedDashboardHref, moduleForDashboardHref, sectionForDashboardHref } from "@/lib/dashboard-navigation"

interface SidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
    allowedModules?: string[] | null
    allowedNavHrefs?: string[] | null
  }
}

interface NavItem {
  name: string
  href: string
  icon: React.ReactElement
  badge?: string
  description?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const DEFAULT_SIDEBAR_TOOLTIP_PREFS: SidebarTooltipPrefs = { desktop: true, mobile: true }

const NAV_ITEM_DESCRIPTIONS: Record<string, string> = {
  "/dashboard": "Resumen rapido de ventas, tareas y actividad del negocio.",
  "/dashboard/inteligencia": "Cockpit ejecutivo con lectura del negocio, riesgos, oportunidades y acciones sugeridas.",
  "/dashboard/mapa-producto": "Vista general del sistema y sus modulos disponibles.",
  "/dashboard/reportes": "Indicadores, resultados y analisis para tomar decisiones.",
  "/dashboard/plantillas": "Formatos reutilizables para cotizaciones, mensajes y documentos.",
  "/dashboard/contabilidad": "Movimientos contables, comprobantes y control financiero.",
  "/dashboard/contabilidad/nomina": "Liquidacion y seguimiento de pagos al personal.",
  "/dashboard/cotizador": "Crea cotizaciones nuevas de forma rapida y guiada.",
  "/dashboard/cotizaciones": "Consulta, edita y da seguimiento a cotizaciones creadas.",
  "/dashboard/remisiones": "Gestiona entregas, despachos y soportes de salida.",
  "/dashboard/pos": "Factura, cobra y registra ventas del punto de venta.",
  "/dashboard/clientes": "Base de clientes con datos, historial y relacion comercial.",
  "/dashboard/odontologia": "Opera pacientes, tratamientos y procesos odontologicos.",
  "/dashboard/crm": "Panel comercial para captar, atender y convertir oportunidades.",
  "/dashboard/crm/conversations": "Centraliza conversaciones de WhatsApp, redes y chatbot.",
  "/dashboard/crm/agenda": "Programa seguimientos, citas y recordatorios comerciales.",
  "/dashboard/crm/chatbot": "Automatiza conversaciones para atender y vender sin estar presente.",
  "/dashboard/crm/archivos": "Guarda y organiza archivos del proceso comercial.",
  "/dashboard/crm/integraciones": "Conecta canales, APIs y automatizaciones del CRM.",
  "/dashboard/crm/auditoria-ia": "Revisa calidad, contexto y decisiones de la IA comercial.",
  "/dashboard/crm/leads": "Captura clientes potenciales y haz seguimiento a cada contacto.",
  "/dashboard/crm/oportunidades": "Gestiona etapas de negocio hasta cerrar la venta.",
  "/dashboard/crm/tareas": "Controla pendientes, seguimientos y trabajo del equipo.",
  "/dashboard/espacios-trabajo": "Separa operaciones por equipos, marcas o unidades.",
  "/dashboard/chat": "Chat interno o global para coordinar al equipo.",
  "/dashboard/ordenes": "Administra ordenes de produccion, servicio o trabajo.",
  "/dashboard/litografia": "Opera cotizacion, produccion y control de litografia.",
  "/dashboard/litografia/conocimiento-ia": "Entrena la IA con reglas, productos y criterios del negocio.",
  "/dashboard/litografia/auditoria-ia": "Supervisa respuestas y decisiones de la IA de litografia.",
  "/dashboard/imagenes-ia/generador": "Genera imagenes de apoyo para ventas y produccion.",
  "/dashboard/imagenes-ia/vectorizador": "Convierte imagenes en vectores listos para produccion.",
  "/dashboard/escaneos": "Digitaliza documentos y extrae informacion util.",
  "/dashboard/productos": "Catalogo de productos, precios y configuraciones.",
  "/dashboard/inventario": "Existencias, movimientos y control de stock.",
  "/dashboard/inventario/traslados": "Mueve inventario entre sedes o bodegas.",
  "/dashboard/compras": "Gestiona compras, abastecimiento y costos.",
  "/dashboard/proveedores": "Base de proveedores, contactos y condiciones de compra.",
  "/dashboard/configuracion/desperdicios": "Controla mermas y desperdicios operativos.",
  "/dashboard/configuracion/sedes": "Administra sucursales, ubicaciones y operacion por sede.",
  "/dashboard/configuracion/usuarios": "Crea usuarios y administra roles, permisos y acceso al sistema.",
  "/dashboard/configuracion/empresa": "Configura datos, imagen y parametros de la empresa.",
  "/dashboard/configuracion/notificaciones": "Activa o desactiva notificaciones push y revisa los dispositivos vinculados a tu usuario.",
  "/dashboard/configuracion/servicios-web": "Administra servicios web y modulos conectados.",
  "/dashboard/configuracion/plan": "Consulta tu plan, limites y opciones de actualizacion.",
  "/dashboard/configuracion/super-admin/modulos-por-plan": "Configura modulos y alcances por tipo de plan.",
  "/dashboard/configuracion/super-admin/empresas": "Administra empresas registradas en la plataforma.",
  "/dashboard/configuracion/super-admin/usuarios": "Gestiona usuarios globales de todas las empresas.",
  "/dashboard/perfil": "Actualiza tus datos personales y preferencias de cuenta.",
  "/dashboard/notificaciones": "Revisa alertas, avisos y eventos pendientes.",
  "/dashboard/ayuda": "Encuentra guias, soporte y documentacion del sistema.",
}

function getNavItemDescription(item: NavItem) {
  return item.description ?? NAV_ITEM_DESCRIPTIONS[item.href] ?? item.name
}

function normalizeSidebarTooltipPrefs(value: Partial<SidebarTooltipPrefs> | null | undefined): SidebarTooltipPrefs {
  return {
    desktop: value?.desktop !== false,
    mobile: value?.mobile !== false,
  }
}

function NavItemTooltipContent({ item, isBlocked, upgradePlanLabel }: { item: NavItem; isBlocked?: boolean; upgradePlanLabel: string }) {
  return (
    <TooltipContent side="right" align="center" className="max-w-64 text-[11px] leading-4">
      <div className="font-medium text-foreground">{item.name}</div>
      <div className="mt-1 text-muted-foreground">{getNavItemDescription(item)}</div>
      {isBlocked ? (
        <div className="mt-2 text-[10px] font-medium text-amber-600">Disponible al actualizar a plan {upgradePlanLabel}.</div>
      ) : null}
    </TooltipContent>
  )
}

function SidebarNavTooltip({
  children,
  item,
  isBlocked,
  upgradePlanLabel,
  enabled,
}: {
  children: React.ReactNode
  item: NavItem
  isBlocked?: boolean
  upgradePlanLabel: string
  enabled: boolean
}) {
  if (!enabled) return <>{children}</>

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <NavItemTooltipContent item={item} isBlocked={isBlocked} upgradePlanLabel={upgradePlanLabel} />
    </Tooltip>
  )
}

function sortNavItemsByOrder(items: NavItem[], order: string[]) {
  if (!order.length) return items
  const orderMap = new Map(order.map((href, index) => [href, index]))
  return [...items].sort((a, b) => (orderMap.get(a.href) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(b.href) ?? Number.MAX_SAFE_INTEGER))
}

function getOrderIndex(href: string, order: string[]) {
  const index = order.indexOf(href)
  return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function sortSectionsByOrder(sections: NavSection[], order: string[]) {
  if (!order.length) return sections
  return [...sections].sort((a, b) => {
    const aIndex = Math.min(...a.items.map((item) => getOrderIndex(item.href, order)))
    const bIndex = Math.min(...b.items.map((item) => getOrderIndex(item.href, order)))
    return aIndex - bIndex
  })
}

function buildModuleNavigation(t: (key: string) => string): NavItem[] {
  return [
  {
    name: t('nav.dashboard'),
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    name: 'Inteligencia',
    href: "/dashboard/inteligencia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6M12 3v3M8 9a4 4 0 118 0c0 1.4-.5 2.3-1.5 3.4-.8.9-1.3 1.7-1.5 2.6h-2c-.2-.9-.7-1.7-1.5-2.6C8.5 11.3 8 10.4 8 9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.5 18h5M10 21h4" />
      </svg>
    ),
  },
  {
    name: 'Mapa de producto',
    href: "/dashboard/mapa-producto",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 16l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: t('nav.reports'),
    href: "/dashboard/reportes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: t('nav.templates'),
    href: "/dashboard/plantillas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    name: t('nav.accounting'),
    href: "/dashboard/contabilidad",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14h6m-6 4h6M7 4h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    name: 'Notificaciones moviles',
    href: "/dashboard/configuracion/notificaciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
      </svg>
    ),
  },
  {
    name: 'Nómina',
    href: "/dashboard/contabilidad/nomina",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5a2 2 0 002 2h2a2 2 0 002-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6M9 17h6M9 9h2" />
      </svg>
    ),
  },

  // Comercial
  {
    name: t('nav.quote'),
    href: "/dashboard/cotizador",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: t('nav.quotes'),
    href: "/dashboard/cotizaciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V7a2 2 0 00-2-2h-1.5a2.5 2.5 0 00-5 0H8a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: t('nav.deliveries'),
    href: "/dashboard/remisiones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m3-10H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2zm-7-2h2a2 2 0 012 2v0H9v0a2 2 0 012-2z"
        />
      </svg>
    ),
  },
  {
    name: t('nav.billing'),
    href: "/dashboard/pos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 11h12M6 15h6M6 19h12" />
      </svg>
    ),
  },
  {
    name: t('nav.clients'),
    href: "/dashboard/clientes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: 'Odontología',
    href: "/dashboard/odontologia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.8 0 5 2.2 5 5 0 1.6-.7 3-1.9 4l-.4.3-.6 5.8a2.2 2.2 0 01-4.3 0l-.6-5.8-.4-.3A4.98 4.98 0 017 8c0-2.8 2.2-5 5-5z" />
      </svg>
    ),
  },
  {
    name: "Frente comercial",
    href: "/dashboard/crm",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-6 4h8M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    name: 'Inbox omnicanal',
    href: "/dashboard/crm/conversations",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v9H4V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 15l4-3h8l4 3" />
      </svg>
    ),
  },
  {
    name: "Agenda CRM",
    href: "/dashboard/crm/agenda",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
      </svg>
    ),
  },
  {
    name: "Chatbot",
    href: "/dashboard/crm/chatbot",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L6 20.75V17H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H9.75z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h.01M12 9h.01M16 9h.01" />
      </svg>
    ),
  },
  {
    name: "Administrador de archivos",
    href: "/dashboard/crm/archivos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm5 5h8m-8 4h5" />
      </svg>
    ),
  },
  {
    name: "Canales e integraciones",
    href: "/dashboard/crm/integraciones",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h8M12 8v8M4 7h4v4H4V7zm12 6h4v4h-4v-4zm0-10h4v4h-4V3zM4 17h4v4H4v-4z" />
      </svg>
    ),
  },
  {
    name: "Auditoría IA CRM",
    href: "/dashboard/crm/auditoria-ia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m4 6V7m4 10v-3M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Captación",
    href: "/dashboard/crm/leads",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M16 3.13a4 4 0 010 7.75M12 7a4 4 0 11-8 0 4 4 0 018 0zm6 14v-2a4 4 0 00-3-3.87" />
      </svg>
    ),
  },
  {
    name: "Pipeline",
    href: "/dashboard/crm/oportunidades",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M7 16l4-4 3 3 5-7" />
      </svg>
    ),
  },
  {
    name: "Tareas",
    href: "/dashboard/crm/tareas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 7h6m-6 4h6" />
      </svg>
    ),
  },
  {
    name: "Espacios de trabajo",
    href: "/dashboard/espacios-trabajo",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h10M4 17h16M18 10l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: "Chat global",
    href: "/dashboard/chat",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4v-4H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
      </svg>
    ),
  },

  // Operaciones
  {
    name: t('nav.orders'),
    href: "/dashboard/ordenes",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    name: t('nav.printshop'),
    href: "/dashboard/litografia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6M7 17h10M8 21h8M6 3h12v14H6V3z" />
      </svg>
    ),
  },
  {
    name: 'Conocimiento IA',
    href: "/dashboard/litografia/conocimiento-ia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5h14v14H5z" />
      </svg>
    ),
  },
  {
    name: 'Auditoría IA',
    href: "/dashboard/litografia/auditoria-ia",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5a2 2 0 002 2h2a2 2 0 002-2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6M9 15h3" />
      </svg>
    ),
  },
  {
    name: 'Generador de imágenes',
    href: "/dashboard/imagenes-ia/generador",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16v12H4V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 13l2.5-2.5 2 2L16 9l2 2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h.01" />
      </svg>
    ),
  },
  {
    name: 'Vectorizador de imágenes',
    href: "/dashboard/imagenes-ia/vectorizador",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6h5v5H6V6zM13 13h5v5h-5v-5zM15.5 8.5h2.5V11M8.5 15.5H11V18" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 8.5h4.5a2 2 0 012 2V13M13 15.5H8.5a2 2 0 01-2-2V11" />
      </svg>
    ),
  },
  {
    name: t('nav.scans'),
    href: "/dashboard/escaneos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2M3 17v2a2 2 0 002 2h2m10 0h2a2 2 0 002-2v-2M7 7h10v10H7V7zm2 2h6m-6 3h6m-6 3h4" />
      </svg>
    ),
  },
  {
    name: t('nav.products'),
    href: "/dashboard/productos",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
  },

  // Inventario
  {
    name: t('nav.inventory'),
    href: "/dashboard/inventario",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 20h10a2 2 0 002-2V8a2 2 0 00-2-2h-1.5a2.5 2.5 0 00-5 0H9a2 2 0 00-2 2v10a2 2 0 002 2zm3-14a1 1 0 112 0h-2z"
        />
      </svg>
    ),
  },
  {
    name: t('nav.transfers'),
    href: "/dashboard/inventario/traslados",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l4 5-4 5" />
      </svg>
    ),
  },

  // Logística
  {
    name: t('nav.purchases'),
    href: "/dashboard/compras",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13l-1.5 7.5M17 13l1.5 7.5M9 21h6" />
      </svg>
    ),
  },
  {
    name: t('nav.suppliers'),
    href: "/dashboard/proveedores",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a1 1 0 011-1h14a1 1 0 011 1v14M8 10h8M8 14h8M8 18h8" />
      </svg>
    ),
  },
  {
    name: t('nav.waste'),
    href: "/dashboard/configuracion/desperdicios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 14h8l1-14" />
      </svg>
    ),
  },

  // Gestión
  {
    name: t('nav.branches'),
    href: "/dashboard/configuracion/sedes",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    name: t('nav.users'),
    href: "/dashboard/configuracion/usuarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    name: t('nav.company'),
    href: "/dashboard/configuracion/empresa",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a2 2 0 012-2h3V3h6v2h3a2 2 0 012 2v14M8 11h.01M8 15h.01M12 11h.01M12 15h.01M16 11h.01M16 15h.01" />
      </svg>
    ),
  },
  {
    name: "Servicios web",
    href: "/dashboard/configuracion/servicios-web",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
      </svg>
    ),
  },
  {
    name: t('nav.plan'),
    href: "/dashboard/configuracion/plan",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h4m-6 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: "Super Admin",
    href: "/dashboard/configuracion/super-admin/modulos-por-plan",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 0c-3.314 0-6 1.79-6 4v2h12v-2c0-2.21-2.686-4-6-4zm7-3h2v2h-2V8zM3 8h2v2H3V8z"
        />
      </svg>
    ),
  },
  {
    name: "Super Admin · Empresas",
    href: "/dashboard/configuracion/super-admin/empresas",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M4 21V7a2 2 0 012-2h3V3h6v2h3a2 2 0 012 2v14M8 11h.01M8 15h.01M12 11h.01M12 15h.01M16 11h.01M16 15h.01" />
      </svg>
    ),
  },
  {
    name: "Super Admin · Usuarios",
    href: "/dashboard/configuracion/super-admin/usuarios",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  ]
}

type UiPrefsResponse = {
  success: boolean
  data?: {
    nav?: Record<string, boolean>
    navOrder?: string[]
    sidebarTooltips?: SidebarTooltipPrefs
  }
}

type EmpresaBranding = {
  nombre: string
  logo: string | null
  nit: string
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname() ?? ''
  const { resolvedTheme } = useTheme()

  const { t } = useI18n()

  const moduleNavigation = useMemo(() => buildModuleNavigation(t), [t])
  const dashboardNavDefinitions = useMemo(() => buildDashboardNavDefinitions(t), [t])
  const dashboardSectionOrder = useMemo(() => getDashboardSectionOrder(), [])

  const allowedModules = useMemo(() => {
    if (!user.allowedModules) return null
    return new Set(user.allowedModules)
  }, [user.allowedModules])

  const [canManageBilling, setCanManageBilling] = useState(() => user.role === 'ADMIN')

  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen)

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const hydrateSidebarCollapsed = useUiStore((s) => s.hydrateSidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const setRouteLoading = useUiStore((s) => s.setRouteLoading)

  const [navPrefs, setNavPrefs] = useState<Record<string, boolean> | null>(null)
  const [navOrder, setNavOrder] = useState<string[]>([])
  const [sidebarTooltipPrefs, setSidebarTooltipPrefs] = useState<SidebarTooltipPrefs>(DEFAULT_SIDEBAR_TOOLTIP_PREFS)
  const [recommendedNavOrder, setRecommendedNavOrder] = useState<string[]>([])
  const [allowedNavHrefs, setAllowedNavHrefs] = useState<string[]>(() => user.allowedNavHrefs ?? [])
  const [enabledModules, setEnabledModules] = useState<Set<string> | null>(null)
  const [empresa, setEmpresa] = useState<EmpresaBranding | null>(null)
  const [planTier, setPlanTier] = useState<string | null>(null)
  const [isPersonal, setIsPersonal] = useState<boolean>(false)
  const [openSectionTitle, setOpenSectionTitle] = useState<string | null>(null)
  const [canAccessWebsiteServices, setCanAccessWebsiteServices] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  useEffect(() => {
    if (user.role === 'ADMIN') setCanManageBilling(true)
  }, [user.role])

  useEffect(() => {
    hydrateSidebarCollapsed()
  }, [hydrateSidebarCollapsed])

  function isNavActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (pathname === href) return true
    return pathname.startsWith(href + '/')
  }

  function beginRouteLoadingIfNeeded(href: string) {
    if (!href) return
    if (href === pathname) return
    if (pathname.startsWith(href + '/')) return
    setRouteLoading(true)
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/ui-preferences')
        const json: UiPrefsResponse = await res.json().catch(() => ({ success: false }))
        if (!cancelled && json?.success) {
          setNavPrefs(json.data?.nav ?? {})
          setNavOrder(Array.isArray(json.data?.navOrder) ? json.data.navOrder : [])
          setSidebarTooltipPrefs(normalizeSidebarTooltipPrefs(json.data?.sidebarTooltips))
        }
      } catch {}
      try {
        const res = await fetch('/api/modules/enabled', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; enabled?: string[]; planTier?: string }
          | null
        if (!cancelled && json?.ok && Array.isArray(json.enabled)) {
          setEnabledModules(new Set(json.enabled))
          setPlanTier(json.planTier ?? null)
        }
      } catch {}
      try {
        const res = await fetch('/api/configuracion/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: { nombre?: string; logo?: string | null; nit?: string } }
          | null
        if (!cancelled && json?.ok && json.data?.nombre) {
          setEmpresa({
            nombre: json.data.nombre,
            logo: json.data.logo ?? null,
            nit: json.data.nit ?? '',
          })
          setIsPersonal((json.data.nit ?? '').startsWith('PERS-'))
        }
      } catch {}
      try {
        const res = await fetch('/api/onboarding/empresa', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; dashboard?: { prioritizedHrefs?: string[]; allowedHrefs?: string[] } | null }
          | null
        if (!cancelled && json?.ok) {
          setRecommendedNavOrder(
            Array.isArray(json.dashboard?.prioritizedHrefs)
              ? json.dashboard!.prioritizedHrefs.filter((href): href is string => typeof href === 'string' && href.startsWith('/dashboard'))
              : []
          )
          setAllowedNavHrefs(
            Array.isArray(json.dashboard?.allowedHrefs)
              ? json.dashboard!.allowedHrefs.filter((href): href is string => typeof href === 'string' && href.startsWith('/dashboard'))
              : []
          )
        }
      } catch {}
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const applyMatch = (matches: boolean) => setIsMobileViewport(matches)

    applyMatch(mediaQuery.matches)
    const onChange = (event: MediaQueryListEvent) => applyMatch(event.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    function handleUiPreferencesUpdated(event: Event) {
      const detail = (event as CustomEvent<{ nav?: Record<string, boolean>; navOrder?: string[]; sidebarTooltips?: SidebarTooltipPrefs }>).detail
      if (!detail) return
      if (detail.nav) setNavPrefs(detail.nav)
      if (Array.isArray(detail.navOrder)) setNavOrder(detail.navOrder)
      if (detail.sidebarTooltips) setSidebarTooltipPrefs(normalizeSidebarTooltipPrefs(detail.sidebarTooltips))
    }

    window.addEventListener('ui-preferences:nav-updated', handleUiPreferencesUpdated)
    return () => window.removeEventListener('ui-preferences:nav-updated', handleUiPreferencesUpdated)
  }, [])

  const effectiveNavOrder = useMemo(() => (navOrder.length ? navOrder : recommendedNavOrder), [navOrder, recommendedNavOrder])
  const allowedNavHrefSet = useMemo(() => (allowedNavHrefs.length ? new Set(allowedNavHrefs) : null), [allowedNavHrefs])
  const areSidebarTooltipsEnabled = isMobileViewport ? sidebarTooltipPrefs.mobile : sidebarTooltipPrefs.desktop

  const upgradePlanLabel = useMemo(() => {
    if (planTier === 'BASIC') return 'Intermedio'
    if (planTier === 'INTERMEDIO') return 'Full'
    return 'superior'
  }, [planTier])

  useEffect(() => {
    let cancelled = false
    async function loadBillingAccess() {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        const json = (await res.json().catch(() => null)) as
          | { success?: boolean; data?: { canManageBilling?: boolean; canAccessWebsiteServices?: boolean } | null }
          | null
        if (!cancelled && res.ok && json?.success) {
          setCanManageBilling(Boolean(json.data?.canManageBilling))
          setCanAccessWebsiteServices(Boolean(json.data?.canAccessWebsiteServices))
        }
      } catch {
        // ignore
      }
    }
    void loadBillingAccess()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function onBrandingUpdated(e: Event) {
      const ce = e as CustomEvent<Partial<EmpresaBranding>>
      const next = ce.detail
      if (!next) return
      setEmpresa((prev) => ({
        nombre: next.nombre ?? prev?.nombre ?? 'SGDigital',
        logo: next.logo !== undefined ? (next.logo ?? null) : (prev?.logo ?? null),
        nit: next.nit ?? prev?.nit ?? '',
      }))
    }
    window.addEventListener('empresa:branding-updated', onBrandingUpdated)
    return () => window.removeEventListener('empresa:branding-updated', onBrandingUpdated)
  }, [])

  const empresaInitials = useMemo(() => {
    const name = (empresa?.nombre ?? 'SGDigital').trim()
    const parts = name.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? 'S'
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (a + b).toUpperCase()
  }, [empresa?.nombre])

  // Para persona individual, mostrar todos los módulos (candado si no está habilitado por plan)
  const visibleNavigation = useMemo(() => {
    const base = !navPrefs ? moduleNavigation : moduleNavigation.filter((it) => navPrefs[it.href] !== false)
    const withRbacGate = base.filter((it) => {
      if (allowedNavHrefSet?.has(it.href)) return true
      if (it.href === '/dashboard/configuracion/servicios-web') {
        return canAccessWebsiteServices
      }
      const moduleKey = moduleForDashboardHref(it.href)
      if (!moduleKey) return true
      if (!allowedModules) return true
      return allowedModules.has(moduleKey)
    })
    const withAdminGate = withRbacGate.filter((it) => {
      const isSuperAdminRoute =
        it.href === '/dashboard/configuracion/super-admin/modulos-por-plan' ||
        it.href === '/dashboard/configuracion/super-admin/empresas' ||
        it.href === '/dashboard/configuracion/super-admin/usuarios'
      if (!isSuperAdminRoute) return true
      return user?.role === 'ADMIN'
    })
    const withBillingGate = withAdminGate.filter((it) => {
      if (it.href !== '/dashboard/configuracion/plan') return true
      return canManageBilling
    })
    const withOnboardingScope = withBillingGate.filter((it) => {
      if (allowedNavHrefSet) return allowedNavHrefSet.has(it.href)
      return !isOnboardingScopedDashboardHref(it.href)
    })
    return sortNavItemsByOrder(withOnboardingScope, effectiveNavOrder)
  }, [navPrefs, enabledModules, user?.role, canAccessWebsiteServices, canManageBilling, allowedModules, moduleNavigation, effectiveNavOrder, allowedNavHrefSet])

  const visibleHrefs = useMemo(() => {
    return new Set(visibleNavigation.map((it) => it.href))
  }, [visibleNavigation])

  // Determinar módulos bloqueados para mostrar candado
  const blockedModules = useMemo(() => {
    if (!enabledModules) return new Set<string>()
    const blocked = new Set<string>()
    for (const it of moduleNavigation) {
      const moduleKey = moduleForDashboardHref(it.href)
      if (!moduleKey) continue
      if (!enabledModules.has(moduleKey)) blocked.add(it.href)
    }
    return blocked
  }, [enabledModules])

  const sections = useMemo(() => {
    const grouped = new Map<string, NavItem[]>()

    for (const item of visibleNavigation) {
      const section = sectionForDashboardHref(item.href)
      const current = grouped.get(section) ?? []
      current.push(item)
      grouped.set(section, current)
    }

    const baseSections: NavSection[] = dashboardSectionOrder
      .map((title) => ({
        title,
        items: sortNavItemsByOrder(grouped.get(title) ?? [], effectiveNavOrder),
      }))
      .filter((section) => section.items.length > 0)

    for (const [title, items] of grouped.entries()) {
      if (baseSections.some((section) => section.title === title)) continue
      baseSections.push({ title, items: sortNavItemsByOrder(items, effectiveNavOrder) })
    }

    return sortSectionsByOrder(baseSections, effectiveNavOrder)
  }, [dashboardSectionOrder, visibleNavigation, effectiveNavOrder])

  const activeSectionTitle = useMemo(() => {
    // Elegimos el match más específico (href más largo) para evitar que “/dashboard” capture todo.
    let best: { sectionTitle: string; hrefLen: number } | null = null

    for (const section of sections) {
      for (const it of section.items) {
        if (!isNavActive(it.href)) continue
        const hrefLen = it.href.length
        if (!best || hrefLen > best.hrefLen) {
          best = { sectionTitle: section.title, hrefLen }
        }
      }
    }

    if (best) return best.sectionTitle

    return null
  }, [sections, pathname])

  useEffect(() => {
    // Al navegar a una ruta dentro de otra sección, colapsa el anterior y abre el nuevo.
    if (activeSectionTitle) setOpenSectionTitle(activeSectionTitle)
  }, [activeSectionTitle])

  const effectiveOpenSection = openSectionTitle
  const isDark = resolvedTheme === 'dark'
  const sidebarSurface = isDark
    ? "border-white/10 bg-[linear-gradient(180deg,#0f172a_0%,#111827_52%,#101a2d_100%)] text-slate-100 shadow-[18px_0_40px_-32px_rgba(15,23,42,0.75)]"
    : "border-slate-200/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_58%,#f1f5f9_100%)] text-slate-900 shadow-[18px_0_40px_-32px_rgba(15,23,42,0.18)]"
  const sectionBorder = isDark ? "border-white/10" : "border-slate-200/80"
  const sectionTitleText = isDark ? "text-slate-400" : "text-slate-500"
  const navText = isDark ? "text-slate-200" : "text-slate-700"
  const navHover = isDark ? "hover:bg-white/8" : "hover:bg-slate-100"
  const navActive = isDark
    ? "bg-[#608194] text-white shadow-[0_12px_18px_-18px_rgba(96,129,148,0.55)]"
    : "bg-[#608194] text-white ring-1 ring-[#608194] shadow-[0_10px_18px_-18px_rgba(96,129,148,0.5)]"
  const sectionHeaderOpen = isDark
    ? "bg-white/8 text-slate-100"
    : "bg-slate-100 text-slate-900"
  const sectionHeaderActive = isDark
    ? "bg-white/14 text-white ring-1 ring-white/10 shadow-[0_12px_18px_-18px_rgba(148,163,184,0.45)]"
    : "bg-sky-100/90 text-sky-950 ring-1 ring-sky-200 shadow-[0_12px_18px_-18px_rgba(14,165,233,0.28)]"
  const sectionHeaderTextActive = isDark ? "text-slate-100" : "text-sky-900"
  const sectionHeaderTextOpen = isDark ? "text-slate-300" : "text-slate-700"
  const softButton = isDark ? "border-white/10 text-slate-200 hover:bg-white/10" : "border-slate-200 text-slate-600 hover:bg-slate-100"
  const userSecondaryText = isDark ? "text-slate-400" : "text-slate-500"
  const userStrongText = isDark ? "text-slate-100" : "text-slate-900"
  const avatarSurface = isDark ? "bg-white/10 text-slate-100" : "bg-slate-100 text-slate-700"
  const badgeSurface = isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity",
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        className={cn(
          "flex flex-col border-r",
          sidebarSurface,
          "fixed inset-y-0 left-0 z-50 md:static",
          sidebarCollapsed ? "w-[4.25rem]" : "w-[86vw] max-w-[300px] md:w-56 md:max-w-none",
          "transform transition-transform md:translate-x-0",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("border-b p-2.5", sectionBorder)}>
          <div className={cn("flex items-center", sidebarCollapsed ? "justify-center" : "space-x-3")}>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,#0f766e_0%,#2563eb_100%)] text-base font-bold text-primary-foreground shadow-[0_12px_24px_-18px_rgba(37,99,235,0.7)]">
              {empresa?.logo ? (
                <Image src={empresa.logo} alt={empresa.nombre} width={36} height={36} className="h-9 w-9 object-contain" />
              ) : (
                <span>{empresaInitials}</span>
              )}
            </div>
            {!sidebarCollapsed ? (
              <div>
                <h1 className={cn("text-sm font-bold leading-5", userStrongText)}>{empresa?.nombre ?? 'SGDigital'}</h1>
                <p className={cn("text-[10px]", userSecondaryText)}>Cotizador Pro</p>
              </div>
            ) : null}

            <button
              type="button"
              className={cn("ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border md:hidden", softButton)}
              onClick={() => setMobileNavOpen(false)}
              aria-label="Cerrar menú"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <button
              type="button"
              className={cn(
                "ml-auto hidden h-8 w-8 items-center justify-center rounded-lg border md:inline-flex",
                softButton,
                sidebarCollapsed ? "ml-0" : ""
              )}
              onClick={toggleSidebarCollapsed}
              title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
              aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={sidebarCollapsed ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <TooltipProvider delayDuration={150}>
        <nav className={cn("flex-1 space-y-0.5 overflow-y-auto py-2", sidebarCollapsed ? "px-1.5" : "px-2")}>
          {sections.map((section) => {
            const visibleItems = section.items.filter((it) => visibleHrefs.has(it.href))
            if (!visibleItems.length) return null

            // Sidebar colapsada: se mantiene lista directa (sin dropdown) para no romper UX.
            if (sidebarCollapsed) {
              return (
                <div key={section.title} className={cn("space-y-1", "")}> 
                  {visibleItems.map((item) => {
                    const isActive = isNavActive(item.href)
                    const isBlocked = isPersonal && blockedModules.has(item.href)
                    return (
                      <SidebarNavTooltip key={item.name} item={item} isBlocked={isBlocked} upgradePlanLabel={upgradePlanLabel} enabled={areSidebarTooltipsEnabled}>
                          <Link
                            href={item.href}
                            onClick={e => {
                              if (isBlocked) e.preventDefault()
                              else {
                                beginRouteLoadingIfNeeded(item.href)
                                setMobileNavOpen(false)
                              }
                            }}
                            className={cn(
                              "flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                              isActive ? navActive : cn(navText, navHover),
                              isBlocked ? "opacity-60 cursor-not-allowed" : ""
                            )}
                          >
                            <div className={cn("flex items-center", "justify-center w-full")}>
                              {item.icon}
                              {isBlocked && (
                                <Lock className={cn("ml-1.5 h-3.5 w-3.5", sectionTitleText)} />
                              )}
                            </div>
                          </Link>
                      </SidebarNavTooltip>
                    )
                  })}
                </div>
              )
            }

            const isOpen = effectiveOpenSection === section.title
            const isActiveSection = activeSectionTitle === section.title

            return (
              <div
                key={section.title}
                className={cn("space-y-0.5", "pt-1.5")}
              >
                <button
                  type="button"
                  onClick={() => {
                    setOpenSectionTitle((cur) => (cur === section.title ? null : section.title))
                  }}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                    isActiveSection ? sectionHeaderActive : isOpen ? sectionHeaderOpen : cn(navText, navHover)
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.12em]",
                    isActiveSection ? sectionHeaderTextActive : isOpen ? sectionHeaderTextOpen : sectionTitleText
                  )}>{section.title}</span>
                  <svg
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isActiveSection ? sectionHeaderTextActive : isOpen ? sectionHeaderTextOpen : sectionTitleText,
                      isOpen ? "rotate-180" : ""
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <div
                  className={cn(
                    "pl-2 overflow-hidden transition-all duration-200 ease-out",
                    isOpen ? "max-h-[900px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
                  )}
                >
                  <div className="space-y-0.5 pt-0.5">
                    {visibleItems.map((item) => {
                      const isActive = isNavActive(item.href)
                      const isBlocked = isPersonal && blockedModules.has(item.href)
                      return (
                        <SidebarNavTooltip key={item.name} item={item} isBlocked={isBlocked} upgradePlanLabel={upgradePlanLabel} enabled={areSidebarTooltipsEnabled}>
                            <Link
                              href={item.href}
                              onClick={e => {
                                if (isBlocked) e.preventDefault()
                                else {
                                  beginRouteLoadingIfNeeded(item.href)
                                  setMobileNavOpen(false)
                                }
                              }}
                              className={cn(
                                "flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors",
                                isActive ? navActive : cn(navText, navHover),
                                isBlocked ? "opacity-60 cursor-not-allowed" : ""
                              )}
                            >
                              <div className="flex items-center space-x-2.5">
                                {item.icon}
                                <span className="text-[12px] font-medium leading-4">{item.name}</span>
                                {isBlocked && (
                                  <Lock className={cn("ml-1.5 h-3.5 w-3.5", sectionTitleText)} />
                                )}
                              </div>
                              {item.badge ? (
                                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", badgeSurface)}>{item.badge}</span>
                              ) : null}
                            </Link>
                        </SidebarNavTooltip>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

        </nav>
        </TooltipProvider>

        {/* User Info + Cambiar contraseña */}
        <div className={cn("border-t p-2.5", sectionBorder, sidebarCollapsed ? "px-1.5" : "px-2.5")}>
          <div className={cn("flex items-center space-x-2.5", sidebarCollapsed ? "justify-center" : "") }>
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium", avatarSurface)}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed ? (
              <div className="flex-1 min-w-0">
                <p className={cn("truncate text-[12px] font-medium leading-4", userStrongText)}>{user.name}</p>
                <p className={cn("truncate text-[10px] leading-4", userSecondaryText)}>{user.email}</p>
              </div>
            ) : null}
          </div>

          {!sidebarCollapsed ? (
            <div className="mt-2.5">
              <Link
                href="/auth/change-password"
                onClick={() => setMobileNavOpen(false)}
                className={cn("text-[10px] font-medium hover:underline", isDark ? "text-sky-300" : "text-sky-700")}
              >
                Cambiar contraseña
              </Link>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}
