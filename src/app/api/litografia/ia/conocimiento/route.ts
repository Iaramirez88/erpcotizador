import { NextRequest, NextResponse } from 'next/server'
import { ModuleKey } from '@prisma/client'
import { z } from 'zod'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  getDefaultLitografiaAiKnowledge,
  litografiaAiKnowledgeDocumentSchema,
  readLitografiaAiKnowledge,
  summarizeLitografiaAiKnowledge,
  writeLitografiaAiKnowledge,
} from '@/lib/litografia-ai-knowledge'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const requestSchema = z.object({
  document: litografiaAiKnowledgeDocumentSchema,
  source: z.enum(['default', 'custom']).optional(),
})

async function getEmpresaIdFromSedeId(sedeId: string) {
  const sede = await prisma.sede.findUnique({ where: { id: sedeId }, select: { empresaId: true } })
  return sede?.empresaId ?? null
}

function getActorLabel(access: Awaited<ReturnType<typeof requireApiAccess>>) {
  if (!access.ok) return null
  const profile = access.session?.user
  return profile?.name?.trim() || profile?.email?.trim() || null
}

export async function GET() {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'READ')
    if (!access.ok) return access.response

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 })

    const store = await readLitografiaAiKnowledge(empresaId)
    return NextResponse.json({
      ok: true,
      store,
      summary: summarizeLitografiaAiKnowledge(store.document),
      defaultDocument: getDefaultLitografiaAiKnowledge(),
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo cargar la base de conocimiento IA.' }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.COTIZADOR, 'WRITE')
    if (!access.ok) return access.response

    const empresaId = await getEmpresaIdFromSedeId(access.sedeId)
    if (!empresaId) return NextResponse.json({ ok: false, error: 'Empresa no encontrada.' }, { status: 404 })

    const body = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message || 'Body invalido.' }, { status: 400 })
    }

    const store = await writeLitografiaAiKnowledge({
      empresaId,
      document: parsed.data.document,
      source: parsed.data.source || 'custom',
      updatedByUserId: access.userId,
      updatedByLabel: getActorLabel(access),
    })

    return NextResponse.json({
      ok: true,
      store,
      summary: summarizeLitografiaAiKnowledge(store.document),
      message: store.source === 'default'
        ? 'Se restauro la base por defecto para esta empresa.'
        : 'Base de conocimiento IA guardada correctamente.',
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'No se pudo guardar la base de conocimiento IA.' }, { status: 400 })
  }
}