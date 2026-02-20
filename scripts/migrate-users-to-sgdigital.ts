/**
 * One-off: Migrar usuarios existentes a la empresa SGDigital
 *
 * Objetivo (caso especial):
 * - Usuarios que hoy están en empresas personales (nit empieza con PERS-)
 *   pasan a estar bajo la empresa SGDigital.
 * - Se excluye por defecto ivanimage@hotmail.com.
 * - Se garantiza que cada usuario tenga membresía en la sede principal de SGDigital.
 *
 * Seguridad:
 * - Por defecto es DRY-RUN (no escribe).
 * - Para aplicar cambios: setear APPLY=true.
 *
 * Ejemplos:
 *   # Ver qué haría (no aplica)
 *   TARGET_WORKSPACE_CODE=SGDIGITAL npx tsx scripts/migrate-users-to-sgdigital.ts
 *
 *   # Aplicar
 *   APPLY=true TARGET_WORKSPACE_CODE=SGDIGITAL npx tsx scripts/migrate-users-to-sgdigital.ts
 */

import { PrismaClient } from '.prisma/client/default'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return defaultValue
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y'
}

function parseEmails(raw: string | undefined, fallback: string[]): string[] {
  const value = (raw ?? '').trim()
  if (!value) return fallback
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

async function resolveTargetEmpresa() {
  const id = (process.env.TARGET_EMPRESA_ID ?? '').trim()
  const workspaceCode = (process.env.TARGET_WORKSPACE_CODE ?? '').trim()
  const nit = (process.env.TARGET_EMPRESA_NIT ?? '').trim()
  const name = (process.env.TARGET_EMPRESA_NAME ?? '').trim()

  if (id) {
    const empresa = await prisma.empresa.findUnique({
      where: { id },
      select: { id: true, nombre: true, nit: true, workspaceCode: true },
    })
    if (!empresa) throw new Error(`TARGET_EMPRESA_ID no existe: ${id}`)
    return empresa
  }

  if (workspaceCode) {
    const empresa = await prisma.empresa.findUnique({
      where: { workspaceCode },
      select: { id: true, nombre: true, nit: true, workspaceCode: true },
    })
    if (!empresa) throw new Error(`TARGET_WORKSPACE_CODE no existe: ${workspaceCode}`)
    return empresa
  }

  if (nit) {
    const matches = await prisma.empresa.findMany({
      where: { nit },
      select: { id: true, nombre: true, nit: true, workspaceCode: true },
      take: 2,
    })
    if (matches.length === 0) throw new Error(`TARGET_EMPRESA_NIT no existe: ${nit}`)
    if (matches.length > 1) throw new Error(`TARGET_EMPRESA_NIT retornó múltiples empresas: ${nit}`)
    return matches[0]
  }

  if (name) {
    const matches = await prisma.empresa.findMany({
      where: { nombre: { equals: name, mode: 'insensitive' } },
      select: { id: true, nombre: true, nit: true, workspaceCode: true },
      take: 2,
    })
    if (matches.length === 0) {
      const suggestions = await prisma.empresa.findMany({
        where: { nit: { not: { startsWith: 'PERS-' } } },
        select: { id: true, nombre: true, nit: true, workspaceCode: true },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })
      console.log('No se encontró empresa por nombre. Ejemplos de empresas no-personales:')
      for (const e of suggestions) {
        console.log('-', { id: e.id, nombre: e.nombre, workspaceCode: e.workspaceCode, nit: e.nit })
      }
      throw new Error(`TARGET_EMPRESA_NAME no existe (match exacto insensible): ${name}`)
    }
    if (matches.length > 1) throw new Error(`TARGET_EMPRESA_NAME retornó múltiples empresas: ${name}`)
    return matches[0]
  }

  throw new Error(
    'Debes definir TARGET_EMPRESA_ID o TARGET_WORKSPACE_CODE o TARGET_EMPRESA_NIT o TARGET_EMPRESA_NAME'
  )
}

async function resolveTargetSedeId(empresaId: string): Promise<string> {
  const envSedeId = (process.env.TARGET_SEDE_ID ?? '').trim()
  if (envSedeId) return envSedeId

  const sede = await prisma.sede.findFirst({
    where: { empresaId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true },
  })

  if (!sede) throw new Error('La empresa destino no tiene sedes. Crea una sede o define TARGET_SEDE_ID.')
  return sede.id
}

async function main() {
  const apply = envBool('APPLY', false)
  const migrateAll = envBool('MIGRATE_ALL', false)

  const adminEmail = (process.env.ADMIN_EMAIL ?? 'sgdigitalnet@gmail.com').trim().toLowerCase()
  const adminName = (process.env.ADMIN_NAME ?? 'SGDigital Admin').trim()
  const adminPassword = (process.env.ADMIN_PASSWORD ?? '').trim()

  const excludeEmails = parseEmails(process.env.EXCLUDE_EMAILS, ['ivanimage@hotmail.com'])

  const targetEmpresa = await resolveTargetEmpresa()
  const targetSedeId = await resolveTargetSedeId(targetEmpresa.id)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(apply ? '🚨 MODO APPLY (escribe cambios)' : '✅ MODO DRY-RUN (no escribe)')
  console.log('Empresa destino:', {
    id: targetEmpresa.id,
    nombre: targetEmpresa.nombre,
    workspaceCode: targetEmpresa.workspaceCode,
    nit: targetEmpresa.nit,
  })
  console.log('Sede destino:', targetSedeId)
  console.log('Admin destino:', adminEmail)
  console.log('Excluir emails:', excludeEmails)
  console.log('Alcance:', migrateAll ? 'ALL (todo usuario fuera de la empresa destino)' : 'PERSONAL (solo PERS- / sin empresa)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1) Asegurar que el admin de SGDigital exista, quede bajo la empresa destino y sea ADMIN en la sede destino.
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true, email: true, empresaId: true },
  })

  if (!existingAdmin) {
    if (!apply) {
      console.log(`DRY-RUN: se crearía el usuario admin ${adminEmail} (define ADMIN_PASSWORD si vas a aplicar).`)
    } else {
      if (!adminPassword) {
        throw new Error('ADMIN_PASSWORD es requerido para crear el usuario admin cuando APPLY=true')
      }

      const passwordHash = await bcrypt.hash(adminPassword, 12)
      const created = await prisma.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          password: passwordHash,
          emailVerified: new Date(),
          empresaId: targetEmpresa.id,
          role: 'USER',
        },
        select: { id: true },
      })

      await prisma.sedeMembership.upsert({
        where: { sedeId_userId: { sedeId: targetSedeId, userId: created.id } },
        create: { sedeId: targetSedeId, userId: created.id, role: 'ADMIN' },
        update: { role: 'ADMIN' },
      })

      await prisma.empresa.updateMany({
        where: { id: targetEmpresa.id, planOwnerUserId: null },
        data: { planOwnerUserId: created.id },
      })

      console.log(`✅ Admin creado y asignado: ${adminEmail}`)
    }
  } else {
    if (!apply) {
      console.log(`DRY-RUN: se aseguraría membresía ADMIN y empresa para ${adminEmail}.`)
    } else {
      await prisma.$transaction(async (tx) => {
        if (existingAdmin.empresaId !== targetEmpresa.id) {
          await tx.user.update({ where: { id: existingAdmin.id }, data: { empresaId: targetEmpresa.id } })
        }

        await tx.sedeMembership.upsert({
          where: { sedeId_userId: { sedeId: targetSedeId, userId: existingAdmin.id } },
          create: { sedeId: targetSedeId, userId: existingAdmin.id, role: 'ADMIN' },
          update: { role: 'ADMIN' },
        })

        await tx.empresa.updateMany({
          where: { id: targetEmpresa.id, planOwnerUserId: null },
          data: { planOwnerUserId: existingAdmin.id },
        })
      })

      console.log(`✅ Admin asegurado: ${adminEmail}`)
    }
  }

  const users = await prisma.user.findMany({
    where: {
      email: { notIn: excludeEmails },
      ...(migrateAll
        ? { empresaId: { not: targetEmpresa.id } }
        : {
            OR: [
              { empresaId: null },
              { empresa: { nit: { startsWith: 'PERS-' } } },
            ],
          }),
    },
    select: {
      id: true,
      email: true,
      empresaId: true,
      empresa: { select: { id: true, nombre: true, nit: true } },
      sedeMemberships: { select: { sedeId: true, role: true }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const candidates = users.filter((u) => u.empresaId !== targetEmpresa.id)

  console.log(`Encontrados ${candidates.length} usuario(s) a migrar.`)
  if (candidates.length > 0) {
    console.log('Primeros 20:')
    for (const u of candidates.slice(0, 20)) {
      console.log('-', u.email, 'from', u.empresa?.nit ?? u.empresaId ?? 'null')
    }
  }

  if (!apply) {
    console.log('DRY-RUN: no se aplicaron cambios. Define APPLY=true para ejecutar.')
    return
  }

  let migrated = 0
  for (const u of candidates) {
    const inferredRole = u.sedeMemberships?.[0]?.role ?? 'READER'

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: { empresaId: targetEmpresa.id },
      })

      await tx.sedeMembership.upsert({
        where: {
          sedeId_userId: {
            sedeId: targetSedeId,
            userId: u.id,
          },
        },
        create: {
          sedeId: targetSedeId,
          userId: u.id,
          role: inferredRole,
        },
        update: {},
      })
    })

    migrated++
    if (migrated % 50 === 0) {
      console.log(`Migrados ${migrated}/${candidates.length}...`)
    }
  }

  console.log(`✅ Migración completada. Migrados: ${migrated}`)
  console.log('Nota: puede que los usuarios deban cerrar sesión y volver a iniciar para reflejar empresa/sede en la UI.')
}

main()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
