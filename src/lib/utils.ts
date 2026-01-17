/**
 * Utilidades generales del proyecto
 */

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combina clases de Tailwind CSS de manera inteligente
 * Útil para componentes condicionales
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea números como moneda colombiana
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formatea fechas en español
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Formatea fechas cortas
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Genera un número de cotización único
 */
export function generarNumeroCotizacion(numero: number): string {
  const year = new Date().getFullYear()
  const num = numero.toString().padStart(4, '0')
  return `COT-${year}-${num}`
}

/**
 * Genera un número de orden de trabajo único
 */
export function generarNumeroOrden(numero: number): string {
  const year = new Date().getFullYear()
  const num = numero.toString().padStart(4, '0')
  return `OT-${year}-${num}`
}

/**
 * Calcula el área en m² a partir de ancho y alto en cm
 */
export function calcularArea(ancho: number, alto: number): number {
  return (ancho * alto) / 10000 // Convertir cm² a m²
}

/**
 * Postgres no permite el caracter NUL (\u0000) en strings (TEXT/JSON).
 * Algunos PDFs/OCR pueden incluirlo en el texto extraído.
 */
export function stripNullChars(value: string): string {
  return (value || "").replace(/\u0000/g, "")
}

/**
 * Sanitiza recursivamente strings dentro de estructuras JSON (objetos/arrays).
 */
export function sanitizeJsonStrings<T = unknown>(value: T): T {
  if (typeof value === "string") {
    return stripNullChars(value) as unknown as T
  }
  if (value instanceof Date) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeJsonStrings(v)) as unknown as T
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rec)) {
      out[k] = sanitizeJsonStrings(v)
    }
    return out as unknown as T
  }
  return value
}
