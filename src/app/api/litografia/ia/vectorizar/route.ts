import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { z } from 'zod'
import { requireApiAccess } from '@/lib/api-rbac'
import { appendAiWorkspaceHistory, listAiWorkspaceHistory } from '@/lib/ai-workspace-history'
import { uploadCrmFiles } from '@/lib/crm-files'
import { createPendingLitografiaAiVectorization, deletePendingLitografiaAiVectorization, readPendingLitografiaAiVectorization } from '@/lib/litografia-ai-pending-vectorizations'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const VECTOR_OUTPUT_FORMATS = ['svg', 'pdf', 'eps', 'dxf', 'png'] as const

const saveSchema = z.object({
  action: z.literal('save'),
  pendingId: z.string().trim().min(1, 'No se encontró el vector pendiente por guardar.'),
})

const downloadSchema = z.object({
  action: z.literal('download'),
  historyId: z.string().trim().min(1, 'No se encontró el historial solicitado.'),
  format: z.enum(VECTOR_OUTPUT_FORMATS),
})

const AI_VECTORS_FOLDER = 'IA/vectorizer-ai'

function getVectorizerConfig() {
  const apiId = String(process.env.LITOGRAFIA_VECTORIZER_API_ID || process.env.VECTORIZER_AI_API_ID || '').trim()
  const apiSecret = String(process.env.LITOGRAFIA_VECTORIZER_API_SECRET || process.env.VECTORIZER_AI_API_SECRET || '').trim()
  const configuredBaseUrl = String(process.env.LITOGRAFIA_VECTORIZER_BASE_URL || process.env.VECTORIZER_AI_BASE_URL || '').trim().replace(/\/+$/, '')
  const baseUrl = configuredBaseUrl || (apiId && apiSecret ? 'https://api.vectorizer.ai/api/v1' : '')

  return {
    enabled: Boolean(apiId && apiSecret && baseUrl),
    apiId,
    apiSecret,
    baseUrl,
  }
}

function createVectorizerAuthHeader(apiId: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiId}:${apiSecret}`).toString('base64')}`
}

function getFormatMimeType(format: typeof VECTOR_OUTPUT_FORMATS[number]) {
  switch (format) {
    case 'svg':
      return 'image/svg+xml'
    case 'pdf':
      return 'application/pdf'
    case 'eps':
      return 'application/postscript'
    case 'dxf':
      return 'application/dxf'
    case 'png':
      return 'image/png'
    default:
      return 'application/octet-stream'
  }
}

function slugifyFileName(value: string) {
  return value
    .replace(/\.[a-z0-9]+$/i, '')
    .slice(0, 48)
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'vector'
}

async function getEmpresaIdFromSedeId(sedeId: string) {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

function mapVectorHistory(history: Awaited<ReturnType<typeof listAiWorkspaceHistory>>) {
  return history.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    prompt: entry.prompt,
    createdAt: entry.createdAt,
    actorLabel: entry.actorLabel,
    summary: entry.summary,
    responseText: entry.responseText,
    asset: entry.asset
      ? {
          name: entry.asset.name,
          path: entry.asset.path,
          url: entry.asset.url,
        }
      : null,
    availableDownloads: entry.kind === 'IMAGE_VECTORIZATION' && typeof entry.metadata?.imageToken === 'string' && entry.metadata.imageToken.trim()
      ? [...VECTOR_OUTPUT_FORMATS]
      : [],
  }))
}

async function parseErrorResponse(response: Response) {
  const json = await response.json().catch(() => null) as { error?: { message?: string } } | null
  if (json?.error?.message) return json.error.message
  return await response.text().catch(() => 'La solicitud fue rechazada por Vectorizer.AI.')
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 })

    const history = await listAiWorkspaceHistory({
      empresaId,
      limit: 12,
      kinds: ['IMAGE_VECTORIZATION'],
    })

    return NextResponse.json({ ok: true, history: mapVectorHistory(history) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo consultar el historial de vectorización.' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 })

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const action = String(formData.get('action') || 'vectorize').trim()
      if (action !== 'vectorize') {
        return NextResponse.json({ ok: false, error: 'Acción no soportada para envío multipart.' }, { status: 400 })
      }

      const file = formData.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: 'Selecciona una imagen PNG, JPG, GIF, BMP o WebP para vectorizar.' }, { status: 400 })
      }

      const config = getVectorizerConfig()
      if (!config.enabled) {
        return NextResponse.json({ ok: false, error: 'Vectorizer.AI no está configurado. Define LITOGRAFIA_VECTORIZER_API_ID y LITOGRAFIA_VECTORIZER_API_SECRET.' }, { status: 400 })
      }

      const bytes = Buffer.from(await file.arrayBuffer())
      const upstream = new FormData()
      upstream.append('image', new Blob([bytes], { type: file.type || 'application/octet-stream' }), file.name || 'imagen.png')
      upstream.append('output.file_format', 'svg')
      upstream.append('policy.retention_days', '1')

      const maxColorsValue = Number.parseInt(String(formData.get('maxColors') || '').trim(), 10)
      if (Number.isFinite(maxColorsValue) && maxColorsValue > 0) {
        upstream.append('processing.max_colors', String(Math.max(2, Math.min(256, maxColorsValue))))
      }

      const vectorResponse = await fetch(`${config.baseUrl}/vectorize`, {
        method: 'POST',
        headers: {
          Authorization: createVectorizerAuthHeader(config.apiId, config.apiSecret),
        },
        body: upstream,
      })

      if (!vectorResponse.ok) {
        return NextResponse.json({ ok: false, error: await parseErrorResponse(vectorResponse) }, { status: 400 })
      }

      const vectorBytes = Buffer.from(await vectorResponse.arrayBuffer())
      const imageToken = vectorResponse.headers.get('X-Image-Token')
      const pending = await createPendingLitografiaAiVectorization({
        empresaId,
        sourceFileName: file.name || 'imagen',
        sourceMimeType: file.type || 'application/octet-stream',
        sourceSizeBytes: bytes.byteLength,
        provider: 'Vectorizer.AI',
        outputFormat: 'svg',
        imageToken: imageToken?.trim() || null,
        base64: vectorBytes.toString('base64'),
      })

      return NextResponse.json({
        ok: true,
        vectorization: {
          pendingId: pending.id,
          previewDataUrl: `data:image/svg+xml;base64,${pending.base64}`,
          responseText: `Vector generado con Vectorizer.AI desde ${pending.sourceFileName}. Revísalo y apruébalo para guardarlo en ${AI_VECTORS_FOLDER}.`,
          source: {
            provider: pending.provider,
            outputFormat: pending.outputFormat,
          },
        },
      })
    }

    const body = await request.json().catch(() => null)
    const action = typeof body?.action === 'string' ? body.action : ''

    if (action === 'save') {
      const parsed = saveSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Body inválido.' }, { status: 400 })
      }

      const pending = await readPendingLitografiaAiVectorization({ empresaId, pendingId: parsed.data.pendingId })
      if (!pending) {
        return NextResponse.json({ ok: false, error: 'El vector pendiente expiró o ya no existe. Ejecuta una nueva vectorización.' }, { status: 404 })
      }

      const bytes = Buffer.from(pending.base64, 'base64')
      const fileSlug = slugifyFileName(pending.sourceFileName)

      const uploaded = await uploadCrmFiles({
        empresaId,
        currentPath: AI_VECTORS_FOLDER,
        actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
        files: [{
          name: `${fileSlug}.svg`,
          type: 'image/svg+xml',
          size: bytes.byteLength,
          bytes,
        }],
      })

      const saved = uploaded[0] ?? null
      await appendAiWorkspaceHistory({
        empresaId,
        entry: {
          kind: 'IMAGE_VECTORIZATION',
          prompt: `Vectorizar ${pending.sourceFileName}`,
          actorUserId: access.userId,
          actorLabel: access.session.user.name || access.session.user.email || 'Usuario interno',
          summary: `Vector SVG generado desde ${pending.sourceFileName}`,
          responseText: `Vector generado por ${pending.provider} y guardado en ${saved?.path || AI_VECTORS_FOLDER}.`,
          metadata: {
            provider: pending.provider,
            outputFormat: pending.outputFormat,
            sourceFileName: pending.sourceFileName,
            sourceMimeType: pending.sourceMimeType,
            sourceSizeBytes: pending.sourceSizeBytes,
            imageToken: pending.imageToken,
            availableDownloads: VECTOR_OUTPUT_FORMATS,
          },
          asset: saved
            ? {
                name: saved.name,
                path: saved.path,
                url: saved.url || '',
                mimeType: saved.mimeType,
                sizeBytes: saved.sizeBytes,
              }
            : null,
        },
      })
      await deletePendingLitografiaAiVectorization({ empresaId, pendingId: pending.id })

      return NextResponse.json({
        ok: true,
        saved: saved
          ? {
              name: saved.name,
              path: saved.path,
              url: saved.url,
            }
          : null,
        responseText: `Vector SVG guardado en ${saved?.path || AI_VECTORS_FOLDER}.`,
      })
    }

    if (action === 'download') {
      const parsed = downloadSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Body inválido.' }, { status: 400 })
      }

      const config = getVectorizerConfig()
      if (!config.enabled) {
        return NextResponse.json({ ok: false, error: 'Vectorizer.AI no está configurado. Define LITOGRAFIA_VECTORIZER_API_ID y LITOGRAFIA_VECTORIZER_API_SECRET.' }, { status: 400 })
      }

      const history = await listAiWorkspaceHistory({ empresaId, limit: 120, kinds: ['IMAGE_VECTORIZATION'] })
      const entry = history.find((item) => item.id === parsed.data.historyId)
      const imageToken = typeof entry?.metadata?.imageToken === 'string' ? entry.metadata.imageToken.trim() : ''
      if (!entry || !imageToken) {
        return NextResponse.json({ ok: false, error: 'Este vector no tiene token activo para descargar nuevos formatos.' }, { status: 404 })
      }

      const upstream = new FormData()
      upstream.append('image.token', imageToken)
      upstream.append('output.file_format', parsed.data.format)

      const downloadResponse = await fetch(`${config.baseUrl}/download`, {
        method: 'POST',
        headers: {
          Authorization: createVectorizerAuthHeader(config.apiId, config.apiSecret),
        },
        body: upstream,
      })

      if (!downloadResponse.ok) {
        return NextResponse.json({ ok: false, error: await parseErrorResponse(downloadResponse) }, { status: 400 })
      }

      const bytes = Buffer.from(await downloadResponse.arrayBuffer())
      const baseName = slugifyFileName(typeof entry.metadata?.sourceFileName === 'string' ? entry.metadata.sourceFileName : entry.asset?.name || 'vector')

      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': downloadResponse.headers.get('Content-Type') || getFormatMimeType(parsed.data.format),
          'Content-Disposition': `attachment; filename="${baseName}.${parsed.data.format}"`,
        },
      })
    }

    return NextResponse.json({ ok: false, error: 'Acción no soportada.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Error vectorizando la imagen.' }, { status: 500 })
  }
}