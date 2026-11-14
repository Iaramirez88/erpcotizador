/**
 * Rutas que se sirven como embebidos/páginas públicas y no deberían
 * ejecutar lógica que requiere sesión (notificaciones, push, etc.).
 * Se mantiene en sync con `isPublicEmbedPath` de `public/sw.js`.
 */
export function isPublicEmbedPath(pathname: string): boolean {
  const path = String(pathname ?? '').split('?')[0]
  return path.startsWith('/chatbot/')
    || path.startsWith('/form/')
    || path.startsWith('/booking/')
    || path.startsWith('/sites/')
}