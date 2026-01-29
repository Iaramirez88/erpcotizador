/**
 * API Route: Confirmación masiva de campos de un escaneo
 * POST /api/escaneos/:id/fields/bulk
 * Body: { fields: Record<string, unknown>, confirm?: boolean }
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

type BulkBody = {
  fields?: Record<string, unknown>
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

export async function POST(request: Request, context: RouteContext) {
  const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
  if (!access.ok) return access.response

  const userId = access.userId

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as BulkBody

  const fieldsIn = body.fields && typeof body.fields === "object" ? body.fields : null
  if (!fieldsIn) {
    return NextResponse.json({ success: false, error: "'fields' es requerido" }, { status: 400 })
  }

  const scan = await prisma.documentScan.findFirst({ where: { id, userId } })
  if (!scan) return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 })

  const extracted = scan.extractedData ?? {}
  const extractedObj: Record<string, unknown> = asPlainObject(extracted)

  const now = new Date().toISOString()

  const confirmation = asPlainObject(extractedObj.confirmation)
  const fields = asPlainObject(confirmation.fields)

  const semantic = asPlainObject(extractedObj.semantic)
  const structured = asPlainObject(semantic.structured)

  const confirm = body.confirm !== false

  let applied = 0
  const feedbackRows: Prisma.DocumentScanFieldFeedbackCreateManyInput[] = []

  for (const [path, value] of Object.entries(fieldsIn)) {
    const p = String(path || "").trim()
    if (!p) continue

    const entry = asPlainObject(fields[p])
    entry.value = value ?? null
    entry.confirmed = confirm
    entry.confirmedAt = now
    entry.confirmedById = userId
    fields[p] = entry

    const prev = deepGet(structured, p)
    const next = value ?? null
    if (!jsonEqual(prev, next) || confirm) {
      feedbackRows.push({
        scanId: scan.id,
        userId,
        sedeId: access.sedeId,
        source: "UI_BULK",
        path: p,
        confirmed: confirm,
        previousValue:
          prev === undefined || prev === null
            ? Prisma.DbNull
            : (prev as Prisma.InputJsonValue),
        newValue:
          next === undefined || next === null
            ? Prisma.DbNull
            : (next as Prisma.InputJsonValue),
      })
    }

    deepSet(structured, p, value ?? null)
    applied++
  }

  confirmation.fields = fields
  extractedObj.confirmation = confirmation

  semantic.structured = structured
  extractedObj.semantic = semantic

  const [updated] = await prisma.$transaction([
    prisma.documentScan.update({
      where: { id: scan.id },
      data: {
        extractedData: extractedObj as Prisma.InputJsonValue,
      },
    }),
    ...(feedbackRows.length > 0
      ? [
          prisma.documentScanFieldFeedback.createMany({
            data: feedbackRows,
          }),
        ]
      : []),
  ])

  return NextResponse.json({ success: true, data: updated, meta: { applied } })
}
