/**
 * API Route: Export feedback OCR (correcciones/confirmaciones)
 * GET /api/escaneos/feedback/export?format=json|csv&limit=&confirmed=&path=&scanId=&includeText=&includeExtractedData=
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"

export const runtime = "nodejs"

function parseBool(value: string | null): boolean | null {
  if (value === null || value === undefined) return null
  const v = String(value).trim().toLowerCase()
  if (v === "") return null
  if (["1", "true", "yes", "y"].includes(v)) return true
  if (["0", "false", "no", "n"].includes(v)) return false
  return null
}

function parseIntParam(value: string | null, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.floor(n) : fallback
}

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value)
  const needs = /[",\n\r]/.test(s)
  const escaped = s.replace(/"/g, '""')
  return needs ? `"${escaped}"` : escaped
}

function jsonToInline(value: unknown): string {
  if (value === null || value === undefined) return ""
  try {
    if (typeof value === "string") return value
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export async function GET(request: NextRequest) {
  const access = await requireApiAccess(ModuleKey.ESCANEOS, "READ")
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)

  const formatRaw = (searchParams.get("format") || "json").trim().toLowerCase()
  const format: "json" | "csv" = formatRaw === "csv" ? "csv" : "json"

  const limit = Math.min(5000, Math.max(1, parseIntParam(searchParams.get("limit"), 1000)))

  const confirmed = parseBool(searchParams.get("confirmed"))
  const path = (searchParams.get("path") || "").trim()
  const scanId = (searchParams.get("scanId") || "").trim()

  const includeText = parseBool(searchParams.get("includeText")) === true
  const includeExtractedData = parseBool(searchParams.get("includeExtractedData")) === true

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    sedeId: access.sedeId,
  }

  if (confirmed !== null) where.confirmed = confirmed
  if (path) where.path = path
  if (scanId) where.scanId = scanId

  const rows = await prisma.documentScanFieldFeedback.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      scan: {
        select: {
          id: true,
          tipo: true,
          provider: true,
          status: true,
          capturePercent: true,
          pageCount: true,
          fileUrl: true,
          originalFileName: true,
          extractedText: includeText,
          extractedData: includeExtractedData,
          createdAt: true,
        },
      },
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  })

  if (format === "json") {
    return NextResponse.json({
      success: true,
      data: {
        meta: {
          limit,
          returned: rows.length,
          includeText,
          includeExtractedData,
        },
        items: rows,
      },
    })
  }

  // CSV
  const headers = [
    "feedbackId",
    "createdAt",
    "source",
    "path",
    "confirmed",
    "previousValue",
    "newValue",
    "scanId",
    "scanTipo",
    "scanProvider",
    "scanStatus",
    "capturePercent",
    "pageCount",
    "fileUrl",
    "originalFileName",
    "userId",
    "userEmail",
    "userName",
  ]

  const lines: string[] = []
  lines.push(headers.join(","))

  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.createdAt.toISOString(),
        r.source,
        r.path,
        String(r.confirmed),
        jsonToInline(r.previousValue),
        jsonToInline(r.newValue),
        r.scanId,
        r.scan.tipo,
        r.scan.provider,
        r.scan.status,
        String(r.scan.capturePercent ?? 0),
        String(r.scan.pageCount ?? 1),
        r.scan.fileUrl,
        r.scan.originalFileName ?? "",
        r.userId,
        r.user.email,
        r.user.name ?? "",
      ].map(csvEscape).join(",")
    )
  }

  const csv = lines.join("\n")

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ocr-feedback-${Date.now()}.csv"`,
      "Cache-Control": "no-store",
    },
  })
}
