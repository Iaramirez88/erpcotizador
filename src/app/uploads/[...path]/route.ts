import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export const runtime = 'nodejs'

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

function isSafePathSegment(seg: string): boolean {
  // Bloquea traversal y segmentos raros
  if (!seg) return false
  if (seg === '.' || seg === '..') return false
  if (seg.includes('\\')) return false
  if (seg.includes('\u0000')) return false
  return true
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params

  if (!Array.isArray(parts) || parts.length === 0 || !parts.every((p) => isSafePathSegment(p))) {
    return new NextResponse('Not found', { status: 404 })
  }

  // Sirve desde /public/uploads
  const relPath = path.join('public', 'uploads', ...parts)
  const absPath = path.join(process.cwd(), relPath)

  try {
    const bytes = await fs.readFile(absPath)
    const ext = path.extname(absPath)

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFromExt(ext),
        // Las imágenes se nombran con timestamp y son inmutables en la práctica.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
