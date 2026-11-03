// Verifica paridad ES/EN en src/lib/i18n/messages.ts.
// Uso: npm run i18n:check
// Regla: toda key nueva DEBE existir en 'es' y en 'en' con su traducción.
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'lib', 'i18n', 'messages.ts')
const source = fs.readFileSync(file, 'utf8')

const esStart = source.indexOf('  es: {')
const enStart = source.indexOf('  en: {')
const translateStart = source.indexOf('export function translate')

if (esStart < 0 || enStart < 0 || translateStart < 0) {
  console.error('No se encontraron los bloques es/en/translate en messages.ts')
  process.exit(1)
}

function keysOf(block) {
  const keys = new Set()
  const re = /^\s*'([^']+)'\s*:/gm
  let m
  while ((m = re.exec(block)) !== null) keys.add(m[1])
  return keys
}

const esKeys = keysOf(source.slice(esStart, enStart))
const enKeys = keysOf(source.slice(enStart, translateStart))

const missingInEn = [...esKeys].filter((k) => !enKeys.has(k))
const missingInEs = [...enKeys].filter((k) => !esKeys.has(k))

if (missingInEn.length || missingInEs.length) {
  if (missingInEn.length) {
    console.error(`Faltan ${missingInEn.length} claves en 'en':`)
    missingInEn.forEach((k) => console.error('  - ' + k))
  }
  if (missingInEs.length) {
    console.error(`Faltan ${missingInEs.length} claves en 'es':`)
    missingInEs.forEach((k) => console.error('  - ' + k))
  }
  process.exit(1)
}

console.log(`i18n OK: ${esKeys.size} claves en 'es' y ${enKeys.size} en 'en' (paridad completa).`)
