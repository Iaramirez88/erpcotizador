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
    case '.pdf':
      return 'application/pdf'
    case '.txt':
      return 'text/plain; charset=utf-8'
    case '.csv':
      return 'text/csv; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.mp3':
      return 'audio/mpeg'
    case '.wav':
      return 'audio/wav'
    case '.ogg':
      return 'audio/ogg'
    case '.m4a':
      return 'audio/mp4'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.mov':
      return 'video/quicktime'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.xls':
      return 'application/vnd.ms-excel'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    case '.ppt':
      return 'application/vnd.ms-powerpoint'
    case '.pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case '.zip':
      return 'application/zip'
    default:
      return 'application/octet-stream'
  }
}

function isSafePathSegment(seg: string): boolean {
  if (!seg) return false
  if (seg === '.' || seg === '..') return false
  if (seg.includes('\\')) return false
  if (seg.includes('\u0000')) return false
  return true
}

async function serve(parts: string[]) {
  if (!Array.isArray(parts) || parts.length === 0 || !parts.every((p) => isSafePathSegment(p))) {
    return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
  }

  const absPath = path.join(process.cwd(), 'public', 'uploads', ...parts)

  try {
    const bytes = await fs.readFile(absPath)
    const ext = path.extname(absPath)

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFromExt(ext),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-SG-Uploads': 'api',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404, headers: { 'X-SG-Uploads': 'api' } })
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  return serve(parts)
}

export async function HEAD(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params
  const resp = await serve(parts)
  return new NextResponse(null, { status: resp.status, headers: resp.headers })
}
