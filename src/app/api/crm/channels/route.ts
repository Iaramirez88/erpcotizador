import { NextResponse } from 'next/server'
import { AccessLevel, ModuleKey, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import {
  assertCrmSedeAccess,
  isPlainObject,
  normalizeString,
  parseChannelConnectionStatus,
  parseChannelProvider,
} from '@/lib/crm'
import { maskTokenPreview } from '@/lib/crm-omnichannel'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'READ')
    if (!access.ok) return access.response

    const { searchParams } = new URL(request.url)
    const sedeId = normalizeString(searchParams.get('sedeId'))
    const provider = parseChannelProvider(searchParams.get('provider'))
    const status = parseChannelConnectionStatus(searchParams.get('status'))

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.READ })
      if (denied) return denied
    }

    const rows = await prisma.crmChannelConnection.findMany({
      where: {
        empresaId: access.empresaId,
        ...(sedeId ? { sedeId } : {}),
        ...(provider ? { provider } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { conversations: true, captures: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        verifyTokenPreview: maskTokenPreview(row.verifyToken),
      })),
    })
  } catch (error) {
    console.error('Error listando canales CRM:', error)
    return NextResponse.json({ error: 'Error listando canales CRM' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireApiAccess(ModuleKey.CRM, 'WRITE')
    if (!access.ok) return access.response

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    const provider = parseChannelProvider(body?.provider)
    const status = parseChannelConnectionStatus(body?.status) ?? 'TESTING'
    const name = normalizeString(body?.name)
    const sedeId = normalizeString(body?.sedeId)
    const verifyToken = normalizeString(body?.verifyToken)
    const settingsJson = isPlainObject(body?.settingsJson) ? (body?.settingsJson as Prisma.InputJsonValue) : {}

    if (!provider) {
      return NextResponse.json({ error: 'provider inválido' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }

    if (sedeId) {
      const denied = await assertCrmSedeAccess({ sedeId, empresaId: access.empresaId, userId: access.userId, minLevel: AccessLevel.WRITE })
      if (denied) return denied
    }

    const row = await prisma.crmChannelConnection.create({
      data: {
        empresaId: access.empresaId,
        sedeId: sedeId || null,
        provider,
        status,
        name,
        externalAccountId: normalizeString(body?.externalAccountId) || null,
        externalPageId: normalizeString(body?.externalPageId) || null,
        externalPhoneNumberId: normalizeString(body?.externalPhoneNumberId) || null,
        verifyToken: verifyToken || null,
        settingsJson,
        createdById: access.userId,
      },
      include: {
        sede: { select: { id: true, nombre: true, codigo: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        verifyTokenPreview: maskTokenPreview(row.verifyToken),
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Error creando canal CRM:', error)
    return NextResponse.json({ error: 'Error creando canal CRM' }, { status: 500 })
  }
}