"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  History,
  ImageIcon,
  ImagePlus,
  Info,
  LoaderCircle,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

type ImageQuality = "low" | "medium" | "high" | "auto"

type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "1024x768" | "1536x864" | "864x1536"

type AiHistoryEntry = {
  id: string
  kind: "IMAGE_GENERATION"
  prompt: string
  createdAt: string
  actorLabel: string | null
  summary: string | null
  responseText: string | null
  asset: {
    name: string
    path: string
    url: string
  } | null
  previewUrl?: string | null
}

type GeneratedImageResult = {
  historyId: string
  pendingId: string
  previewDataUrl: string
  revisedPrompt: string | null
  responseText: string
  source: {
    provider: string
    model: string
    mode: "LLM" | "REFERENCE_EDIT"
  }
}

type HistoryResponse = {
  ok?: boolean
  history?: AiHistoryEntry[]
  scope?: "company" | "personal"
  error?: string
}

type ImageResponse = {
  ok?: boolean
  image?: GeneratedImageResult | null
  saved?: {
    name: string
    path: string
    url: string | null
  } | null
  responseText?: string
  error?: string
}

type SavedImageResult = {
  name: string
  path: string
  url: string | null
}

type ReferenceImageDraft = {
  id: string
  file: File
  previewUrl: string
}

type AspectRatioOption = {
  id: string
  label: string
  size?: ImageSize
  dimensions: string
  hint: string
  active: boolean
}

type SamplePromptCard = {
  title: string
  eyebrow: string
  prompt: string
  hoverGuide: string
  previewUrl: string
}

const IMAGE_SIZE_OPTIONS: Array<{ value: ImageSize; label: string; hint: string }> = [
  { value: "1024x1024", label: "Cuadrada 1024x1024", hint: "Ideal para logos, mockups simples y piezas de redes." },
  { value: "1024x1536", label: "Vertical 1024x1536", hint: "Mejor para afiches, portadas y piezas publicitarias altas." },
  { value: "1536x1024", label: "Horizontal 1536x1024", hint: "Útil para banners, cabeceras y escenas panorámicas." },
  { value: "1024x768", label: "4:3 1024x768", hint: "Útil para catálogos, presentaciones y layouts más clásicos." },
  { value: "1536x864", label: "16:9 1536x864", hint: "Pensado para hero banners, pantallas y cabeceras anchas." },
  { value: "864x1536", label: "9:16 864x1536", hint: "Ideal para historias, reels y piezas verticales de alto impacto." },
]

const IMAGE_QUALITY_OPTIONS: Array<{ value: ImageQuality; label: string; hint: string }> = [
  { value: "low", label: "Baja", hint: "Borrador rápido y costo menor." },
  { value: "medium", label: "Media", hint: "Balance recomendado para trabajo diario." },
  { value: "high", label: "Alta", hint: "Más detalle, pero mayor costo por intento." },
  { value: "auto", label: "Auto", hint: "Deja que el proveedor ajuste calidad según el caso." },
]

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: "1:1", label: "1:1", size: "1024x1024", dimensions: "1024 x 1024", hint: "Logos, mockups simples y piezas cuadradas.", active: true },
  { id: "16:9", label: "16:9", size: "1536x864", dimensions: "1536 x 864", hint: "Para cabeceras panorámicas, pantallas y layouts hero.", active: true },
  { id: "3:2", label: "3:2", size: "1536x1024", dimensions: "1536 x 1024", hint: "Cabeceras, banners y escenas horizontales.", active: true },
  { id: "4:3", label: "4:3", size: "1024x768", dimensions: "1024 x 768", hint: "Equilibrado para catálogos, piezas institucionales y visuales de producto.", active: true },
  { id: "3:4", label: "3:4", dimensions: "Próximamente", hint: "Disponible cuando abramos resoluciones adicionales en el backend.", active: false },
  { id: "2:3", label: "2:3", size: "1024x1536", dimensions: "1024 x 1536", hint: "Portadas, posters y piezas altas.", active: true },
  { id: "9:16", label: "9:16", size: "864x1536", dimensions: "864 x 1536", hint: "Ideal para historias, reels y anuncios verticales.", active: true },
]

const PROMPT_RECOMMENDATIONS = [
  "Define la pieza final: logo, mockup, portada, banner, empaque o afiche.",
  "Aclara el lenguaje visual: minimalista, corporativo, realista, premium, editorial o infantil.",
  "Describe materiales, colores, restricciones y si la composición debe dejar espacio para texto.",
  "Si adjuntas referencias, explica qué debe conservar la IA: estilo, encuadre, producto, luz o jerarquía visual.",
]

const HISTORY_PAGE_SIZE = 5
const MAX_REFERENCE_IMAGES = 4

function buildSamplePreviewUrl(args: { title: string; accent: string; secondary: string; background: string; shape: "circle" | "poster" | "columns" | "card" }) {
  const artwork = (() => {
    if (args.shape === "circle") {
      return `
        <circle cx="150" cy="120" r="54" fill="${args.accent}" opacity="0.18" />
        <circle cx="150" cy="120" r="34" fill="none" stroke="${args.accent}" stroke-width="14" />
        <circle cx="188" cy="84" r="20" fill="${args.secondary}" opacity="0.92" />
      `
    }
    if (args.shape === "poster") {
      return `
        <rect x="90" y="40" width="120" height="180" rx="22" fill="${args.accent}" opacity="0.18" />
        <rect x="108" y="62" width="84" height="22" rx="11" fill="${args.secondary}" opacity="0.9" />
        <rect x="108" y="100" width="84" height="80" rx="18" fill="${args.accent}" opacity="0.6" />
      `
    }
    if (args.shape === "columns") {
      return `
        <rect x="54" y="48" width="64" height="166" rx="18" fill="${args.accent}" opacity="0.28" />
        <rect x="128" y="48" width="64" height="166" rx="18" fill="${args.secondary}" opacity="0.18" />
        <rect x="202" y="48" width="44" height="166" rx="18" fill="${args.accent}" opacity="0.18" />
      `
    }
    return `
      <rect x="54" y="64" width="192" height="116" rx="24" fill="${args.accent}" opacity="0.18" />
      <rect x="74" y="84" width="90" height="76" rx="18" fill="${args.secondary}" opacity="0.82" />
      <rect x="178" y="84" width="48" height="18" rx="9" fill="${args.accent}" opacity="0.8" />
      <rect x="178" y="114" width="48" height="46" rx="16" fill="${args.secondary}" opacity="0.45" />
    `
  })()

  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 260">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${args.background}" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="300" height="260" rx="28" fill="url(#bg)" />
      <rect x="16" y="16" width="268" height="228" rx="24" fill="#ffffff" opacity="0.88" />
      ${artwork}
      <text x="34" y="214" font-size="14" font-family="Arial, sans-serif" fill="#0f172a">${args.title}</text>
      <text x="34" y="234" font-size="11" font-family="Arial, sans-serif" fill="#64748b">Referencia visual</text>
    </svg>
  `)}`
}

const SAMPLE_PROMPTS: SamplePromptCard[] = [
  {
    title: "Logo corporativo",
    eyebrow: "Marca limpia",
    prompt:
      "Logo profesional para clínica veterinaria, símbolo geométrico con huella y cruz médica integradas, colores verde esmeralda y azul petróleo, tipografía sans serif moderna, composición limpia, fondo blanco, estilo corporativo premium, vectorial, sin caricatura, alta legibilidad para impresión y redes.",
    hoverGuide: "Describe símbolo, tipografía, paleta, restricciones y destino de impresión para que la IA replique la lógica visual, no solo el color.",
    previewUrl: buildSamplePreviewUrl({ title: "Logo corporativo", accent: "#007c63", secondary: "#0f4c81", background: "#d7f7eb", shape: "circle" }),
  },
  {
    title: "Brochure institucional",
    eyebrow: "Editorial comercial",
    prompt:
      "Brochure tríptico corporativo para empresa de tecnología, portada elegante con fotografía realista de equipo en oficina moderna, paleta azul marino y cian, diagramación editorial con amplios espacios en blanco, estilo premium, iluminación natural, enfoque comercial, listo como referencia visual para impresión litográfica.",
    hoverGuide: "Si tomas una referencia similar, pide diagramación editorial, fotografía realista, paleta y sensación premium para conservar el tono de brochure.",
    previewUrl: buildSamplePreviewUrl({ title: "Brochure institucional", accent: "#125b9a", secondary: "#17a2b8", background: "#dcedfb", shape: "columns" }),
  },
  {
    title: "Poster promocional",
    eyebrow: "Impacto vertical",
    prompt:
      "Afiche publicitario vertical para lanzamiento de evento empresarial, composición impactante con titular protagonista, fondo con degradado sobrio azul y dorado, fotografía realista del producto o servicio en primer plano, estilo moderno y premium, jerarquía visual clara, acabado de alta calidad pensado para impresión gran formato.",
    hoverGuide: "Aclara jerarquía visual, protagonista, degradado, sensación premium y uso final en gran formato para acercarte a este resultado.",
    previewUrl: buildSamplePreviewUrl({ title: "Poster promocional", accent: "#0b4f8a", secondary: "#d6a742", background: "#eef4ff", shape: "poster" }),
  },
  {
    title: "Flyer comercial",
    eyebrow: "Oferta retail",
    prompt:
      "Flyer publicitario tamaño carta para promoción de apertura, diseño limpio y persuasivo, imagen principal realista del producto, bloques de información bien separados, colores corporativos rojo vino y crema, tipografía moderna, estilo retail premium, espacio para llamado a la acción y datos de contacto, optimizado para litografía.",
    hoverGuide: "Con una referencia de flyer similar, especifica bloques de información, color dominante, fotografía principal y CTA para replicar el equilibrio comercial.",
    previewUrl: buildSamplePreviewUrl({ title: "Flyer comercial", accent: "#8b1e3f", secondary: "#d8b58c", background: "#fff3ec", shape: "card" }),
  },
]

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function truncatePrompt(value: string, size = 120) {
  const normalized = value.trim()
  if (normalized.length <= size) return normalized
  return `${normalized.slice(0, size).trimEnd()}...`
}

function getHistoryPreviewUrl(entry: AiHistoryEntry) {
  return entry.previewUrl || entry.asset?.url || ""
}

export function LitografiaAiImagesModule() {
  const [prompt, setPrompt] = useState("")
  const [imageQuality, setImageQuality] = useState<ImageQuality>("medium")
  const [imageSize, setImageSize] = useState<ImageSize>("1024x1024")
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<AiHistoryEntry[]>([])
  const [historyScope, setHistoryScope] = useState<"company" | "personal">("personal")
  const [selectedHistory, setSelectedHistory] = useState<AiHistoryEntry | null>(null)
  const [generatedImage, setGeneratedImage] = useState<GeneratedImageResult | null>(null)
  const [savedImage, setSavedImage] = useState<SavedImageResult | null>(null)
  const [lastGeneratedConfig, setLastGeneratedConfig] = useState<{ size: ImageSize; quality: ImageQuality } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generationModalOpen, setGenerationModalOpen] = useState(false)
  const [approvalLoading, setApprovalLoading] = useState(false)
  const [generationResponse, setGenerationResponse] = useState<string | null>(null)
  const [historyPreviewPage, setHistoryPreviewPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [sampleIndex, setSampleIndex] = useState(0)
  const [aspectDialogOpen, setAspectDialogOpen] = useState(false)
  const [useReferenceImages, setUseReferenceImages] = useState(false)
  const [referenceImages, setReferenceImages] = useState<ReferenceImageDraft[]>([])

  const referenceInputRef = useRef<HTMLInputElement | null>(null)
  const referenceImagesRef = useRef<ReferenceImageDraft[]>([])

  const historyCountLabel = useMemo(() => {
    if (historyLoading) return "Cargando historial..."
    if (!history.length) return "Sin consultas registradas"
    return `${history.length} registros recientes`
  }, [history, historyLoading])

  const selectedSizeLabel = IMAGE_SIZE_OPTIONS.find((option) => option.value === imageSize)?.label ?? imageSize
  const selectedAspectRatio = ASPECT_RATIO_OPTIONS.find((option) => option.size === imageSize && option.active) ?? ASPECT_RATIO_OPTIONS[0]
  const totalHistoryPreviewPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const previewHistory = useMemo(() => {
    const start = (historyPreviewPage - 1) * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, historyPreviewPage])
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE))
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE
    return history.slice(start, start + HISTORY_PAGE_SIZE)
  }, [history, historyPage])
  const currentSample = SAMPLE_PROMPTS[sampleIndex] ?? SAMPLE_PROMPTS[0]

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", { cache: "no-store" })
      const json = (await response.json().catch(() => null)) as HistoryResponse | null
      if (!response.ok || !json?.ok || !Array.isArray(json.history)) {
        throw new Error(json?.error || "No se pudo cargar el historial IA.")
      }
      setHistory(json.history)
      setHistoryScope(json.scope === "company" ? "company" : "personal")
      setHistoryPreviewPage(1)
      setHistoryPage(1)
    } catch (historyError) {
      setHistory([])
      setHistoryScope("personal")
      setError(historyError instanceof Error ? historyError.message : "No se pudo cargar el historial IA.")
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadHistory()
  }, [])

  useEffect(() => {
    referenceImagesRef.current = referenceImages
  }, [referenceImages])

  useEffect(() => {
    return () => {
      referenceImagesRef.current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl))
    }
  }, [])

  useEffect(() => {
    if (historyPreviewPage > totalHistoryPreviewPages) {
      setHistoryPreviewPage(totalHistoryPreviewPages)
    }
  }, [historyPreviewPage, totalHistoryPreviewPages])

  useEffect(() => {
    if (historyPage > totalHistoryPages) {
      setHistoryPage(totalHistoryPages)
    }
  }, [historyPage, totalHistoryPages])

  useEffect(() => {
    if (!historyOpen) return
    if (selectedHistory && paginatedHistory.some((entry) => entry.id === selectedHistory.id)) return
    setSelectedHistory(paginatedHistory[0] ?? null)
  }, [historyOpen, paginatedHistory, selectedHistory])

  const openHistoryEntry = (entry: AiHistoryEntry) => {
    const index = history.findIndex((item) => item.id === entry.id)
    if (index >= 0) {
      setHistoryPage(Math.floor(index / HISTORY_PAGE_SIZE) + 1)
    }
    setSelectedHistory(entry)
    setHistoryOpen(true)
  }

  const clearReferenceImages = () => {
    setReferenceImages((current) => {
      current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl))
      return []
    })
    if (referenceInputRef.current) referenceInputRef.current.value = ""
  }

  const removeReferenceImage = (id: string) => {
    setReferenceImages((current) => {
      const target = current.find((entry) => entry.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((entry) => entry.id !== id)
    })
    if (referenceInputRef.current) referenceInputRef.current.value = ""
  }

  const handleReferenceFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return

    setError(null)
    const current = referenceImagesRef.current
    const availableSlots = Math.max(0, MAX_REFERENCE_IMAGES - current.length)
    if (!availableSlots) return

    const nextItems = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, availableSlots)
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }))

    setReferenceImages((existing) => [...existing, ...nextItems])
    setUseReferenceImages(true)
  }

  const handleGenerateImage = async () => {
    setGenerationModalOpen(true)
    setLoading(true)
    setApprovalLoading(false)
    setError(null)
    setGenerationResponse(null)
    setSavedImage(null)
    try {
      const response = referenceImages.length > 0
        ? await (async () => {
            const body = new FormData()
            body.append("action", "generate")
            body.append("prompt", prompt.trim())
            body.append("size", imageSize)
            body.append("quality", imageQuality)
            referenceImages.forEach((item) => body.append("images", item.file))
            return fetch("/api/litografia/ia/imagenes", { method: "POST", body })
          })()
        : await fetch("/api/litografia/ia/imagenes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "generate", prompt: prompt.trim(), size: imageSize, quality: imageQuality }),
          })

      const json = (await response.json().catch(() => null)) as ImageResponse | null
      if (!response.ok || !json?.ok || !json.image) {
        throw new Error(json?.error || "No fue posible generar la imagen.")
      }

      setGeneratedImage(json.image)
      setGenerationResponse(json.image.responseText)
      setLastGeneratedConfig({ size: imageSize, quality: imageQuality })
    } catch (imageError) {
      setGeneratedImage(null)
      setError(imageError instanceof Error ? imageError.message : "Error generando la imagen.")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveSave = async () => {
    if (!generatedImage) return
    setApprovalLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/litografia/ia/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", pendingId: generatedImage.pendingId, historyId: generatedImage.historyId }),
      })

      const json = (await response.json().catch(() => null)) as ImageResponse | null
      if (!response.ok || !json?.ok || !json.saved) {
        throw new Error(json?.error || "No fue posible guardar la imagen en el administrador de archivos.")
      }

      setSavedImage(json.saved)
      setGenerationResponse(json.responseText || "Imagen aprobada y guardada correctamente.")
      await loadHistory()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar la imagen.")
    } finally {
      setApprovalLoading(false)
    }
  }

  const handleDownloadGenerated = () => {
    if (!generatedImage) return
    const anchor = document.createElement("a")
    anchor.href = generatedImage.previewDataUrl
    anchor.download = `${prompt.trim().slice(0, 48).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "imagen-ia"}.png`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  const handleRetryFromModal = async () => {
    setGeneratedImage(null)
    setSavedImage(null)
    await handleGenerateImage()
  }

  const applyAspectRatio = (option: AspectRatioOption) => {
    if (!option.active || !option.size) return
    setImageSize(option.size)
    setAspectDialogOpen(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Imágenes IA para litografía</h1>
          <p className="text-muted-foreground dark:text-white">Genera una vista previa, compárala con referencias visuales y guarda el resultado final directo en archivos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-2xl dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
            <Link href="/dashboard/crm/archivos?path=ia%2Fchatgpt-imagenes">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir carpeta guardada
            </Link>
          </Button>
          <Button type="button" variant="outline" className="rounded-2xl dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" />
            Ver historial de consultas
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-800 dark:bg-[#0f1728] dark:text-white">
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="rounded-[32px] border border-slate-900/10 bg-[radial-gradient(circle_at_top_left,_rgba(49,46,129,0.18),_transparent_34%),linear-gradient(135deg,#151821_0%,#111827_55%,#18212f_100%)] p-4 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
                  <Sparkles className="h-3.5 w-3.5" />
                  Generador visual
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Escribe el prompt como si fuera una dirección de arte</h2>
                  <p className="mt-1 max-w-3xl text-sm text-white/70">Puedes trabajar solo con texto o sumar una o varias imágenes de referencia para que la IA tome forma, estilo, producto o composición como punto de partida.</p>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-white/80">
                <p className="text-xs uppercase tracking-[0.18em] text-white/50">Salida activa</p>
                <p className="mt-2 font-medium text-white">{selectedAspectRatio.label} · {selectedSizeLabel}</p>
                <p className="mt-1 text-xs text-white/55">{IMAGE_QUALITY_OPTIONS.find((option) => option.value === imageQuality)?.label} calidad</p>
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-black/25 p-3 shadow-inner backdrop-blur sm:p-4">
              <Label htmlFor="litografia-ai-images-prompt" className="sr-only">Prompt para imagen</Label>
              <Textarea
                id="litografia-ai-images-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-40 resize-none border-0 bg-transparent px-1 py-2 text-base text-white shadow-none placeholder:text-white/35 focus-visible:ring-0"
                placeholder="Describe tu imagen como un director de arte: pieza, estilo, composición, color, material, atmósfera y objetivo final de impresión."
              />

              {useReferenceImages ? (
                <div className="mt-3 rounded-3xl border border-white/10 bg-white/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">Imágenes de referencia</p>
                      <p className="text-xs text-white/60">Con la integración actual se pueden enviar hasta {MAX_REFERENCE_IMAGES} referencias junto al prompt. El backend cambia automáticamente a edición por referencias cuando adjuntas imágenes.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {referenceImages.length ? (
                        <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={clearReferenceImages}>
                          <X className="mr-2 h-4 w-4" />
                          Limpiar
                        </Button>
                      ) : null}
                      <Button type="button" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => referenceInputRef.current?.click()} disabled={referenceImages.length >= MAX_REFERENCE_IMAGES}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir referencias
                      </Button>
                      <input
                        ref={referenceInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        multiple
                        className="hidden"
                        onChange={(event) => handleReferenceFiles(event.target.files)}
                      />
                    </div>
                  </div>

                  {referenceImages.length ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {referenceImages.map((entry) => (
                        <div key={entry.id} className="overflow-hidden rounded-3xl border border-white/10 bg-black/25">
                          <div className="aspect-[4/3] overflow-hidden bg-black/30">
                            <img src={entry.previewUrl} alt={entry.file.name} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex items-start justify-between gap-3 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{entry.file.name}</p>
                              <p className="text-xs text-white/55">{Math.max(1, Math.round(entry.file.size / 1024))} KB</p>
                            </div>
                            <button type="button" onClick={() => removeReferenceImage(entry.id)} className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-3xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-sm text-white/55">
                      Adjunta una o varias imágenes si quieres que la IA preserve producto, ángulo, luz, estilo o estructura general.
                    </div>
                  )}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                  <Button type="button" variant="outline" className="rounded-full border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setAspectDialogOpen(true)}>
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Relación {selectedAspectRatio.label}
                  </Button>
                  <div className="min-w-[12rem]">
                    <Select value={imageQuality} onValueChange={(value) => setImageQuality(value as ImageQuality)}>
                      <SelectTrigger className="rounded-full border-white/15 bg-white/5 text-white">
                        <SelectValue placeholder="Calidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {IMAGE_QUALITY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                    {referenceImages.length ? `${referenceImages.length} referencia${referenceImages.length === 1 ? '' : 's'} activa${referenceImages.length === 1 ? '' : 's'}` : "Solo prompt"}
                  </div>
                </div>

                <Button type="button" onClick={handleGenerateImage} disabled={loading || prompt.trim().length < 12} className="rounded-full bg-[#2b7fff] px-6 text-white hover:bg-[#1f6deb]">
                  {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                  Generar imagen
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-start gap-3 text-xs text-white/60">
              <div className="inline-flex max-w-xl items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{IMAGE_QUALITY_OPTIONS.find((option) => option.value === imageQuality)?.hint}</span>
              </div>
              <div className="inline-flex max-w-xl items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{IMAGE_SIZE_OPTIONS.find((option) => option.value === imageSize)?.hint}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fffb_100%)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Carrusel de referencias de muestra</p>
                  <p className="text-sm text-slate-600">Primero ves una referencia visual. Al pasar el cursor aparece cómo pedir una imagen similar y puedes usar el prompt base.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => setSampleIndex((current) => (current - 1 + SAMPLE_PROMPTS.length) % SAMPLE_PROMPTS.length)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => setSampleIndex((current) => (current + 1) % SAMPLE_PROMPTS.length)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 group relative overflow-hidden rounded-[28px] border border-emerald-200 bg-white shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
                  <div className="relative min-h-[22rem] overflow-hidden bg-slate-100">
                    <img src={currentSample.previewUrl} alt={currentSample.title} className="h-full w-full object-cover" />
                    <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">{currentSample.eyebrow}</div>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(15,23,42,0.72)_100%)]" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-lg font-semibold">{currentSample.title}</p>
                      <p className="mt-2 max-w-md text-sm text-white/75">Usa esta referencia como guía visual de composición y tono. El hover te muestra la instrucción útil para recrearla.</p>
                    </div>
                  </div>

                  <div className="relative flex min-h-[22rem] flex-col justify-between bg-slate-950 p-5 text-white">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Hover para aprender</p>
                      <p className="mt-3 text-base text-white/80">Pasa el cursor sobre esta tarjeta para ver la guía que explica cómo pedir una imagen similar sin copiar la referencia literalmente.</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 transition duration-200 group-hover:opacity-0">
                      <p className="text-sm font-medium text-white">Vista rápida</p>
                      <p className="mt-2 text-sm text-white/65">{truncatePrompt(currentSample.prompt, 180)}</p>
                    </div>
                    <div className="absolute inset-0 flex flex-col justify-between bg-[linear-gradient(180deg,rgba(8,47,73,0.95)_0%,rgba(15,23,42,0.98)_100%)] p-5 opacity-0 transition duration-200 group-hover:opacity-100">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Cómo crear algo similar</p>
                        <p className="mt-3 text-sm leading-6 text-white/85">{currentSample.hoverGuide}</p>
                        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
                          {currentSample.prompt}
                        </div>
                      </div>
                      <Button type="button" className="self-start rounded-full bg-white text-slate-950 hover:bg-slate-200" onClick={() => setPrompt(currentSample.prompt)}>
                        Usar prompt de muestra
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {SAMPLE_PROMPTS.map((sample, index) => (
                  <button
                    key={sample.title}
                    type="button"
                    onClick={() => setSampleIndex(index)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${index === sampleIndex ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-white text-emerald-900 hover:bg-emerald-50"}`}
                  >
                    {sample.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Cómo pedir mejores imágenes y reducir intentos</p>
                <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-white/80">
                  {PROMPT_RECOMMENDATIONS.map((recommendation) => (
                    <p key={recommendation}>{recommendation}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 shadow-sm">
                <p className="font-semibold">Referencias con OpenAI</p>
                <p className="mt-2">Sí es posible con la integración actual: cuando subes una o varias imágenes, el módulo deja de usar generación desde cero y llama al flujo de edición por referencias del proveedor.</p>
                <p className="mt-2">En esta primera versión quedan soportadas hasta {MAX_REFERENCE_IMAGES} imágenes de referencia en la misma solicitud.</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground dark:text-white">{historyCountLabel}</p>
              </div>
            </div>
          </div>

          {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

          {savedImage ? (
            <div className="space-y-3 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                <img src={generatedImage?.previewDataUrl || savedImage.url || ""} alt="Imagen generada con IA" className="max-h-[28rem] w-full object-contain" />
              </div>
              {lastGeneratedConfig ? (
                <p className="text-sm text-slate-700">
                  Configuración usada: {lastGeneratedConfig.quality} · {IMAGE_SIZE_OPTIONS.find((option) => option.value === lastGeneratedConfig.size)?.label ?? lastGeneratedConfig.size}
                </p>
              ) : null}
              {generationResponse ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{generationResponse}</p> : null}
              {generatedImage?.revisedPrompt ? <p className="text-sm text-slate-700">Prompt revisado: {generatedImage.revisedPrompt}</p> : null}
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                <span>Guardada en: {savedImage.path}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/chatgpt-imagenes")}&preview=${encodeURIComponent(savedImage.path)}`}>
                    Ver en administrador
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-[#0f1728] dark:text-white">
        <CardHeader>
          <CardTitle className="text-lg dark:text-white">{historyScope === "company" ? "Últimas consultas del equipo" : "Tus últimas consultas"}</CardTitle>
          <CardDescription className="dark:text-white">{historyScope === "company" ? "Solo se muestran generaciones de imagen. Mantén 5 visibles y navega por páginas sin mezclar consultas del cotizador." : "Solo se muestran tus generaciones de imagen recientes, en bloques de 5 visibles."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {historyLoading ? <p className="text-sm text-muted-foreground dark:text-white">Cargando historial...</p> : null}
          {!historyLoading && !history.length ? <p className="text-sm text-muted-foreground dark:text-white">Aún no hay actividad IA registrada.</p> : null}
          {previewHistory.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => openHistoryEntry(entry)}
              className="w-full rounded-2xl border border-slate-200 p-3 text-left text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/10">
                  {getHistoryPreviewUrl(entry) ? (
                    <img src={getHistoryPreviewUrl(entry)} alt="Miniatura de imagen generada" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-slate-400 dark:text-white/45" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-900 dark:text-white">Imagen generada</p>
                    <span className="text-xs text-slate-500 dark:text-white">{formatDate(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2">{entry.prompt}</p>
                  {entry.asset?.path ? <p className="mt-2 text-xs text-slate-500 dark:text-white">Archivo: {entry.asset.path}</p> : null}
                </div>
              </div>
            </button>
          ))}
          {history.length > HISTORY_PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white">
              <span className="text-slate-500 dark:text-white">Página {historyPreviewPage} de {totalHistoryPreviewPages}</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPreviewPage((current) => Math.max(1, current - 1))} disabled={historyPreviewPage === 1}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Anterior
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPreviewPage((current) => Math.min(totalHistoryPreviewPages, current + 1))} disabled={historyPreviewPage === totalHistoryPreviewPages}>
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={aspectDialogOpen} onOpenChange={setAspectDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200 p-0 overflow-hidden">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
            <DialogTitle>Relación de aspecto</DialogTitle>
            <p className="text-sm text-slate-500">El selector visual queda desacoplado del tamaño final. Por ahora activamos las relaciones soportadas por el backend actual.</p>
          </DialogHeader>
          <div className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {ASPECT_RATIO_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => applyAspectRatio(option)}
                disabled={!option.active}
                className={`rounded-[24px] border p-4 text-left transition ${option.size === imageSize ? "border-slate-900 bg-slate-950 text-white" : option.active ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50" : "border-slate-200 bg-slate-50 text-slate-400"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{option.label}</p>
                    <p className={`mt-1 text-xs ${option.size === imageSize ? "text-white/65" : option.active ? "text-slate-500" : "text-slate-400"}`}>{option.dimensions}</p>
                  </div>
                  {!option.active ? <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pronto</span> : null}
                </div>
                <div className={`mt-4 overflow-hidden rounded-2xl border ${option.size === imageSize ? "border-white/10 bg-white/5" : option.active ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-center p-4">
                    <div
                      className="border"
                      style={{
                        width: option.label === "1:1" ? 80 : option.label === "2:3" ? 58 : option.label === "3:2" ? 92 : option.label === "16:9" ? 104 : option.label === "9:16" ? 46 : option.label === "4:3" ? 88 : 66,
                        height: option.label === "1:1" ? 80 : option.label === "2:3" ? 87 : option.label === "3:2" ? 61 : option.label === "16:9" ? 58 : option.label === "9:16" ? 82 : option.label === "4:3" ? 66 : 88,
                        borderRadius: 16,
                        borderColor: option.size === imageSize ? "rgba(255,255,255,0.25)" : option.active ? "#cbd5e1" : "#e2e8f0",
                        backgroundColor: option.size === imageSize ? "rgba(255,255,255,0.08)" : option.active ? "#ffffff" : "#f8fafc",
                      }}
                    />
                  </div>
                </div>
                <p className={`mt-3 text-xs leading-5 ${option.size === imageSize ? "text-white/70" : option.active ? "text-slate-600" : "text-slate-400"}`}>{option.hint}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{historyScope === "company" ? "Historial general de imágenes IA" : "Tu historial de imágenes IA"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {paginatedHistory.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedHistory(entry)}
                  className={`w-full rounded-xl border p-3 text-left text-sm transition ${selectedHistory?.id === entry.id ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {getHistoryPreviewUrl(entry) ? (
                        <img src={getHistoryPreviewUrl(entry)} alt="Miniatura del historial" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-slate-900">Imagen generada</p>
                        <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-3 text-slate-700">{entry.prompt}</p>
                      {entry.actorLabel ? <p className="mt-2 text-xs text-slate-500">Usuario: {entry.actorLabel}</p> : null}
                    </div>
                  </div>
                </button>
              ))}
              {history.length > HISTORY_PAGE_SIZE ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <span className="text-slate-500">Página {historyPage} de {totalHistoryPages}</span>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} disabled={historyPage === 1}>
                      Anterior
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))} disabled={historyPage === totalHistoryPages}>
                      Siguiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {!selectedHistory ? <p className="text-sm text-slate-500">Selecciona un registro para revisar la consulta item por item.</p> : (
                <div className="space-y-4 text-sm text-slate-700">
                  {getHistoryPreviewUrl(selectedHistory) ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <img src={getHistoryPreviewUrl(selectedHistory)} alt="Vista previa del historial" className="max-h-[22rem] w-full object-contain" />
                    </div>
                  ) : null}
                  <div>
                    <p className="font-medium text-slate-900">Tipo</p>
                    <p>Generación de imagen</p>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Fecha</p>
                    <p>{formatDate(selectedHistory.createdAt)}</p>
                  </div>
                  {selectedHistory.actorLabel ? (
                    <div>
                      <p className="font-medium text-slate-900">Usuario</p>
                      <p>{selectedHistory.actorLabel}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="font-medium text-slate-900">Prompt</p>
                    <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.prompt}</p>
                  </div>
                  {selectedHistory.summary ? (
                    <div>
                      <p className="font-medium text-slate-900">Resumen</p>
                      <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.summary}</p>
                    </div>
                  ) : null}
                  {selectedHistory.responseText ? (
                    <div>
                      <p className="font-medium text-slate-900">Respuesta</p>
                      <p className="whitespace-pre-line rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.responseText}</p>
                    </div>
                  ) : null}
                  {selectedHistory.asset?.path ? (
                    <div className="space-y-2">
                      <p className="font-medium text-slate-900">Archivo asociado</p>
                      <p className="rounded-xl border border-slate-200 bg-white p-3">{selectedHistory.asset.path}</p>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/chatgpt-imagenes")}&preview=${encodeURIComponent(selectedHistory.asset.path)}`}>
                          Abrir en administrador de archivos
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={generationModalOpen}
        onOpenChange={(open) => {
          if (loading || approvalLoading) return
          setGenerationModalOpen(open)
        }}
      >
        <DialogContent hideClose={loading || approvalLoading} className="max-h-[92vh] max-w-6xl overflow-hidden border-slate-800 bg-slate-950 text-white">
          <DialogHeader className="space-y-2 border-b border-slate-800 pb-4 text-left">
            <DialogTitle className="text-xl text-white">{loading ? "Generando imagen" : savedImage ? "Imagen lista y guardada" : "Revisión de imagen generada"}</DialogTitle>
            <p className="text-sm text-slate-300">
              {loading
                ? "Estamos procesando tu prompt con IA. Cuando termine verás la vista previa aquí mismo antes de guardarla."
                : generationResponse || "Revisa el resultado, descárgalo si quieres y apruébalo para guardarlo en archivos."}
            </p>
          </DialogHeader>

          <div className="overflow-y-auto py-4">
            {loading ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 rounded-3xl border border-slate-800 bg-black/40 px-6 text-center">
                <LoaderCircle className="h-14 w-14 animate-spin text-white" />
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-white">Generando imagen...</p>
                  <p className="max-w-2xl text-sm text-slate-300">La pantalla queda en foco sobre el resultado. No se guardará nada hasta que la apruebes.</p>
                </div>
              </div>
            ) : generatedImage ? (
              <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                  <div className="overflow-hidden rounded-3xl border border-slate-800 bg-white p-3">
                    <img src={generatedImage.previewDataUrl} alt="Vista previa de imagen IA" className="max-h-[68vh] w-full rounded-2xl object-contain" />
                  </div>
                  <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-200">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Origen de la respuesta</p>
                      <p className="mt-2 text-base font-medium text-white">{generatedImage.source.mode === "REFERENCE_EDIT" ? "IA con referencias" : "IA desde prompt"}</p>
                      <p className="mt-1">Proveedor: {generatedImage.source.provider}</p>
                      <p>Modelo: {generatedImage.source.model}</p>
                    </div>

                    {lastGeneratedConfig ? (
                      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Configuración usada</p>
                        <p className="mt-2 text-white">{IMAGE_QUALITY_OPTIONS.find((option) => option.value === lastGeneratedConfig.quality)?.label} · {IMAGE_SIZE_OPTIONS.find((option) => option.value === lastGeneratedConfig.size)?.label}</p>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Respuesta concreta</p>
                      <p className="mt-2 whitespace-pre-line text-slate-100">{generationResponse}</p>
                    </div>

                    {generatedImage.revisedPrompt ? (
                      <div className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Prompt revisado</p>
                        <p className="mt-2 whitespace-pre-line text-slate-100">{generatedImage.revisedPrompt}</p>
                      </div>
                    ) : null}

                    {savedImage ? (
                      <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-50">
                        <p className="font-medium">Guardada correctamente</p>
                        <p className="mt-1 text-sm">Ruta: {savedImage.path}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-black/30 px-6 text-center text-sm text-slate-400">
                No se pudo preparar una vista previa. Ajusta el prompt y vuelve a intentarlo.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-800 pt-4 sm:justify-between sm:space-x-0">
            <div className="flex flex-wrap gap-2">
              {generatedImage ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={handleDownloadGenerated} disabled={loading || approvalLoading}>
                  <Download className="mr-2 h-4 w-4" />
                  Descargar
                </Button>
              ) : null}
              {savedImage ? (
                <Button asChild type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <Link href={`/dashboard/crm/archivos?path=${encodeURIComponent("IA/chatgpt-imagenes")}&preview=${encodeURIComponent(savedImage.path)}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir en archivos
                  </Link>
                </Button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setGenerationModalOpen(false)} disabled={loading || approvalLoading}>
                Cerrar
              </Button>
              {generatedImage && !savedImage ? (
                <Button type="button" variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800" onClick={() => void handleRetryFromModal()} disabled={loading || approvalLoading}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Volver a intentarlo
                </Button>
              ) : null}
              {generatedImage && !savedImage ? (
                <Button type="button" className="bg-white text-slate-950 hover:bg-slate-200" onClick={handleApproveSave} disabled={loading || approvalLoading}>
                  {approvalLoading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Aprobar para guardar
                </Button>
              ) : null}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}