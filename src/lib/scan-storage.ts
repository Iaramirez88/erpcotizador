import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import type { Readable } from "stream"
import { readFile } from "fs/promises"
import path from "path"
import { isS3Enabled, getS3Bucket, getS3Client, getS3PublicBaseUrl } from "@/lib/s3"
import { deleteScanFile as deleteLocal, saveScanFile as saveLocal } from "@/lib/scan-file-storage"

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

function safeExtFromMime(mimeType: string) {
  const mt = (mimeType || "").toLowerCase()
  if (mt === "image/png") return ".png"
  if (mt === "image/jpeg" || mt === "image/jpg") return ".jpg"
  if (mt === "image/webp") return ".webp"
  if (mt === "application/pdf") return ".pdf"
  return ""
}

function buildObjectKey(scanId: string, originalName: string | null | undefined, mimeType: string): string {
  const originalExt = originalName ? originalName.split(".").pop() : ""
  const extFromName = originalExt ? `.${originalExt}` : ""
  const extFromMime = safeExtFromMime(mimeType)
  const ext = (extFromName || extFromMime || "").toLowerCase()
  return `scans/${scanId}${ext}`
}

export async function saveScanObject(params: {
  scanId: string
  originalName?: string | null
  mimeType: string
  bytes: Buffer
}): Promise<{ publicUrl: string; storedFileName: string }> {
  if (!isS3Enabled()) {
    return saveLocal(params)
  }

  const key = buildObjectKey(params.scanId, params.originalName, params.mimeType)
  const s3 = getS3Client()
  const bucket = getS3Bucket()

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.bytes,
      ContentType: params.mimeType,
      // Para compatibilidad con el comportamiento actual (URL directa en UI), asumimos bucket/CDN público.
      // Si quieres bucket privado, toca servir via URL firmada desde la app.
      ACL: "public-read",
    })
  )

  const base = getS3PublicBaseUrl()
  return {
    publicUrl: `${base}/${encodeURI(key)}`,
    storedFileName: key,
  }
}

export async function getScanObjectBytes(params: { storedFileName: string }): Promise<Buffer> {
  if (!isS3Enabled()) {
    const fileName = (params.storedFileName || "").replace(/^scans\//, "")
    if (!fileName) throw new Error("storedFileName vacío")
    const publicDir = path.join(process.cwd(), "public", "scans")
    const absPath = path.join(publicDir, fileName)
    return readFile(absPath)
  }

  const s3 = getS3Client()
  const bucket = getS3Bucket()

  const resp = await s3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: params.storedFileName,
    })
  )

  const body = resp.Body
  if (!body) throw new Error("No se pudo leer el archivo desde S3 (Body vacío)")

  // En Node, Body suele ser Readable
  return streamToBuffer(body as Readable)
}

export async function deleteScanObject(params: { storedFileName?: string | null; fileUrl?: string | null }) {
  if (!isS3Enabled()) {
    return deleteLocal(params)
  }

  const key = (params.storedFileName || "").trim()
  if (!key) return

  const s3 = getS3Client()
  const bucket = getS3Bucket()

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    )
  } catch {
    // best-effort
  }
}
