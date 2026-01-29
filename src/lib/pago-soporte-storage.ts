import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { isS3Enabled, getS3Bucket, getS3Client, getS3PublicBaseUrl } from "@/lib/s3"
import { deletePagoSoporteFile as deleteLocal, savePagoSoporteFile as saveLocal } from "@/lib/pago-soporte-file-storage"

function safeExtFromMime(mimeType: string) {
  const mt = (mimeType || "").toLowerCase()
  if (mt === "image/png") return ".png"
  if (mt === "image/jpeg" || mt === "image/jpg") return ".jpg"
  if (mt === "image/webp") return ".webp"
  if (mt === "application/pdf") return ".pdf"
  return ""
}

function buildObjectKey(pagoId: string, originalName: string | null | undefined, mimeType: string): string {
  const originalExt = originalName ? originalName.split(".").pop() : ""
  const extFromName = originalExt ? `.${originalExt}` : ""
  const extFromMime = safeExtFromMime(mimeType)
  const ext = (extFromName || extFromMime || "").toLowerCase()
  return `soportes/pagos/${pagoId}${ext}`
}

export async function savePagoSoporteObject(params: {
  pagoId: string
  originalName?: string | null
  mimeType: string
  bytes: Buffer
}): Promise<{ publicUrl: string; storedFileName: string; sizeBytes: number }> {
  if (!isS3Enabled()) {
    return saveLocal(params)
  }

  const key = buildObjectKey(params.pagoId, params.originalName, params.mimeType)
  const s3 = getS3Client()
  const bucket = getS3Bucket()

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.bytes,
      ContentType: params.mimeType,
      ACL: "public-read",
    })
  )

  const base = getS3PublicBaseUrl()
  return {
    publicUrl: `${base}/${encodeURI(key)}`,
    storedFileName: key,
    sizeBytes: params.bytes.length,
  }
}

export async function deletePagoSoporteObject(params: { storedFileName?: string | null; fileUrl?: string | null }) {
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
