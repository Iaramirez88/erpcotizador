import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { isSuperAdminEmail } from '@/lib/super-admin'
import { revalidatePath } from 'next/cache'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ErpPageHero } from '@/components/dashboard/erp-page-chrome'

type SearchParams = Record<string, string | string[] | undefined>

type HelpVideoRow = {
  id: string
  title: string
  embedUrl: string
  createdAt: Date
}

function safeDocName(value: unknown, available: string[]): string | null {
  if (typeof value !== 'string' || !value) return null
  if (value.includes('/') || value.includes('\\')) return null
  return available.includes(value) ? value : null
}

function youtubeToEmbedUrl(inputUrl: string): string | null {
  const raw = inputUrl.trim()
  if (!raw) return null

  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, '').toLowerCase()

    // Already an embed URL
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname.startsWith('/embed/')) {
        return `https://www.youtube.com${u.pathname}`
      }

      // watch?v=ID
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v')
        if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`
      }

      // shorts/ID
      const shorts = u.pathname.match(/^\/shorts\/([^/?#]+)/)
      if (shorts?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(shorts[1])}`
    }

    // youtu.be/ID
    if (host === 'youtu.be') {
      const id = u.pathname.replace('/', '')
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`
    }

    return null
  } catch {
    return null
  }
}

export default async function AyudaPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const isSuperAdmin = isSuperAdminEmail(session.user.email)

  const helpVideoDelegate = (prisma as unknown as { helpVideo?: any }).helpVideo

  const docsDir = path.join(process.cwd(), 'public', 'docs')
  let pdfs: string[] = []
  try {
    const entries = await fs.readdir(docsDir, { withFileTypes: true })
    pdfs = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    pdfs = []
  }

  const selected = safeDocName(searchParams?.doc, pdfs)
  const selectedUrl = selected ? `/docs/${encodeURIComponent(selected)}` : null

  if (helpVideoDelegate && isSuperAdmin) {
    const existingVideos = await helpVideoDelegate.count()
    if (existingVideos === 0) {
      await helpVideoDelegate.create({
        data: {
          title: 'Video de prueba (YouTube)',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          createdById: session.user.id,
        },
      })
    }
  }

  const videos: HelpVideoRow[] = helpVideoDelegate
    ? await helpVideoDelegate.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, title: true, embedUrl: true, createdAt: true },
      })
    : []

  async function addVideo(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2?.user) redirect('/auth/login')
    if (!isSuperAdminEmail(session2.user.email)) redirect('/dashboard/ayuda')

    const helpVideoDelegate2 = (prisma as unknown as { helpVideo?: any }).helpVideo
    if (!helpVideoDelegate2) redirect('/dashboard/ayuda?error=video')

    const title = String(formData.get('title') ?? '').trim() || 'Video'
    const url = String(formData.get('url') ?? '').trim()
    const embedUrl = youtubeToEmbedUrl(url)
    if (!embedUrl) redirect('/dashboard/ayuda?error=video')

    await helpVideoDelegate2.create({
      data: {
        title,
        url,
        embedUrl,
        createdById: session2.user.id,
      },
    })

    revalidatePath('/dashboard/ayuda')
  }

  async function deleteVideo(formData: FormData) {
    'use server'
    const session2 = await auth()
    if (!session2?.user) redirect('/auth/login')
    if (!isSuperAdminEmail(session2.user.email)) redirect('/dashboard/ayuda')

    const helpVideoDelegate2 = (prisma as unknown as { helpVideo?: any }).helpVideo
    if (!helpVideoDelegate2) redirect('/dashboard/ayuda?error=video')

    const id = String(formData.get('id') ?? '').trim()
    if (!id) redirect('/dashboard/ayuda?error=video')

    await helpVideoDelegate2.delete({ where: { id } })
    revalidatePath('/dashboard/ayuda')
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4">
      <ErpPageHero
        eyebrow="ERP soporte"
        title="Ayuda"
        description="Tutoriales, documentación y videos para el equipo en una estructura más clara y mantenible."
        stats={[
          { label: 'PDFs', value: pdfs.length, hint: 'Documentos disponibles', tone: 'neutral' },
          { label: 'Videos', value: videos.length, hint: isSuperAdmin ? 'Editable por super admin' : 'Biblioteca visible', tone: 'sky' },
          { label: 'Vista previa', value: selected || 'Sin selección', hint: 'Documento activo', tone: 'amber' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Tutoriales</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/perfil">Perfil y seguridad</Link>
              <div className="text-xs text-muted-foreground">Actualiza tus datos y revisa tu acceso.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/notificaciones">Centro de notificaciones</Link>
              <div className="text-xs text-muted-foreground">Lee, archiva y gestiona avisos del sistema.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/reportes">Reportes básicos</Link>
              <div className="text-xs text-muted-foreground">Consulta indicadores y exportaciones comunes.</div>
            </div>
            <div>
              <Link className="text-sky-600 hover:underline" href="/dashboard/configuracion/usuarios">Usuarios, roles y permisos</Link>
              <div className="text-xs text-muted-foreground">Administra el acceso por sede y por módulo.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Documentación (PDF)</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 text-sm">
            {pdfs.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                No hay PDFs cargados. Agrega archivos a <span className="font-mono">public/docs</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {pdfs.map((name) => {
                  const href = `/dashboard/ayuda?doc=${encodeURIComponent(name)}`
                  return (
                    <div key={name} className="flex items-center justify-between gap-2">
                      <Link className="text-sky-600 hover:underline" href={href}>
                        {name}
                      </Link>
                      <a className="text-xs text-sky-600 hover:underline" href={`/docs/${encodeURIComponent(name)}`} download>
                        Descargar
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Videos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {isSuperAdmin ? (
            <form action={addVideo} className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input name="title" placeholder="Título (opcional)" />
              <Input name="url" placeholder="URL de YouTube" required />
              <Button type="submit">Agregar</Button>
            </form>
          ) : null}

          {videos.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aún no hay videos.</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {videos.map((v: HelpVideoRow) => (
                <div key={v.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium">{v.title}</div>
                    {isSuperAdmin ? (
                      <form action={deleteVideo}>
                        <input type="hidden" name="id" value={v.id} />
                        <Button type="submit" variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                          Borrar
                        </Button>
                      </form>
                    ) : null}
                  </div>
                  <iframe
                    title={v.title}
                    src={v.embedUrl}
                    className="w-full aspect-video border rounded"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUrl ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Vista previa: {selected}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-end gap-2 pb-3">
              <a className="text-sm text-sky-600 hover:underline" href={selectedUrl} download>
                Descargar
              </a>
              <a className="text-sm text-sky-600 hover:underline" href={selectedUrl} target="_blank" rel="noreferrer">
                Abrir en otra pestaña
              </a>
            </div>
            <iframe title={`PDF ${selected}`} src={selectedUrl} className="w-full h-[70vh] border rounded" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
