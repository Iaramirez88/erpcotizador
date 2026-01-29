import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireApiAccess } from '@/lib/api-rbac'
import { ModuleKey, PosPaymentMethod } from '@prisma/client'
import { savePagoSoporteObject } from '@/lib/pago-soporte-storage'

export const runtime = 'nodejs'

function n(value: unknown, fallback = 0) {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseMetodo(value: unknown): PosPaymentMethod {
  const v = String(value || '').trim().toUpperCase()
  if (v === 'CASH') return PosPaymentMethod.CASH
  if (v === 'CARD') return PosPaymentMethod.CARD
  if (v === 'TRANSFER') return PosPaymentMethod.TRANSFER
  return PosPaymentMethod.OTHER
}

async function getCompraOr404(compraId: string, sedeId: string, userId: string) {
  const compra = await prisma.compra.findFirst({
    where: { id: compraId, sedeId, userId },
    select: { id: true, total: true, empresaId: true, sedeId: true },
  })
  if (!compra) return null
  return compra
}

type ApiResponse =
  | { success: true; data: { pagos: CompraPagoDto[]; pagado: number; saldo: number } }
  | { success?: false; error: string }

type CompraPagoDto = {
  id: string
  fecha: Date
  monto: number
  metodo: PosPaymentMethod
  referencia: string | null
  observaciones: string | null
  soporteUrl: string | null
  soporteOriginalName: string | null
  soporteMimeType: string | null
  soporteSizeBytes: number | null
  createdAt: Date
  user: { name: string | null; email: string | null } | null
}

function getContentType(req: NextRequest) {
  return (req.headers.get('content-type') || '').toLowerCase()
}

async function readBody(req: NextRequest): Promise<
  | { kind: 'json'; data: Record<string, unknown> }
  | { kind: 'form'; data: Record<string, unknown>; file: File | null }
> {
  const ct = getContentType(req)
  if (ct.includes('multipart/form-data')) {
    const form = await req.formData()
    const file = form.get('file')
    const data: Record<string, unknown> = {}
    for (const [k, v] of form.entries()) {
      if (k === 'file') continue
      data[k] = v
    }
    return { kind: 'form', data, file: file instanceof File ? file : null }
  }

  const data = (await req.json().catch(() => ({}))) as Record<string, unknown>
  return { kind: 'json', data }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.COMPRAS, 'READ')
  if (!access.ok) return access.response

  const { id } = await context.params
  const compra = await getCompraOr404(id, access.sedeId, access.userId)
  if (!compra) return NextResponse.json({ success: false, error: 'Compra no encontrada' } satisfies ApiResponse, { status: 404 })

  const pagos = (await prisma.compraPago.findMany({
    where: { compraId: compra.id },
    orderBy: { fecha: 'desc' },
    select: {
      id: true,
      fecha: true,
      monto: true,
      metodo: true,
      referencia: true,
      observaciones: true,
      soporteUrl: true,
      soporteOriginalName: true,
      soporteMimeType: true,
      soporteSizeBytes: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  })) as CompraPagoDto[]

  const pagado = pagos.reduce<number>((sum, p) => sum + n(p.monto, 0), 0)
  const saldo = n(compra.total, 0) - pagado

  return NextResponse.json({ success: true, data: { pagos, pagado, saldo } } satisfies ApiResponse)
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const access = await requireApiAccess(ModuleKey.COMPRAS, 'WRITE')
  if (!access.ok) return access.response

  const { id } = await context.params
  const compra = await getCompraOr404(id, access.sedeId, access.userId)
  if (!compra) return NextResponse.json({ success: false, error: 'Compra no encontrada' } satisfies ApiResponse, { status: 404 })

  const payload = await readBody(req)
  const body = payload.data

  const monto = n(body.monto, 0)
  if (!Number.isFinite(monto) || monto <= 0) {
    return NextResponse.json({ success: false, error: 'Monto inválido' } satisfies ApiResponse, { status: 400 })
  }

  const fecha = body.fecha ? new Date(String(body.fecha)) : new Date()
  const metodo = parseMetodo(body.metodo)
  const referencia = body.referencia ? String(body.referencia).trim() : null
  const observaciones = body.observaciones ? String(body.observaciones).trim() : null

  const created = await prisma.compraPago.create({
    data: {
      compraId: compra.id,
      fecha,
      monto,
      metodo,
      referencia,
      observaciones,
      sedeId: compra.sedeId,
      userId: access.userId,
      empresaId: compra.empresaId,
    },
    select: { id: true },
  })

  if (payload.kind === 'form' && payload.file) {
    const mimeType = payload.file.type || 'application/octet-stream'
    const bytes = Buffer.from(await payload.file.arrayBuffer())
    const saved = await savePagoSoporteObject({
      pagoId: created.id,
      originalName: payload.file.name,
      mimeType,
      bytes,
    })

    await prisma.compraPago.update({
      where: { id: created.id },
      data: {
        soporteUrl: saved.publicUrl,
        soporteStoredName: saved.storedFileName,
        soporteOriginalName: payload.file.name || null,
        soporteMimeType: mimeType,
        soporteSizeBytes: saved.sizeBytes,
      },
      select: { id: true },
    })
  }

  return GET(req, context)
}
