import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { z } from 'zod'
import { canAccessCompanyWideAiHistory, requireApiAccess } from '@/lib/api-rbac'
import { appendAiWorkspaceHistory, listAiWorkspaceHistory, updateAiWorkspaceHistoryEntry } from '@/lib/ai-workspace-history'
import { uploadCrmFiles } from '@/lib/crm-files'
import { createPendingLitografiaAiImage, deletePendingLitografiaAiImage, readPendingLitografiaAiImage } from '@/lib/litografia-ai-pending-images'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const generateSchema = z.object({
  action: z.literal('generate').optional(),
  prompt: z.string().trim().min(12, 'Escribe un prompt más específico para generar la imagen.'),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024']).optional(),
  quality: z.enum(['low', 'medium', 'high', 'auto']).optional(),
})

const saveSchema = z.object({
  action: z.literal('save'),
  pendingId: z.string().trim().min(1, 'No se encontró la imagen pendiente por guardar.'),
  historyId: z.string().trim().min(1).optional(),
})

const AI_IMAGES_FOLDER = 'IA/chatgpt-imagenes'

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

    const canViewCompanyWide = await canAccessCompanyWideAiHistory({
      userId: access.userId,
      sedeId: access.sedeId,
      sessionRole: access.session.user.role,
    })

    const history = await listAiWorkspaceHistory({
      empresaId,
      limit: 120,
      kinds: ['LITOGRAFIA_QUOTE', 'IMAGE_GENERATION'],
      actorUserId: canViewCompanyWide ? null : access.userId,
    })

    return NextResponse.json({ ok: true, scope: canViewCompanyWide ? 'company' : 'personal', history })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo consultar el historial IA.' }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'WRITE')
    if (!access.ok) return access.response

    const body = await request.json().catch(() => null)
    const requestedAction = typeof body?.action === 'string' ? body.action : 'generate'

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 })

    if (requestedAction === 'save') {
      const parsedSave = saveSchema.safeParse(body)
      if (!parsedSave.success) {
        return NextResponse.json({ ok: false, error: parsedSave.error.issues[0]?.message || 'Body inválido.' }, { status: 400 })
      }

      const pending = await readPendingLitografiaAiImage({ empresaId, pendingId: parsedSave.data.pendingId })
      if (!pending) {
        return NextResponse.json({ ok: false, error: 'La imagen pendiente expiró o ya no existe. Genera una nueva versión.' }, { status: 404 })
      }

      const bytes = Buffer.from(pending.base64, 'base64')
      const fileSlug = pending.prompt
        .slice(0, 48)
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'imagen'

      const uploaded = await uploadCrmFiles({
        empresaId,
        currentPath: AI_IMAGES_FOLDER,
        actor: { userId: access.userId, label: access.session.user.name || access.session.user.email || 'Usuario interno' },
        files: [{
          name: `${fileSlug}.png`,
          type: 'image/png',
          size: bytes.byteLength,
          bytes,
        }],
      })

      const saved = uploaded[0] ?? null
      const nextEntryPatch = {
        summary: pending.revisedPrompt || 'Imagen generada con IA',
        responseText: `Imagen generada por ${pending.provider} con ${pending.model} y aprobada para guardarse en ${saved?.path || AI_IMAGES_FOLDER}.`,
        metadata: {
          provider: pending.provider,
          model: pending.model,
          size: pending.size,
          quality: pending.quality,
          pendingId: pending.id,
          status: 'APPROVED_AND_SAVED',
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
      } satisfies Parameters<typeof updateAiWorkspaceHistoryEntry>[0]['patch']

      if (parsedSave.data.historyId) {
        await updateAiWorkspaceHistoryEntry({
          empresaId,
          entryId: parsedSave.data.historyId,
          patch: nextEntryPatch,
        })
      } else {
        await appendAiWorkspaceHistory({
          empresaId,
          entry: {
            kind: 'IMAGE_GENERATION',
            prompt: pending.prompt,
            actorUserId: access.userId,
            actorLabel: access.session.user.name || access.session.user.email || 'Usuario interno',
            ...nextEntryPatch,
          },
        })
      }
      await deletePendingLitografiaAiImage({ empresaId, pendingId: pending.id })

      return NextResponse.json({
        ok: true,
        saved: saved
          ? {
              name: saved.name,
              path: saved.path,
              url: saved.url,
            }
          : null,
        responseText: `Imagen aprobada y guardada en ${saved?.path || AI_IMAGES_FOLDER}.`,
      })
    }

    const parsed = generateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Body inválido.' }, { status: 400 })
    }

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

    const pending = await createPendingLitografiaAiImage({
      empresaId,
      prompt: parsed.data.prompt,
      revisedPrompt: imageItem.revised_prompt || null,
      size: parsed.data.size || '1024x1024',
      quality: parsed.data.quality || 'auto',
      provider: config.baseUrl.includes('openai.com') ? 'OpenAI' : 'Proveedor OpenAI-compatible',
      model: config.model,
      mimeType: 'image/png',
      base64: bytes.toString('base64'),
    })
    const responseText = `Imagen generada por ${pending.provider} con ${config.model}. Revísala y apruébala si quieres guardarla en ${AI_IMAGES_FOLDER}.`
    const historyEntry = await appendAiWorkspaceHistory({
      empresaId,
      entry: {
        kind: 'IMAGE_GENERATION',
        prompt: parsed.data.prompt,
        actorUserId: access.userId,
        actorLabel: access.session.user.name || access.session.user.email || 'Usuario interno',
        summary: imageItem.revised_prompt || 'Imagen generada con IA pendiente de aprobación',
        responseText,
        metadata: {
          provider: pending.provider,
          model: config.model,
          size: parsed.data.size || '1024x1024',
          quality: parsed.data.quality || 'auto',
          pendingId: pending.id,
          status: 'PREVIEW_READY',
        },
        asset: null,
      },
    })
    const previewDataUrl = `data:image/png;base64,${bytes.toString('base64')}`

    return NextResponse.json({
      ok: true,
      image: {
        historyId: historyEntry.id,
        pendingId: pending.id,
        previewDataUrl,
        revisedPrompt: imageItem.revised_prompt || null,
        responseText,
        source: {
          provider: pending.provider,
          model: config.model,
          mode: 'LLM',
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Error generando la imagen.' }, { status: 500 })
  }
}