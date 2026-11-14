import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'
import { verifyCrmFileShareToken } from '@/lib/share-token'
import { getCrmFilesRootAbsolutePath } from '@/lib/crm-files'

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

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? ''
  const dispositionParam = request.nextUrl.searchParams.get('disposition') ?? ''
  const secret = process.env.SHARE_TOKEN_SECRET || process.env.NEXTAUTH_SECRET

  if (!secret) {
    return new NextResponse('Not available', { status: 503 })
  }

  const payload = verifyCrmFileShareToken(token, secret)
  if (!payload) {
    return new NextResponse('Enlace no válido o vencido', { status: 403 })
  }

  const segments = payload.filePath.split('/')
  if (!segments.length || !segments.every(isSafePathSegment)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const root = getCrmFilesRootAbsolutePath(payload.empresaId)
  const absPath = path.join(root, ...segments)

  const normalizedRoot = path.resolve(root)
  const normalizedPath = path.resolve(absPath)
  if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(normalizedRoot + path.sep)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const bytes = await fs.readFile(absPath)
    const ext = path.extname(absPath)
    const disposition = dispositionParam === 'attachment' || dispositionParam === 'inline'
      ? dispositionParam
      : payload.disposition
    const filename = segments[segments.length - 1]

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFromExt(ext),
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}