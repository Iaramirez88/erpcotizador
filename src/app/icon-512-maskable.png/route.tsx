import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #0b5cab 45%, #69c3ff 100%)',
          color: '#f8fafc',
          fontSize: 180,
          fontWeight: 700,
          letterSpacing: '-0.08em',
          padding: '64px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '96px',
            background: 'rgba(255,255,255,0.08)',
          }}
        >
          OX
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  )
}