import { Queue } from "bullmq"
import type { ConnectionOptions } from "bullmq"

export type OcrAnalyzeJob = {
  scanId: string
  mimeType: string
  documentType: "FACTURA" | "COTIZACION" | "AUTO"
  provider?: string
  useLlm?: boolean
}

function getRedisUrl(): string {
  return (process.env.REDIS_URL || "").trim()
}

export function isOcrQueueEnabled(): boolean {
  return Boolean(getRedisUrl())
}

function parseRedisUrlToConnectionOptions(url: string): ConnectionOptions {
  const u = new URL(url)
  const isTls = u.protocol === "rediss:"

  const port = u.port ? Number(u.port) : 6379
  const username = u.username ? decodeURIComponent(u.username) : undefined
  const password = u.password ? decodeURIComponent(u.password) : undefined

  // ioredis usa "db" (number)
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

function getConnection(): ConnectionOptions {
  const url = getRedisUrl()
  if (!url) throw new Error("Falta REDIS_URL para usar cola de OCR")
  return parseRedisUrlToConnectionOptions(url)
}

let _queue: Queue | null = null

export function getOcrQueue() {
  if (_queue) return _queue
  _queue = new Queue("ocr", {
    connection: getConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  })
  return _queue
}

export async function enqueueOcr(job: OcrAnalyzeJob) {
  const q = getOcrQueue()
  await q.add("analyze", job, {
    jobId: job.scanId,
  })
}
