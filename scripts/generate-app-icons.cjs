/**
 * Genera los iconos PWA (icon-192.png, icon-512.png, icon-512-maskable.png
 * y apple-touch-icon.png) a partir del SVG de marca de Joinclap.
 *
 * Uso: node scripts/generate-app-icons.cjs
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const SVG_PATH = path.join(ROOT, 'public', 'brand', 'icono-app-joinclap.svg')

// Color de fondo de la marca (#AAEE02) para rellenar el safe zone del icono maskable.
const BRAND_BACKGROUND = '#AAEE02'

async function main() {
  const svg = fs.readFileSync(SVG_PATH)

  // Iconos "any" (Android / instalación estándar): full-bleed.
  await sharp(svg).resize(192, 192).png().toFile(path.join(ROOT, 'public', 'icon-192.png'))
  await sharp(svg).resize(512, 512).png().toFile(path.join(ROOT, 'public', 'icon-512.png'))

  // Apple touch icon (iOS): 180x180, full-bleed.
  await sharp(svg).resize(180, 180).png().toFile(path.join(ROOT, 'public', 'apple-touch-icon.png'))

  // Icono maskable: el logo se escala al ~56% para que quede dentro del safe zone
  // (círculo central del 80%) sobre el fondo de marca.
  const canvasSize = 512
  const logoSize = 288
  const padding = Math.floor((canvasSize - logoSize) / 2)
  await sharp(svg)
    .resize(logoSize, logoSize)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: BRAND_BACKGROUND,
    })
    .png()
    .toFile(path.join(ROOT, 'public', 'icon-512-maskable.png'))

  console.log('Iconos generados correctamente.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
