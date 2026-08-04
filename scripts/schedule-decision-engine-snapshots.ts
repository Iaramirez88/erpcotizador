import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { persistDecisionEngineSnapshot } from '../src/lib/decision-engine/snapshots'

function readArg(flag: string) {
  const hit = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  return hit ? hit.slice(flag.length + 1) : undefined
}

function hasFlag(flag: string) {
  return process.argv.includes(flag)
}

function parseDate(value?: string, endOfDay = false) {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function resolveScheduledRange(from?: Date, to?: Date) {
  if (from || to) return { from, to }

  const today = new Date()
  const endOfTodayUtc = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
    23,
    59,
    59,
    999,
  ))
  const startOfWindowUtc = new Date(Date.UTC(
    endOfTodayUtc.getUTCFullYear(),
    endOfTodayUtc.getUTCMonth(),
    endOfTodayUtc.getUTCDate() - 89,
    0,
    0,
    0,
    0,
  ))

  return {
    from: startOfWindowUtc,
    to: endOfTodayUtc,
  }
}

async function main() {
  const targetEmpresaId = readArg('--empresa')
  const targetSedeId = readArg('--sede')
  const locale = readArg('--locale') ?? 'es-CO'
  const actorUserId = readArg('--actor') ?? null
  const from = parseDate(readArg('--from'), false)
  const to = parseDate(readArg('--to'), true)
  const range = resolveScheduledRange(from, to)
  const force = hasFlag('--force')
  const includeCompany = !hasFlag('--only-sedes')
  const includeSedes = !hasFlag('--only-company')

  const empresas = await prisma.empresa.findMany({
    where: targetEmpresaId ? { id: targetEmpresaId } : undefined,
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      nombre: true,
      sedes: {
        where: targetSedeId ? { id: targetSedeId } : undefined,
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          nombre: true,
        },
      },
    },
  })

  let scannedEmpresas = 0
  let scannedSedes = 0
  let created = 0
  let reused = 0

  for (const empresa of empresas) {
    scannedEmpresas += 1

    if (includeCompany) {
      const snapshot = await persistDecisionEngineSnapshot({
        empresaId: empresa.id,
        sedeId: null,
        actorUserId,
        from: range.from,
        to: range.to,
        locale,
      }, { force })

      if (snapshot.reused) reused += 1
      else created += 1
    }

    if (includeSedes) {
      for (const sede of empresa.sedes) {
        scannedSedes += 1
        const snapshot = await persistDecisionEngineSnapshot({
          empresaId: empresa.id,
          sedeId: sede.id,
          actorUserId,
          from: range.from,
          to: range.to,
          locale,
        }, { force })

        if (snapshot.reused) reused += 1
        else created += 1
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scannedEmpresas,
        scannedSedes,
        includeCompany,
        includeSedes,
        force,
        window: {
          from: range.from?.toISOString() ?? null,
          to: range.to?.toISOString() ?? null,
        },
        result: {
          created,
          reused,
        },
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })