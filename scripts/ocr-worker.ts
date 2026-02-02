import "dotenv/config"
import { Worker, type Job, type ConnectionOptions } from "bullmq"
import { prisma } from "../src/lib/prisma"
import { analyzeDocument, type ScanDocumentType } from "../src/lib/document-scan"
import { getScanObjectBytes } from "../src/lib/scan-storage"
import { stripNullChars } from "../src/lib/utils"
import { Prisma } from "@prisma/client"
import type { OcrAnalyzeJob } from "../src/lib/ocr-queue"

function requiredEnv(name: string): string {
  const v = (process.env[name] || "").trim()
  if (!v) throw new Error(`Falta variable de entorno: ${name}`)
  return v
}

const redisUrl = requiredEnv("REDIS_URL")
const concurrency = Math.max(1, Number(process.env.OCR_WORKER_CONCURRENCY || 2) || 2)

function parseRedisUrlToConnectionOptions(url: string): ConnectionOptions {
  const u = new URL(url)
  const isTls = u.protocol === "rediss:"

  const port = u.port ? Number(u.port) : 6379
  const username = u.username ? decodeURIComponent(u.username) : undefined
  const password = u.password ? decodeURIComponent(u.password) : undefined
  const db = u.pathname && u.pathname !== "/" ? Number(u.pathname.replace("/", "")) : undefined

  return {
    host: u.hostname,
    port,
    username,
    password,
    db: Number.isFinite(db as number) ? (db as number) : undefined,
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  }
}

const connection = parseRedisUrlToConnectionOptions(redisUrl)

async function processJob(job: { data: OcrAnalyzeJob }) {
  const { scanId, mimeType, documentType, provider, useLlm } = job.data

  const scan = await prisma.documentScan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      status: true,
      storedFileName: true,
      tipo: true,
    },
  })

  if (!scan) return
  if (scan.status === "PROCESADO" || scan.status === "APROBADO") return

  if (!scan.storedFileName) {
    await prisma.documentScan.update({
      where: { id: scanId },
      data: { status: "FALLIDO", error: "Archivo no encontrado (storedFileName vacío)" },
    })
    return
  }

  try {
    const bytes = await getScanObjectBytes({ storedFileName: scan.storedFileName })

    const analysis = await analyzeDocument({
      bytes,
      mimeType,
      documentType: documentType as ScanDocumentType,
      provider: provider || "TESSERACT",
      useLlm,
    })

    const extractedData =
      analysis.extractedData === undefined || analysis.extractedData === null
        ? Prisma.DbNull
        : (analysis.extractedData as Prisma.InputJsonValue)

    await prisma.documentScan.update({
      where: { id: scanId },
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
  } catch (err) {
    const safeError = stripNullChars(err instanceof Error ? err.message : "Error desconocido")
    await prisma.documentScan.update({
      where: { id: scanId },
      data: { status: "FALLIDO", error: safeError },
    })
    throw err
  }
}

const worker = new Worker<OcrAnalyzeJob>(
  "ocr",
  async (job: Job<OcrAnalyzeJob>) => processJob({ data: job.data }),
  {
    connection,
    concurrency,
  }
)

worker.on("ready", () => {
  console.log(`[OCR-WORKER] listo. concurrency=${concurrency}`)
})

worker.on("error", (err: unknown) => {
  console.error("[OCR-WORKER] error:", err)
})

worker.on("failed", (job: Job<OcrAnalyzeJob> | undefined, err: unknown) => {
  console.error(`[OCR-WORKER] job falló id=${job?.id}:`, err)
})

process.on("SIGINT", async () => {
  console.log("[OCR-WORKER] cerrando...")
  await worker.close()
  process.exit(0)
})
