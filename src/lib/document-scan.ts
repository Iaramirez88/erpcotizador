import { sanitizeJsonStrings, stripNullChars } from "@/lib/utils"

// Nota: en BD el enum actual es FACTURA|COTIZACION, pero el servicio OCR soporta AUTO.
export type ScanDocumentType = "FACTURA" | "COTIZACION" | "AUTO"
export type ScanProvider = "PADDLEOCR" | "TESSERACT"

export interface ScanAnalysisResult {
  provider: ScanProvider
  extractedText: string
  extractedData: unknown | null
  capturePercent: number
  pageCount: number
}

type OCRServiceResponse = {
  provider?: string
  extractedText?: unknown
  extractedData?: unknown
  capturePercent?: unknown
  pageCount?: unknown
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "")
}

export async function analyzeDocument(params: {
  bytes: Buffer
  mimeType: string
  documentType: ScanDocumentType
  provider?: string | null
  useLlm?: boolean
}): Promise<ScanAnalysisResult> {
  const baseUrl = normalizeBaseUrl(process.env.OCR_SERVICE_URL || "http://127.0.0.1:8001")
  const url = `${baseUrl}/analyze`

  const form = new FormData()
  const blob = new Blob([new Uint8Array(params.bytes)], { type: params.mimeType })
  form.append("file", blob, "document")
  form.append("document_type", params.documentType)
  form.append("country", "CO")
  form.append("language", "es")
  if (params.provider) form.append("provider", params.provider)
  if (params.useLlm === false) form.append("use_llm", "false")

  const resp = await fetch(url, {
    method: "POST",
    body: form,
    headers: process.env.OCR_SERVICE_API_KEY
      ? { "X-Api-Key": process.env.OCR_SERVICE_API_KEY }
      : undefined,
  })

  if (!resp.ok) {
    const contentType = resp.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const body: unknown = await resp.json().catch(() => null)
      if (body && typeof body === "object" && "detail" in body) {
        const detail = String((body as Record<string, unknown>).detail || "")
        throw new Error(`OCR service falló (${resp.status}): ${detail || resp.statusText}`)
      }
    }
    const text = await resp.text().catch(() => "")
    throw new Error(`OCR service falló (${resp.status}): ${text || resp.statusText}`)
  }

  const raw: unknown = await resp.json()
  const data: OCRServiceResponse = (raw && typeof raw === "object") ? (raw as OCRServiceResponse) : {}

  const providerRaw = String(data.provider || "PADDLEOCR").toUpperCase()
  const provider: ScanProvider = providerRaw === "TESSERACT" ? "TESSERACT" : "PADDLEOCR"

  const extractedText = stripNullChars(
    typeof data.extractedText === "string" ? data.extractedText.trim() : String(data.extractedText || "").trim()
  )
  const extractedData = sanitizeJsonStrings(data.extractedData ?? null)

  return {
    provider,
    extractedText,
    extractedData,
    capturePercent: Number(data.capturePercent) || 0,
    pageCount: Number(data.pageCount) || 1,
  }
}
