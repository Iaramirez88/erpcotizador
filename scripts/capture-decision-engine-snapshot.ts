import 'dotenv/config'
import { persistDecisionEngineSnapshot } from '../src/lib/decision-engine/snapshots'

function readArg(flag: string) {
  const hit = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  return hit ? hit.slice(flag.length + 1) : undefined
}

function parseDate(value?: string, endOfDay = false) {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

async function main() {
  const empresaId = readArg('--empresa')
  if (!empresaId) {
    throw new Error('Debes enviar --empresa=<id>.')
  }

  const sedeId = readArg('--sede') ?? null
  const actorUserId = readArg('--actor') ?? null
  const locale = readArg('--locale') ?? 'es-CO'
  const from = parseDate(readArg('--from'), false)
  const to = parseDate(readArg('--to'), true)
  const force = process.argv.includes('--force')

  const snapshot = await persistDecisionEngineSnapshot({
    empresaId,
    sedeId,
    actorUserId,
    from,
    to,
    locale,
  }, {
    force,
  })

  console.log('Decision Engine snapshot OK')
  console.log(`snapshotId=${snapshot.id}`)
  console.log(`scope=${snapshot.scope}`)
  console.log(`companyHealth=${snapshot.companyHealthScore}`)
  console.log(`createdAt=${snapshot.createdAt}`)
  console.log(`reused=${snapshot.reused ? 'yes' : 'no'}`)
}

main().catch((error) => {
  console.error('Decision Engine snapshot FAIL')
  console.error(error)
  process.exit(1)
})