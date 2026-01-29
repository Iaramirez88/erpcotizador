import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

function safeExtFromMime(mimeType: string) {
  const mt = (mimeType || "").toLowerCase()
  if (mt === "image/png") return ".png"
  if (mt === "image/jpeg" || mt === "image/jpg") return ".jpg"
  if (mt === "image/webp") return ".webp"
  if (mt === "application/pdf") return ".pdf"
  return ""
}

export async function savePagoSoporteFile(params: {
  pagoId: string
  originalName?: string | null
  mimeType: string
  bytes: Buffer
}): Promise<{ publicUrl: string; storedFileName: string; sizeBytes: number }>{
  const originalExt = params.originalName ? path.extname(params.originalName) : ""
  const mimeExt = safeExtFromMime(params.mimeType)
  const ext = (originalExt || mimeExt || "").toLowerCase()

  const fileName = `${params.pagoId}${ext || ""}`

  const publicDir = path.join(process.cwd(), "public", "soportes", "pagos")
  await mkdir(publicDir, { recursive: true })

  const absPath = path.join(publicDir, fileName)
  await writeFile(absPath, params.bytes)

  return {
    publicUrl: `/soportes/pagos/${encodeURIComponent(fileName)}`,
    storedFileName: fileName,
    sizeBytes: params.bytes.length,
  }
}

export async function deletePagoSoporteFile(params: { storedFileName?: string | null; fileUrl?: string | null }) {
  const stored = params.storedFileName?.trim()
  const fromUrl = params.fileUrl?.startsWith("/soportes/pagos/")
    ? decodeURIComponent(params.fileUrl.replace("/soportes/pagos/", "")).trim()
    : ""
  const fileName = stored || fromUrl
  if (!fileName) return

  const publicDir = path.join(process.cwd(), "public", "soportes", "pagos")
  const absPath = path.join(publicDir, fileName)

  try {
    await unlink(absPath)
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ENOENT") return
    throw e
  }
}
