export type WebsiteEmbedProvider = 'YOUTUBE' | 'VIMEO' | 'GOOGLE_MAPS' | 'FIGMA' | 'CODEPEN'

export type SafeWebsiteEmbed = {
  provider: WebsiteEmbedProvider
  src: string
  sandbox: string
  allow: string
}

const DEFAULT_SANDBOX = 'allow-scripts allow-same-origin allow-presentation'

function safeUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? '').trim())
    return url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function youtubeEmbed(url: URL): SafeWebsiteEmbed | null {
  let videoId = ''
  if (url.hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || ''
  if (url.hostname === 'www.youtube.com' || url.hostname === 'youtube.com' || url.hostname === 'www.youtube-nocookie.com') {
    videoId = url.searchParams.get('v') || (url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,})/)?.[1] ?? '')
  }
  if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null

  return {
    provider: 'YOUTUBE',
    src: `https://www.youtube-nocookie.com/embed/${videoId}`,
    sandbox: DEFAULT_SANDBOX,
    allow: 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen',
  }
}

function vimeoEmbed(url: URL): SafeWebsiteEmbed | null {
  const videoId = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1] || ''
  if (!videoId || !['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) return null

  return {
    provider: 'VIMEO',
    src: `https://player.vimeo.com/video/${videoId}`,
    sandbox: DEFAULT_SANDBOX,
    allow: 'autoplay; fullscreen; picture-in-picture',
  }
}

function googleMapsEmbed(url: URL): SafeWebsiteEmbed | null {
  if (!['www.google.com', 'google.com', 'maps.google.com'].includes(url.hostname)) return null
  if (!url.pathname.startsWith('/maps/embed')) return null
  return {
    provider: 'GOOGLE_MAPS',
    src: url.toString(),
    sandbox: DEFAULT_SANDBOX,
    allow: 'fullscreen',
  }
}

function figmaEmbed(url: URL): SafeWebsiteEmbed | null {
  if (!['www.figma.com', 'figma.com'].includes(url.hostname)) return null
  const sourceUrl = url.pathname === '/embed' ? url.searchParams.get('url') : url.toString()
  const normalizedSource = safeUrl(sourceUrl)
  if (!normalizedSource || !['www.figma.com', 'figma.com'].includes(normalizedSource.hostname)) return null

  return {
    provider: 'FIGMA',
    src: `https://www.figma.com/embed?embed_host=sgdigital&url=${encodeURIComponent(normalizedSource.toString())}`,
    sandbox: DEFAULT_SANDBOX,
    allow: 'fullscreen',
  }
}

function codePenEmbed(url: URL): SafeWebsiteEmbed | null {
  if (url.hostname !== 'codepen.io') return null
  const match = url.pathname.match(/^\/([A-Za-z0-9_-]+)\/(?:pen|embed)\/([A-Za-z0-9_-]+)/)
  if (!match) return null

  return {
    provider: 'CODEPEN',
    src: `https://codepen.io/${match[1]}/embed/${match[2]}?default-tab=result`,
    sandbox: DEFAULT_SANDBOX,
    allow: 'fullscreen',
  }
}

export function resolveSafeWebsiteEmbed(value: unknown): SafeWebsiteEmbed | null {
  const url = safeUrl(value)
  if (!url || url.username || url.password) return null

  return youtubeEmbed(url)
    || vimeoEmbed(url)
    || googleMapsEmbed(url)
    || figmaEmbed(url)
    || codePenEmbed(url)
}

export function sanitizeWebsiteLinkHref(value: unknown) {
  const href = String(value ?? '').trim()
  if (!href) return '#'
  if (href.startsWith('#')) return href
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (/^(mailto|tel):[^\s]+$/i.test(href)) return href

  const url = safeUrl(href)
  return url ? url.toString() : '#'
}
