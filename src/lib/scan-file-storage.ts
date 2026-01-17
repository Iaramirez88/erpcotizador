import { mkdir, unlink, writeFile } from "fs/promises"
import path from "path"

function safeExtFromMime(mimeType: string) {
  const mt = mimeType.toLowerCase()
  if (mt === "image/png") return ".png"
  if (mt === "image/jpeg" || mt === "image/jpg") return ".jpg"
  if (mt === "image/webp") return ".webp"
  if (mt === "application/pdf") return ".pdf"
  return ""
}

export async function saveScanFile(params: {
  scanId: string
  originalName?: string | null
  mimeType: string
  bytes: Buffer
}): Promise<{ publicUrl: string; storedFileName: string }> {
  const originalExt = params.originalName ? path.extname(params.originalName) : ""
  const mimeExt = safeExtFromMime(params.mimeType)
  const ext = (originalExt || mimeExt || "").toLowerCase()

  const fileName = `${params.scanId}${ext || ""}`

  const publicDir = path.join(process.cwd(), "public", "scans")
  await mkdir(publicDir, { recursive: true })

  const absPath = path.join(publicDir, fileName)
  await writeFile(absPath, params.bytes)

  return {
    publicUrl: `/scans/${encodeURIComponent(fileName)}`,
    storedFileName: fileName,
  }
}

export async function deleteScanFile(params: { storedFileName?: string | null; fileUrl?: string | null }) {
  const stored = params.storedFileName?.trim()
  const fromUrl = params.fileUrl?.startsWith("/scans/")
    ? decodeURIComponent(params.fileUrl.replace("/scans/", "")).trim()
    : ""
  const fileName = stored || fromUrl
  if (!fileName) return

  const publicDir = path.join(process.cwd(), "public", "scans")
  const absPath = path.join(publicDir, fileName)

  try {
    await unlink(absPath)
  } catch (e) {
    // Ignorar si no existe
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "ENOENT") return
    throw e
  }
}
