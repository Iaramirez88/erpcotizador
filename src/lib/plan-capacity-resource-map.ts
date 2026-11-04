import type { ModuleKey } from '@prisma/client'
import type { PlanCapacityResource } from '@/lib/plan-capacity'

/**
 * Mapa puro módulo comercial → recursos de consumo.
 *
 * Vive en su propio archivo (sin dependencias de runtime) para que tanto el servicio de
 * capacidad como el de asignaciones puedan usarlo sin ciclos de importación.
 *
 * Un módulo puede alimentar más de un recurso medible: `CONFIG` administra **sedes** y
 * **usuarios**, que son los recursos de capacidad de la parte administrativa.
 */

/** Recursos de consumo que alimenta cada módulo comercial. */
export const MODULE_CAPACITY_RESOURCES: Partial<Record<ModuleKey, PlanCapacityResource[]>> = {
  COTIZACIONES: ['COTIZACIONES'],
  COTIZADOR: ['COTIZACIONES'],
  ORDENES: ['ORDENES'],
  POS: ['ORDENES'],
  REMISIONES: ['REMISIONES'],
  CLIENTES: ['CLIENTES'],
  CRM: ['CLIENTES'],
  MATERIALES: ['PRODUCTOS'],
  INVENTARIO: ['PRODUCTOS'],
  PROVEEDORES: ['PROVEEDORES'],
  COMPRAS: ['PROVEEDORES'],
  REPORTES: ['ALMACENAMIENTO'],
  ESCANEOS: ['ALMACENAMIENTO'],
  CONFIG: ['SEDES', 'USUARIOS'],
}

/** Módulo responsable de editar el límite y el cobro por consumo de cada recurso. */
export const CAPACITY_RESOURCE_OWNER_MODULE: Record<PlanCapacityResource, ModuleKey> = {
  COTIZACIONES: 'COTIZACIONES',
  ORDENES: 'ORDENES',
  REMISIONES: 'REMISIONES',
  CLIENTES: 'CLIENTES',
  PRODUCTOS: 'MATERIALES',
  PROVEEDORES: 'PROVEEDORES',
  SEDES: 'CONFIG',
  USUARIOS: 'CONFIG',
  ALMACENAMIENTO: 'REPORTES',
}

/** Recursos que alimenta un módulo (vacío si no tiene consumo medible). */
export function getModuleCapacityResources(module: ModuleKey): PlanCapacityResource[] {
  return MODULE_CAPACITY_RESOURCES[module] ?? []
}

/** Primer recurso del módulo (compatibilidad con código que asumía un solo recurso). */
export function getModuleCapacityResource(module: ModuleKey): PlanCapacityResource | null {
  return getModuleCapacityResources(module)[0] ?? null
}

/** ¿Este módulo administra el límite de consumo del recurso indicado (o de alguno de los suyos)? */
export function isCapacityResourceOwner(module: ModuleKey, resource?: PlanCapacityResource): boolean {
  const resources = getModuleCapacityResources(module)
  if (!resources.length) return false
  const owned = resource ? resources.includes(resource) : true
  if (!owned) return false
  return resources.some((item) => CAPACITY_RESOURCE_OWNER_MODULE[item] === module)
}

/** Módulos que comparten el mismo recurso de consumo (incluye al dueño). */
export function getModulesForCapacityResource(resource: PlanCapacityResource): ModuleKey[] {
  return (Object.keys(MODULE_CAPACITY_RESOURCES) as ModuleKey[]).filter((module) =>
    getModuleCapacityResources(module).includes(resource)
  )
}

