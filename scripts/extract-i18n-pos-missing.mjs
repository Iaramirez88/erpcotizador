import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
}

const posSource = read('src/app/dashboard/pos/page.tsx')
const messagesSource = read('src/lib/i18n/messages.ts')

const usedKeys = new Set()
{
  const re = /\bt\(\s*'([^']+)'/g
  let match
  while ((match = re.exec(posSource))) usedKeys.add(match[1])
}

const definedKeys = new Set()
{
  const re = /\s'([^']+)'\s*:/g
  let match
  while ((match = re.exec(messagesSource))) definedKeys.add(match[1])
}

const missing = [...usedKeys].filter((key) => !definedKeys.has(key)).sort()

fs.writeFileSync(path.join(repoRoot, 'tmp-i18n-pos-missing.txt'), missing.join('\n') + '\n', 'utf8')

console.log(JSON.stringify({ used: usedKeys.size, defined: definedKeys.size, missing: missing.length }, null, 2))
