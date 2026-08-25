import { PrismaClient } from '.prisma/client/default'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type CliOptions = {
  email: string
  password: string
  name: string
}

function readOption(name: string) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return value ? value.slice(name.length + 3).trim() : ''
}

function parseCliOptions(): CliOptions {
  const email = (readOption('email') || process.env.ADMIN_EMAIL || 'ivanimage@hotmail.com').trim().toLowerCase()
  const password = (readOption('password') || process.env.ADMIN_PASSWORD || 'TempSuperAdmin2026!').trim()
  const name = (readOption('name') || process.env.ADMIN_NAME || 'Iván Super Admin').trim()

  if (!email || !email.includes('@')) throw new Error('EMAIL_INVALIDO')
  if (!password || password.length < 8) throw new Error('PASSWORD_INVALIDO')

  return { email, password, name }
}

async function resolveTargetEmpresaAndSede() {
  const empresas = await prisma.empresa.findMany({
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      nombre: true,
      nit: true,
      planOwnerUserId: true,
    },
    take: 25,
  })

  let empresa = empresas.find((item) => !String(item.nit || '').toUpperCase().startsWith('PERS-'))

  if (!empresa) {
    empresa = await prisma.empresa.create({
      data: {
        nombre: 'SGDigital',
        nit: '900999999-1',
        email: 'ivanimage@hotmail.com',
        workspaceCode: 'SGDIGITAL',
      },
      select: {
        id: true,
        nombre: true,
        nit: true,
        planOwnerUserId: true,
      },
    })
  }

  const sede = await prisma.sede.findFirst({
    where: { empresaId: empresa.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, nombre: true },
  })

  const resolvedSede = sede ?? await prisma.sede.create({
    data: {
      empresaId: empresa.id,
      nombre: 'Principal',
    },
    select: { id: true, nombre: true },
  })

  return {
    empresaId: empresa.id,
    empresaNombre: empresa.nombre,
    planOwnerUserId: empresa.planOwnerUserId,
    sedeId: resolvedSede.id,
    sedeNombre: resolvedSede.nombre,
  }
}

async function main() {
  const options = parseCliOptions()
  const target = await resolveTargetEmpresaAndSede()
  const passwordHash = await bcrypt.hash(options.password, 12)

  const existingUser = await prisma.user.findUnique({
    where: { email: options.email },
    select: { id: true, empresaId: true, sedeDefaultId: true },
  })

  const user = existingUser
    ? await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: options.name,
          password: passwordHash,
          emailVerified: new Date(),
          empresaId: target.empresaId,
          sedeDefaultId: target.sedeId,
          role: 'USER',
        },
        select: { id: true, email: true, role: true },
      })
    : await prisma.user.create({
        data: {
          name: options.name,
          email: options.email,
          password: passwordHash,
          emailVerified: new Date(),
          empresaId: target.empresaId,
          sedeDefaultId: target.sedeId,
          role: 'USER',
        },
        select: { id: true, email: true, role: true },
      })

  await prisma.sedeMembership.upsert({
    where: { sedeId_userId: { sedeId: target.sedeId, userId: user.id } },
    create: { sedeId: target.sedeId, userId: user.id, role: 'ADMIN' },
    update: { role: 'ADMIN' },
  })

  if (!target.planOwnerUserId) {
    await prisma.empresa.update({
      where: { id: target.empresaId },
      data: { planOwnerUserId: user.id },
    })
  }

  console.log('SUPERADMIN_RESTORED')
  console.log(JSON.stringify({
    email: options.email,
    temporaryPassword: options.password,
    empresa: target.empresaNombre,
    sede: target.sedeNombre,
    roleInDb: user.role,
    note: 'El correo configurado como superadmin se eleva a ADMIN por política de src/lib/super-admin.ts.',
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('RESTORE_SUPERADMIN_FAILED', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })