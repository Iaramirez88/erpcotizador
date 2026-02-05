/**
 * Alias para /api/templates/cotizacion
 * Mantiene compatibilidad con código que usa /api/cotizacion-template
 */

export const runtime = 'nodejs'

export { GET, PUT } from '../templates/cotizacion/route'
