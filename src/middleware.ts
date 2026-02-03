import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fuerza que /uploads/* pase por un handler Node (evita 404 por handling estático de assets)
  if (pathname.startsWith('/uploads/')) {
    const url = req.nextUrl.clone()
    url.pathname = `/api${pathname}`
    const res = NextResponse.rewrite(url)
    res.headers.set('X-SG-Uploads', 'rewrite')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/uploads/:path*'],
}
