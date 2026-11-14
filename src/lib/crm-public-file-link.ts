import { createCrmFileShareToken } from '@/lib/share-token'
import type { WebFormRewardType } from '@/lib/crm-web-form-purpose'

const CRM_FILES_PREFIX = '/uploads/crm-files/'
const CRM_FILE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 días

function isSafeFileSegment(segment: string): boolean {
  return Boolean(segment)
    && segment !== '.'
    && segment !== '..'
    && !segment.includes('\\')
    && !segment.includes('\u0000')
}

/**
 * Convierte una URL de regalo que apunta a un archivo de Drive CRM
 * (/uploads/crm-files/{empresaId}/...) en un enlace público firmado.
 * Las URLs externas o de otro tipo se devuelven sin cambios.
 */
export function buildPublicCrmFileRewardUrl(args: {
  rewardUrl: string
  empresaId: string
  rewardType: WebFormRewardType
  secret: string
  baseUrl?: string
}): string {
  if (!args.secret || !args.rewardUrl) return args.rewardUrl

  let url: URL
  try {
    url = new URL(args.rewardUrl)
  } catch {
    return args.rewardUrl
  }

  const prefix = `${CRM_FILES_PREFIX}${args.empresaId}/`
  if (!url.pathname.startsWith(prefix)) return args.rewardUrl

  const rawPath = url.pathname.slice(prefix.length)
  const segments = rawPath.split('/').map((segment) => {
    try {
      return decodeURIComponent(segment)
    } catch {
      return segment
    }
  })

  if (!segments.length || segments.some((segment) => !isSafeFileSegment(segment))) {
    return args.rewardUrl
  }

  const filePath = segments.join('/')
  // El enlace del regalo se comparte por correo o WhatsApp: siempre debe
  // descargar el archivo, no abrirlo embebido en el dominio.
  const disposition = 'attachment'
  const token = createCrmFileShareToken({
    empresaId: args.empresaId,
    filePath,
    disposition,
    ttlSeconds: CRM_FILE_TOKEN_TTL_SECONDS,
    secret: args.secret,
  })

  const base = (args.baseUrl || `${url.protocol}//${url.host}`).replace(/\/+$/, '')
  if (!base) return args.rewardUrl

  return `${base}/api/public/crm-files?token=${encodeURIComponent(token)}`
}