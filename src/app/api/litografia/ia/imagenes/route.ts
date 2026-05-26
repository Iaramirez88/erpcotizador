import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { z } from 'zod'
import { requireApiAccess } from '@/lib/api-rbac'
import { appendAiWorkspaceHistory, listAiWorkspaceHistory } from '@/lib/ai-workspace-history'
import { uploadCrmFiles } from '@/lib/crm-files'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const requestSchema = z.object({
  prompt: z.string().trim().min(12, 'Escribe un prompt más específico para generar la imagen.'),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).optional(),
  quality: z.enum(['low', 'medium', 'high', 'auto']).optional(),
})

function getImageConfig() {
  const apiKey = String(process.env.LITOGRAFIA_AI_IMAGE_API_KEY || process.env.LITOGRAFIA_AI_API_KEY || process.env.LLM_API_KEY || '').trim()
  const model = String(process.env.LITOGRAFIA_AI_IMAGE_MODEL || 'gpt-image-1').trim()
  const configuredBaseUrl = String(process.env.LITOGRAFIA_AI_IMAGE_BASE_URL || process.env.LITOGRAFIA_AI_BASE_URL || process.env.LLM_BASE_URL || '').trim().replace(/\/+$/, '')
  const baseUrl = configuredBaseUrl || (apiKey ? 'https://api.openai.com/v1' : '')

  return {
    enabled: Boolean(apiKey && model && baseUrl),
    apiKey,
    model,
    baseUrl,
  }
}

async function getEmpresaIdFromSedeId(sedeId: string) {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
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
      kinds: ['LITOGRAFIA_QUOTE', 'IMAGE_GENERATION'],
    })

    return NextResponse.json({ ok: true, history })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo consultar el historial IA.' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Body inválido.' }, { status: 400 })
    }

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 })

    const config = getImageConfig()
    if (!config.enabled) {
      return NextResponse.json({ ok: false, error: 'La generación de imágenes no está configurada. Define LITOGRAFIA_AI_IMAGE_API_KEY y LITOGRAFIA_AI_IMAGE_MODEL.' }, { status: 400 })
    }

    const imageResponse = await fetch(`${config.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        prompt: parsed.data.prompt,
        size: parsed.data.size || '1024x1024',
        quality: parsed.data.quality || 'auto',
      }),
    })

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text().catch(() => '')
      return NextResponse.json({ ok: false, error: errorText || 'El proveedor de imágenes rechazó la solicitud.' }, { status: 400 })
    }

    const payload = (await imageResponse.json().catch(() => null)) as
      | { data?: Array<{ b64_json?: string | null; revised_prompt?: string | null; url?: string | null }> }
      | null

    const imageItem = payload?.data?.[0] ?? null
    if (!imageItem) {
      return NextResponse.json({ ok: false, error: 'El proveedor no devolvió ninguna imagen.' }, { status: 400 })
    }

    let bytes: Buffer | null = null
    if (imageItem.b64_json) {
      bytes = Buffer.from(imageItem.b64_json, 'base64')
    } else if (imageItem.url) {
      const remote = await fetch(imageItem.url)
      if (!remote.ok) {
        return NextResponse.json({ ok: false, error: 'No fue posible descargar la imagen generada.' }, { status: 400 })
      }
      bytes = Buffer.from(await remote.arrayBuffer())
    }

    if (!bytes) {
      return NextResponse.json({ ok: false, error: 'La imagen generada llegó sin contenido utilizable.' }, { status: 400 })
    }

    const fileSlug = parsed.data.prompt
      .slice(0, 48)
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'imagen'
    const uploaded = await uploadCrmFiles({
      empresaId,
      currentPath: 'ia/chatgpt-imagenes',
      actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
      files: [{
        name: `${fileSlug}.png`,
        type: 'image/png',
        size: bytes.byteLength,
        bytes,
      }],
    })

    const saved = uploaded[0] ?? null
    const previewDataUrl = `data:image/png;base64,${bytes.toString('base64')}`
    const historyEntry = await appendAiWorkspaceHistory({
      empresaId,
      entry: {
        kind: 'IMAGE_GENERATION',
        prompt: parsed.data.prompt,
        actorUserId: access.userId,
        actorLabel: access.session.user.name || access.session.user.email || 'Usuario interno',
        summary: imageItem.revised_prompt || 'Imagen generada con IA',
        responseText: null,
        metadata: {
          model: config.model,
          size: parsed.data.size || '1024x1024',
          quality: parsed.data.quality || 'auto',
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

    return NextResponse.json({
      ok: true,
      image: {
        previewDataUrl,
        revisedPrompt: imageItem.revised_prompt || null,
        file: saved
          ? {
              name: saved.name,
              path: saved.path,
              url: saved.url,
            }
          : null,
      },
      historyEntry,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Error generando la imagen.' }, { status: 500 })
  }
}