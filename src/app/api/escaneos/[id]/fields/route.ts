/**
 * API Route: Campos confirmables de un escaneo
 * GET  /api/escaneos/:id/fields
 * PATCH /api/escaneos/:id/fields  (JSON: { path: "vendor.nit", value: "...", confirm?: boolean })
 */

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

type PatchBody = {
  path?: string
  value?: unknown
  confirm?: boolean
}

function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function deepSet(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return

  let cursor: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const next = cursor[key]
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      cursor[key] = {}
    }
    cursor = cursor[key] as Record<string, unknown>
  }

  cursor[parts[parts.length - 1]] = value
}

function deepGet(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) return undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = obj
  for (const key of parts) {
    if (!cursor || typeof cursor !== "object") return undefined
    cursor = cursor[key]
  }
  return cursor
}

function jsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireApiAccess(ModuleKey.ESCANEOS, 'READ')
  if (!access.ok) return access.response

  const userId = access.userId

  const { id } = await context.params

  const scan = await prisma.documentScan.findFirst({
    where: { id, userId },
    select: { id: true, extractedData: true },
  })

  if (!scan) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

  const extracted = scan.extractedData ?? {}
  const extractedObj = asPlainObject(extracted)
  const confirmation = asPlainObject(extractedObj.confirmation)
  const fields = asPlainObject(confirmation.fields)

  return NextResponse.json({
    success: true,
    data: {
      id: scan.id,
      fields,
    },
  })
}

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
  if (!access.ok) return access.response

  const userId = access.userId

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as PatchBody

  const path = String(body.path || "").trim()
  if (!path) return NextResponse.json({ success: false, error: "'path' es requerido" }, { status: 400 })

  const scan = await prisma.documentScan.findFirst({ where: { id, userId } })
  if (!scan) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

  const extracted = scan.extractedData ?? {}
  const extractedObj: Record<string, unknown> = asPlainObject(extracted)

  // Guardamos confirmaciones en extractedData.confirmation.fields[path]
  const confirmation = asPlainObject(extractedObj.confirmation)
  const fields = asPlainObject(confirmation.fields)

  const now = new Date().toISOString()
  const entry = asPlainObject(fields[path])
  entry.value = body.value ?? null
  entry.confirmed = body.confirm !== false
  entry.confirmedAt = now
  entry.confirmedById = userId
  fields[path] = entry

  confirmation.fields = fields
  extractedObj.confirmation = confirmation

  // También aplicamos la corrección sobre extractedData.semantic.structured.* para que el UI lo refleje.
  const semantic = asPlainObject(extractedObj.semantic)
  const structured = asPlainObject(semantic.structured)
  const previousStructuredValue = deepGet(structured, path)
  deepSet(structured, path, body.value ?? null)
  semantic.structured = structured
  extractedObj.semantic = semantic

  const nextValue = body.value ?? null
  const confirmed = body.confirm !== false
  const shouldLogFeedback = !jsonEqual(previousStructuredValue, nextValue) || confirmed

  const [updated] = await prisma.$transaction([
    prisma.documentScan.update({
      where: { id: scan.id },
      data: {
        extractedData: extractedObj as Prisma.InputJsonValue,
      },
    }),
    ...(shouldLogFeedback
      ? [
          prisma.documentScanFieldFeedback.create({
            data: {
              scanId: scan.id,
              userId,
              sedeId: access.sedeId,
              source: "UI_SINGLE",
              path,
              confirmed,
              previousValue:
                previousStructuredValue === undefined || previousStructuredValue === null
                  ? Prisma.DbNull
                  : (previousStructuredValue as Prisma.InputJsonValue),
              newValue:
                nextValue === undefined || nextValue === null
                  ? Prisma.DbNull
                  : (nextValue as Prisma.InputJsonValue),
            },
          }),
        ]
      : []),
  ])

  return NextResponse.json({ success: true, data: updated })
}
