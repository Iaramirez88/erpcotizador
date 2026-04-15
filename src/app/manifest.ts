import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ordex',
    short_name: 'Ordex',
    description: 'Sistema de cotización y órdenes de trabajo de SGDigital.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4fbff',
    theme_color: '#0f172a',
    orientation: 'portrait',
    lang: 'es-CO',
    scope: '/',
    categories: ['business', 'productivity'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}