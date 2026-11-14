import path from 'path'
import fs from 'fs/promises'
import { getCrmFilesRootAbsolutePath } from '@/lib/crm-files'

const CRM_FILES_PREFIX = '/uploads/crm-files/'
/** Resend acepta hasta 40 MB por correo; se deja margen para el resto del mensaje. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15_000
const PDF_MAGIC = '%PDF'

export type RewardAttachment = {
  filename: string
  content: Buffer
  contentType: string
}

export type RewardAttachmentResult =
  | { ok: true; attachment: RewardAttachment }
  | { ok: false; reason: string }

function isSafeSegment(segment: string) {
  return Boolean(segment)
    && segment !== '.'
    && segment !== '..'
    && !segment.includes('\\')
    && !segment.includes('\u0000')
}

function decodeSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function sanitizeFilename(rawName: string, fallback: string) {
  const decoded = decodeSegment(rawName)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  const base = decoded || fallback
  return /\.pdf$/i.test(base) ? base.slice(0, 120) : `${base.slice(0, 116)}.pdf`
}

function looksLikePdf(buffer: Buffer) {
  return buffer.length > 4 && buffer.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC
}

function resolveLocalRewardFile(args: { rewardUrl: string; empresaId: string }) {
  let url: URL
  try {
    url = new URL(args.rewardUrl)
  } catch {
    return null
  }

  const prefix = `${CRM_FILES_PREFIX}${args.empresaId}/`
  if (!url.pathname.startsWith(prefix)) return null

  const segments = url.pathname.slice(prefix.length).split('/').map(decodeSegment).filter(Boolean)
  if (!segments.length || segments.some((segment) => !isSafeSegment(segment))) return null

  const root = getCrmFilesRootAbsolutePath(args.empresaId)
  const absolutePath = path.join(root, ...segments)
  const normalizedRoot = path.resolve(root)
  const normalizedPath = path.resolve(absolutePath)
  if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(normalizedRoot + path.sep)) return null

  return { absolutePath, fileName: segments[segments.length - 1] }
}

function filenameFromContentDisposition(header: string | null) {
  if (!header) return ''
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8Match?.[1]) return decodeSegment(utf8Match[1])
  const plainMatch = /filename="?([^";]+)"?/i.exec(header)
  return plainMatch?.[1] ? decodeSegment(plainMatch[1]) : ''
}

/**
 * Carga el PDF del regalo para adjuntarlo al correo.
 *
 * - Archivos del Drive CRM (`/uploads/crm-files/{empresaId}/...`): se leen del
 *   disco, sin pasar por HTTP.
 * - Otras URLs http(s): se descargan con límite de tamaño y tiempo.
 *
 * Si no se puede obtener (tamaño, 404, HTML de Drive, etc.) devuelve el motivo
 * para que el correo caiga al enlace firmado de descarga.
 */
export async function loadRewardPdfAttachment(args: {
  rewardUrl: string
  empresaId: string
  rewardLabel?: string | null
}): Promise<RewardAttachmentResult> {
  const fallbackName = args.rewardLabel?.trim() || 'regalo'

  const local = resolveLocalRewardFile({ rewardUrl: args.rewardUrl, empresaId: args.empresaId })
  if (local) {
    try {
      const stats = await fs.stat(local.absolutePath)
      if (!stats.isFile()) return { ok: false, reason: 'El archivo del regalo no existe.' }
      if (stats.size > MAX_ATTACHMENT_BYTES) {
        return { ok: false, reason: 'El archivo supera el tamaño máximo para adjuntarlo.' }
      }

      const content = await fs.readFile(local.absolutePath)
      if (!looksLikePdf(content)) {
        return { ok: false, reason: 'El archivo del regalo no es un PDF válido.' }
      }

      return {
        ok: true,
        attachment: {
          filename: sanitizeFilename(local.fileName, fallbackName),
          content,
          contentType: 'application/pdf',
        },
      }
    } catch {
      return { ok: false, reason: 'No se pudo leer el archivo del regalo.' }
    }
  }

  let url: URL
  try {
    url = new URL(args.rewardUrl)
  } catch {
    return { ok: false, reason: 'La URL del regalo no es válida.' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: 'La URL del regalo no es descargable.' }
  }

  try {
    const response = await fetch(url.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/pdf,*/*' },
    })
    if (!response.ok) {
      return { ok: false, reason: `El servidor del regalo respondió ${response.status}.` }
    }

    const declaredLength = Number(response.headers.get('content-length') ?? '')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_ATTACHMENT_BYTES) {
      return { ok: false, reason: 'El archivo supera el tamaño máximo para adjuntarlo.' }
    }

    const content = Buffer.from(await response.arrayBuffer())
    if (!content.length) return { ok: false, reason: 'El archivo del regalo está vacío.' }
    if (content.length > MAX_ATTACHMENT_BYTES) {
      return { ok: false, reason: 'El archivo supera el tamaño máximo para adjuntarlo.' }
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!looksLikePdf(content) && !contentType.toLowerCase().includes('pdf')) {
      return { ok: false, reason: 'El enlace del regalo no devuelve un PDF descargable.' }
    }

    const fromHeader = filenameFromContentDisposition(response.headers.get('content-disposition'))
    const fromPath = decodeSegment(url.pathname.split('/').filter(Boolean).pop() ?? '')

    return {
      ok: true,
      attachment: {
        filename: sanitizeFilename(fromHeader || fromPath, fallbackName),
        content,
        contentType: 'application/pdf',
      },
    }
  } catch {
    return { ok: false, reason: 'No se pudo descargar el archivo del regalo.' }
  }
}