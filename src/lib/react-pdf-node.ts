import 'server-only'

import { dirname, join } from 'path'
import { existsSync } from 'fs'
import type { Readable } from 'stream'

type ReactPdfRendererModule = typeof import('@react-pdf/renderer')

let rendererPromise: Promise<ReactPdfRendererModule> | null = null

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  if (!stream || typeof (stream as unknown as { on?: unknown }).on !== 'function') {
    throw new Error('Salida PDF inválida')
  }

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)))
    stream.on('end', () => resolve())
    stream.on('error', (e: unknown) => reject(e))
  })

  return Buffer.concat(chunks)
}

export async function getReactPdfRenderer(): Promise<ReactPdfRendererModule> {
  if (!rendererPromise) {
    rendererPromise = (async () => {
      // En App Router, Next puede ejecutar en contexto `(rsc)` y aliasear `react` a la
      // versión vendored RSC, que rompe `@react-pdf/renderer` (reconciler).
      // Por eso cargamos el módulo fuera del bundle de Next importándolo por ruta
      // absoluta del filesystem (webpackIgnore).
      const { fileURLToPath, pathToFileURL } = await import('node:url')

      const rendererPkgRel = join('node_modules', '@react-pdf', 'renderer', 'package.json')

      const findRootWithRenderer = (startDir: string): string | null => {
        let dir = startDir
        for (let i = 0; i < 15; i++) {
          if (existsSync(join(dir, rendererPkgRel))) return dir
          const parent = dirname(dir)
          if (parent === dir) break
          dir = parent
        }
        return null
      }

      const starts = [process.cwd(), dirname(fileURLToPath(import.meta.url))]
      const root = starts.map(findRootWithRenderer).find((x): x is string => Boolean(x))

      // Camino preferido: importar el entry real directo desde node_modules.
      // Esto evita depender de `createRequire`, que puede quedar alterado por el bundler.
      const bases = [root, process.cwd()].filter((x): x is string => Boolean(x))
      const candidateEntries = bases
        .map((base) => join(base, 'node_modules', '@react-pdf', 'renderer', 'lib', 'react-pdf.js'))
        .filter((p, idx, arr) => arr.indexOf(p) === idx)

      const directEntry = candidateEntries.find((p) => existsSync(p))

      let entryPath: string
      if (directEntry) {
        entryPath = directEntry
      } else {
        // Fallback: resolver con Node `createRequire`.
        const mod: unknown = await import('node:module')
        const createRequireMaybe = (mod as { createRequire?: unknown; default?: { createRequire?: unknown } }).createRequire ??
          (mod as { default?: { createRequire?: unknown } }).default?.createRequire

        if (typeof createRequireMaybe !== 'function') {
          throw new Error('createRequire no está disponible en este runtime')
        }

        const createRequire = createRequireMaybe as (filenameOrUrl: string) => NodeRequire

        try {
          const base = root ?? process.cwd()
          const req = createRequire(join(base, 'package.json'))
          entryPath = req.resolve('@react-pdf/renderer')
        } catch {
          const req = createRequire(import.meta.url)
          entryPath = req.resolve('@react-pdf/renderer')
        }
      }

      const fileHref = pathToFileURL(entryPath).href
      return (await import(
        /* webpackIgnore: true */ fileHref
      )) as ReactPdfRendererModule
    })()
  }

  return rendererPromise
}

export async function pdfToBuffer(doc: unknown): Promise<Buffer> {
  const { pdf } = await getReactPdfRenderer()
  const stream = (await pdf(doc as never).toBuffer()) as unknown as Readable
  return await streamToBuffer(stream)
}
