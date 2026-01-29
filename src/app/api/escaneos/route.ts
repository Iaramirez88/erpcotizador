/**
 * API Route: Escaneos (OCR/IA)
 * GET /api/escaneos?page=&pageSize=&status=&approved=
 * POST /api/escaneos (multipart/form-data: file, tipo)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deleteScanObject, saveScanObject } from "@/lib/scan-storage"
import { analyzeDocument, type ScanDocumentType } from "@/lib/document-scan"
import { stripNullChars } from "@/lib/utils"
import { Prisma } from "@prisma/client"
import { requireApiAccess } from "@/lib/api-rbac"
import { ModuleKey } from "@prisma/client"
import { enqueueOcr, isOcrQueueEnabled } from "@/lib/ocr-queue"

export const runtime = "nodejs"

type DbScanTipo = "FACTURA" | "COTIZACION"

function parseIntParam(value: string | null, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

// GET - Listar escaneos con paginación
export async function GET(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ESCANEOS, 'READ')
    if (!access.ok) return access.response

    const userId = access.userId

    const { searchParams } = new URL(request.url)
    const page = parseIntParam(searchParams.get("page"), 1)
    const pageSize = Math.min(50, parseIntParam(searchParams.get("pageSize"), 10))

    const status = searchParams.get("status")
    const approved = searchParams.get("approved")
    const q = (searchParams.get("q") || "").trim()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId,
      sedeId: access.sedeId,
    }

    if (status) where.status = status
    if (approved !== null && approved !== undefined && approved !== "") {
      where.approved = approved === "true"
    }

    if (q) {
      where.OR = [
        { id: { contains: q } },
        { originalFileName: { contains: q, mode: "insensitive" } },
        { extractedText: { contains: q, mode: "insensitive" } },
        { fileUrl: { contains: q, mode: "insensitive" } },
      ]
    }

    const [total, items] = await Promise.all([
      prisma.documentScan.count({ where }),
      prisma.documentScan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tipo: true,
          provider: true,
          status: true,
          capturePercent: true,
          pageCount: true,
          approved: true,
          approvedAt: true,
          fileUrl: true,
          originalFileName: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    console.error("Error al listar escaneos:", error)
    return NextResponse.json({ success: false, error: "Error al listar escaneos" }, { status: 500 })
  }
}

// POST - Crear escaneo + procesar
export async function POST(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
    if (!access.ok) return access.response

    const userId = access.userId

    const form = await request.formData()
    const file = form.get("file")
    const tipoDb = (form.get("tipo") || "FACTURA") as DbScanTipo
    const autoDetectRaw = form.get("autoDetect")
    const autoDetect = String(autoDetectRaw || "").toLowerCase() === "true"
    const useLlmRaw = form.get("useLlm")
    const useLlm = useLlmRaw === null ? true : String(useLlmRaw).toLowerCase() !== "false"

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 })
    }

    const mimeType = file.type || "application/octet-stream"
    const bytes = Buffer.from(await file.arrayBuffer())

    // Crear registro inicial
    const scan = await prisma.documentScan.create({
      data: {
        tipo: tipoDb,
        provider: "TESSERACT",
        status: "PENDIENTE",
        mimeType,
        fileUrl: "",
        userId,
        sedeId: access.sedeId,
        originalFileName: file.name ? stripNullChars(file.name) : null,
      },
    })

    // Guardar archivo
    const saved = await saveScanObject({
      scanId: scan.id,
      originalName: file.name,
      mimeType,
      bytes,
    })


    // Guardar URL/Key en BD (rápido)
    const queued = await prisma.documentScan.update({
      where: { id: scan.id },
      data: {
        fileUrl: saved.publicUrl,
        storedFileName: saved.storedFileName,
        status: "PENDIENTE",
      },
    })

    // Encolar OCR/IA (recomendado). Si no hay REDIS_URL, devolvemos el registro en PENDIENTE.
    if (isOcrQueueEnabled()) {
      await enqueueOcr({
        scanId: scan.id,
        mimeType,
        documentType: (autoDetect ? "AUTO" : tipoDb) as "FACTURA" | "COTIZACION" | "AUTO",
        provider: "TESSERACT",
        useLlm,
      })

      return NextResponse.json(
        { success: true, data: queued, message: "Escaneo en cola para procesamiento" },
        { status: 202 }
      )
    }

    // Fallback síncrono (útil en local): procesa en el mismo request.
    const syncFallback = (process.env.OCR_SYNC_FALLBACK || "").trim().toLowerCase() !== "false"
    if (!syncFallback) {
      return NextResponse.json(
        {
          success: true,
          data: queued,
          message: "Escaneo creado (sin cola). Configura REDIS_URL o habilita OCR_SYNC_FALLBACK.",
        },
        { status: 201 }
      )
    }

    try {
      const analysis = await analyzeDocument({
        bytes,
        mimeType,
        documentType: (autoDetect ? "AUTO" : tipoDb) as ScanDocumentType,
        provider: "TESSERACT",
        useLlm,
      })

      const extractedData =
        analysis.extractedData === undefined || analysis.extractedData === null
          ? Prisma.DbNull
          : (analysis.extractedData as Prisma.InputJsonValue)

      const updated = await prisma.documentScan.update({
        where: { id: scan.id },
        data: {
          status: "PROCESADO",
          provider: analysis.provider,
          extractedText: analysis.extractedText || null,
          extractedData,
          capturePercent: analysis.capturePercent,
          pageCount: analysis.pageCount,
          error: null,
        },
      })

      return NextResponse.json(
        { success: true, data: updated, message: "Escaneo procesado" },
        { status: 201 }
      )
    } catch (error) {
      const safeError = stripNullChars(error instanceof Error ? error.message : "Error desconocido")
      const updated = await prisma.documentScan.update({
        where: { id: scan.id },
        data: { status: "FALLIDO", error: safeError },
      })

      return NextResponse.json(
        { success: false, error: "Error al procesar escaneo", details: updated.error || null, data: updated },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("Error al crear escaneo:", error)
    return NextResponse.json({ success: false, error: "Error al crear escaneo" }, { status: 500 })
  }
}

// DELETE - Eliminar escaneos por lote (body: { ids: string[] })
export async function DELETE(request: NextRequest) {
  try {
    const access = await requireApiAccess(ModuleKey.ESCANEOS, 'WRITE')
    if (!access.ok) return access.response

    const userId = access.userId

    const body = (await request.json().catch(() => ({}))) as { ids?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids.map((x) => String(x)).filter(Boolean) : []
    if (ids.length === 0) {
      return NextResponse.json({ success: false, error: "ids es requerido" }, { status: 400 })
    }
    if (ids.length > 200) {
      return NextResponse.json({ success: false, error: "Demasiados ids (max 200)" }, { status: 400 })
    }

    const scans = await prisma.documentScan.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true, storedFileName: true, fileUrl: true },
    })

    if (scans.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 })
    }

    await prisma.documentScan.deleteMany({ where: { id: { in: scans.map((s) => s.id) }, userId } })

    // Limpiar archivos en disco (best-effort)
    await Promise.all(scans.map((s) => deleteScanObject({ storedFileName: s.storedFileName, fileUrl: s.fileUrl })))

    return NextResponse.json({ success: true, deleted: scans.length })
  } catch (error) {
    console.error("Error al eliminar escaneos:", error)
    return NextResponse.json({ success: false, error: "Error al eliminar escaneos" }, { status: 500 })
  }
}
