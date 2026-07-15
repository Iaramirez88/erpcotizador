import { PrismaClient } from '.prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import { spawnSync } from 'node:child_process'

dotenv.config()

type CliOptions = {
  empresaId: string | null
  dryRun: boolean
  refresh: boolean
  includeMemberships: boolean
}

type EmpresaTarget = {
  id: string
  nombre: string
}

function parseCliArgs(argv: string[]): CliOptions {
  let empresaId = (process.env.PERMISOS_EMPRESA_ID || '').trim() || null
  let dryRun = false
  let refresh = false
  let includeMemberships = false

  for (const rawArg of argv) {
    const arg = rawArg.trim()
    if (!arg) continue

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--refresh') {
      refresh = true
      continue
    }

    if (arg === '--include-memberships') {
      includeMemberships = true
      continue
    }

    if (arg.startsWith('--empresa=')) {
      empresaId = arg.slice('--empresa='.length).trim() || null
      continue
    }

    if (arg.startsWith('--empresaId=')) {
      empresaId = arg.slice('--empresaId='.length).trim() || null
    }
  }

  return { empresaId, dryRun, refresh, includeMemberships }
}

async function getEmpresas(prisma: PrismaClient, empresaId: string | null): Promise<EmpresaTarget[]> {
  return prisma.empresa.findMany({
    where: empresaId ? { id: empresaId } : undefined,
    select: { id: true, nombre: true },
    orderBy: { createdAt: 'asc' },
  })
}

async function resetEmpresaPermissions(args: {
  prisma: PrismaClient
  empresa: EmpresaTarget
  includeMemberships: boolean
  dryRun: boolean
}) {
  const sedeIds = await args.prisma.sede.findMany({
    where: { empresaId: args.empresa.id },
    select: { id: true },
  })
  const sedeIdList = sedeIds.map((item) => item.id)

  const [
    permissionProfiles,
    permissionProfileAssignments,
    userCapabilityGrants,
    userModuleAccess,
    userGlobalAccess,
    domainEntitlements,
    capabilityEntitlements,
    sedeMemberships,
    userDefaultSedes,
  ] = await Promise.all([
    args.prisma.permissionProfile.count({ where: { empresaId: args.empresa.id } }),
    args.prisma.permissionProfileAssignment.count({ where: { empresaId: args.empresa.id } }),
    args.prisma.userCapabilityGrant.count({ where: { empresaId: args.empresa.id } }),
    args.prisma.userModuleAccess.count({ where: { sede: { empresaId: args.empresa.id } } }),
    args.prisma.userGlobalAccess.count({ where: { empresaId: args.empresa.id } }),
    args.prisma.domainEntitlement.count({ where: { empresaId: args.empresa.id } }),
    args.prisma.capabilityEntitlement.count({ where: { empresaId: args.empresa.id } }),
    args.includeMemberships
      ? args.prisma.sedeMembership.count({ where: { sede: { empresaId: args.empresa.id } } })
      : Promise.resolve(0),
    args.includeMemberships && sedeIdList.length
      ? args.prisma.user.count({ where: { sedeDefaultId: { in: sedeIdList } } })
      : Promise.resolve(0),
  ])

  const summary = {
    permissionProfiles,
    permissionProfileAssignments,
    userCapabilityGrants,
    userModuleAccess,
    userGlobalAccess,
    domainEntitlements,
    capabilityEntitlements,
    sedeMemberships,
    userDefaultSedes,
  }

  if (args.dryRun) {
    return summary
  }

  await args.prisma.$transaction(async (tx) => {
    if (args.includeMemberships && sedeIdList.length) {
      await tx.user.updateMany({
        where: { sedeDefaultId: { in: sedeIdList } },
        data: { sedeDefaultId: null },
      })
    }

    await tx.permissionProfileAssignment.deleteMany({ where: { empresaId: args.empresa.id } })
    await tx.permissionProfile.deleteMany({ where: { empresaId: args.empresa.id } })
    await tx.userCapabilityGrant.deleteMany({ where: { empresaId: args.empresa.id } })
    await tx.userModuleAccess.deleteMany({ where: { sede: { empresaId: args.empresa.id } } })
    await tx.userGlobalAccess.deleteMany({ where: { empresaId: args.empresa.id } })
    await tx.capabilityEntitlement.deleteMany({ where: { empresaId: args.empresa.id } })
    await tx.domainEntitlement.deleteMany({ where: { empresaId: args.empresa.id } })

    if (args.includeMemberships) {
      await tx.sedeMembership.deleteMany({ where: { sede: { empresaId: args.empresa.id } } })
    }
  })

  return summary
}

function runRefreshForEmpresa(empresaId: string) {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const result = spawnSync(npmCommand, ['run', 'seed:rbac-v2', '--', `--empresa=${empresaId}`], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.status !== 0) {
    throw new Error(`El refresh RBAC v2 falló para empresa ${empresaId} con exit code ${result.status ?? 'desconocido'}.`)
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta definido')
  }

  const options = parseCliArgs(process.argv.slice(2))
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  try {
    const empresas = await getEmpresas(prisma, options.empresaId)
    if (!empresas.length) {
      throw new Error(options.empresaId ? 'No se encontro la empresa indicada.' : 'No hay empresas para procesar.')
    }

    console.log(options.dryRun ? 'RBAC reset en modo dry-run' : 'Aplicando reset RBAC')
    console.log(options.includeMemberships ? 'Modo destructivo: tambien se eliminaran membresias de sede.' : 'Modo seguro: se conservaran membresias de sede.')

    for (const empresa of empresas) {
      const summary = await resetEmpresaPermissions({
        prisma,
        empresa,
        includeMemberships: options.includeMemberships,
        dryRun: options.dryRun,
      })

      console.log(
        [
          `Empresa: ${empresa.nombre}`,
          `profiles=${summary.permissionProfiles}`,
          `assignments=${summary.permissionProfileAssignments}`,
          `grants=${summary.userCapabilityGrants}`,
          `moduleAccess=${summary.userModuleAccess}`,
          `globalAccess=${summary.userGlobalAccess}`,
          `domainEntitlements=${summary.domainEntitlements}`,
          `capabilityEntitlements=${summary.capabilityEntitlements}`,
          `memberships=${summary.sedeMemberships}`,
          `defaultSedes=${summary.userDefaultSedes}`,
          options.dryRun ? 'dry-run' : 'reseteado',
        ].join(' | ')
      )

      if (!options.dryRun && options.refresh) {
        console.log(`Refrescando grants RBAC v2 para empresa ${empresa.nombre}...`)
        runRefreshForEmpresa(empresa.id)
      }
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Reset RBAC falló:', error)
  process.exit(1)
})