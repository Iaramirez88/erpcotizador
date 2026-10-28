import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  ACCOUNTING_SAMPLE_TAG,
  getAccountingSampleDataStatus,
  removeAccountingSampleData,
  seedAccountingSampleData,
} from '@/lib/accounting/sample-data'

const DEFAULT_ADMIN_EMAIL = 'admin@sgdigital.com'

function parseArg(name: string) {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : ''
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`)
}

async function resolveTargetEmpresa() {
  const emailArg = parseArg('email')
  const empresaIdArg = parseArg('empresaId')

  if (empresaIdArg) {
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaIdArg },
      select: { id: true, nombre: true },
    })

    if (!empresa) throw new Error(`No existe la empresa ${empresaIdArg}.`)

    const actor = await prisma.user.findFirst({
      where: { empresaId: empresa.id },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, email: true, name: true },
    })

    return {
      empresaId: empresa.id,
      empresaNombre: empresa.nombre,
      actorUserId: actor?.id ?? null,
      actorLabel: actor?.name || actor?.email || 'usuario base',
    }
  }

  const preferredEmail = emailArg || DEFAULT_ADMIN_EMAIL
  const preferredUser = await prisma.user.findUnique({
    where: { email: preferredEmail },
    select: { id: true, email: true, name: true, empresaId: true, empresa: { select: { nombre: true } } },
  })

  if (preferredUser?.empresaId) {
    return {
      empresaId: preferredUser.empresaId,
      empresaNombre: preferredUser.empresa?.nombre || preferredUser.empresaId,
      actorUserId: preferredUser.id,
      actorLabel: preferredUser.name || preferredUser.email || 'usuario base',
    }
  }

  const fallbackUser = await prisma.user.findFirst({
    where: { empresaId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true, name: true, empresaId: true, empresa: { select: { nombre: true } } },
  })

  if (!fallbackUser?.empresaId) {
    throw new Error('No se encontró una empresa con usuarios asociados para sembrar la base contable.')
  }

  return {
    empresaId: fallbackUser.empresaId,
    empresaNombre: fallbackUser.empresa?.nombre || fallbackUser.empresaId,
    actorUserId: fallbackUser.id,
    actorLabel: fallbackUser.name || fallbackUser.email || 'usuario base',
  }
}

async function main() {
  const target = await resolveTargetEmpresa()

  if (hasFlag('remove')) {
    const removed = await removeAccountingSampleData(target.empresaId)
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'remove',
          sampleTag: ACCOUNTING_SAMPLE_TAG,
          empresaId: target.empresaId,
          empresaNombre: target.empresaNombre,
          removed,
        },
        null,
        2,
      ),
    )
    return
  }

  const seeded = await seedAccountingSampleData({ empresaId: target.empresaId, actorUserId: target.actorUserId })
  const status = await getAccountingSampleDataStatus(target.empresaId)

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'seed',
        sampleTag: ACCOUNTING_SAMPLE_TAG,
        empresaId: target.empresaId,
        empresaNombre: target.empresaNombre,
        actor: target.actorLabel,
        seeded,
        status,
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error('FAIL seed-accounting-sample', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
