import { NextRequest, NextResponse } from 'next/server'
import { deflateSync } from 'zlib'

export const runtime = 'nodejs'

function crc32(buf: Buffer): number {
  let crc = ~0
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (0xedb88320 & (-(crc & 1) as unknown as number))
    }
  }
  return (~crc) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)

  const crcBuf = Buffer.concat([t, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(crcBuf), 0)

  return Buffer.concat([len, t, data, crc])
}

function createSolidPng(opts: { width: number; height: number; rgb: [number, number, number] }): Buffer {
  const { width, height, rgb } = opts

  // Raw image data: each scanline starts with filter byte 0.
  const stride = 1 + width * 3
  const raw = Buffer.alloc(stride * height)

  for (let y = 0; y < height; y++) {
    const rowStart = y * stride
    raw[rowStart] = 0x00
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 3
      raw[px] = rgb[0]
      raw[px + 1] = rgb[1]
      raw[px + 2] = rgb[2]
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const idatData = deflateSync(raw)

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))])
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const size = clampInt(searchParams.get('s'), 16, 128, 64)

  // Tailwind gray-200-ish: #e5e7eb
  const png = createSolidPng({ width: size, height: size, rgb: [0xe5, 0xe7, 0xeb] })
  const body = new Uint8Array(png)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
