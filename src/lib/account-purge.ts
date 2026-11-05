import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isPersonalNit } from '@/lib/trial-policy'

/**
 * Borrado definitivo de una cuenta desde Super Admin.
 *
 * Objetivo: no dejar rastro. Se elimina el usuario, sus datos propios y, cuando el usuario
 * es el único miembro del espacio (o es un espacio personal `PERS-…`), también la empresa
 * con toda su data. El borrado de la empresa es genérico: recorre todas las tablas que
 * tienen `empresaId` y las vacía en el orden que permitan las llaves foráneas.
 */

const DELETE_COMPANY_MAX_PASSES = 40
const PURGE_TIMEOUT_MS = 120_000

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

export type AccountDeletionPreview = {
  userId: string
  email: string
  empresa: { id: string; nombre: string; nit: string } | null
  isPersonalWorkspace: boolean
  companyUserCount: number
  /** `true` si al borrar la cuenta también se elimina la empresa y todos sus datos. */
  deleteCompany: boolean
  /** Explicación legible para mostrar en el diálogo de confirmación. */
  reason: string
}

export async function previewAccountDeletion(args: { userId: string }): Promise<AccountDeletionPreview | null> {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: {
      id: true,
      email: true,
      empresaId: true,
      empresa: { select: { id: true, nombre: true, nit: true } },
    },
  })

  if (!user?.id) return null

  const workspaceUsers = user.empresaId
    ? await prisma.user.count({
        where: {
          OR: [{ empresaId: user.empresaId }, { sedeMemberships: { some: { sede: { empresaId: user.empresaId } } } }],
        },
      })
    : 0
  const companyUserCount = workspaceUsers
  const isPersonalWorkspace = isPersonalNit(user.empresa?.nit)
  const deleteCompany = Boolean(user.empresaId) && companyUserCount <= 1

  const reason = !user.empresaId
    ? 'La cuenta no tiene espacio de trabajo: solo se elimina el usuario y sus datos.'
    : deleteCompany
      ? isPersonalWorkspace
        ? 'Es un espacio personal: se elimina la cuenta, la empresa y toda su información.'
        : 'Es el único usuario de la empresa: se elimina la cuenta, la empresa y toda su información.'
      : 'La empresa tiene otros usuarios: se elimina la cuenta y sus datos, la empresa se conserva.'

  return {
    userId: user.id,
    email: user.email,
    empresa: user.empresa ? { id: user.empresa.id, nombre: user.empresa.nombre, nit: user.empresa.nit } : null,
    isPersonalWorkspace,
    companyUserCount,
    deleteCompany,
    reason,
  }
}

async function listCompanyTables(tx: Prisma.TransactionClient): Promise<string[]> {
  const rows = await tx.$queryRaw<Array<{ table_name: string }>>`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = current_schema()
      AND c.column_name = 'empresaId'
      AND t.table_type = 'BASE TABLE'
  `

  return rows
    .map((row) => row.table_name)
    // `empresas` no tiene columna empresaId y `users` se maneja explícitamente
    // (un usuario de otra empresa no debe desaparecer por borrar una cuenta).
    .filter((name) => name !== 'empresas' && name !== 'users')
}

/**
 * Vacía todas las filas de la empresa recorriendo las tablas con `empresaId`.
 *
 * Algunas relaciones están en `Restrict`, así que se reintenta en pasadas sucesivas hasta
 * que ninguna tabla avance. Si algo queda bloqueado, se lanza el error para que la
 * transacción se revierta y el Super Admin vea exactamente qué impidió el borrado.
 */
async function deleteCompanyRows(
  tx: Prisma.TransactionClient,
  empresaId: string
): Promise<Record<string, number>> {
  const pending = new Set(await listCompanyTables(tx))
  const deleted: Record<string, number> = {}

  for (let pass = 0; pass < DELETE_COMPANY_MAX_PASSES && pending.size > 0; pass += 1) {
    let progressed = false

    for (const table of [...pending]) {
      try {
        const count = await tx.$executeRawUnsafe(
          `DELETE FROM ${quoteIdent(table)} WHERE "empresaId" = $1`,
          empresaId
        )
        if (count > 0) {
          deleted[table] = (deleted[table] ?? 0) + count
          progressed = true
        }
        pending.delete(table)
      } catch {
        // Llave foránea pendiente: se reintenta en la siguiente pasada.
      }
    }

    if (!progressed) {
      // Sin avances: si las tablas pendientes están vacías no hay nada más que hacer.
      const blocked: string[] = []
      for (const table of pending) {
        const rows = await tx.$queryRawUnsafe<Array<{ total: bigint }>>(
          `SELECT count(*)::bigint AS total FROM ${quoteIdent(table)} WHERE "empresaId" = $1`,
          empresaId
        )
        const total = Number(rows[0]?.total ?? 0)
        if (total > 0) blocked.push(`${table} (${total})`)
      }

      if (blocked.length) {
        throw new Error(
          `No se pudo purgar toda la información de la empresa. Tablas bloqueadas: ${blocked.join(', ')}`
        )
      }

      break
    }
  }

  return deleted
}

async function resolveReplacementUserId(
  tx: Prisma.TransactionClient,
  args: { empresaId: string; excludeUserId: string; ownerUserId: string | null }
): Promise<string | null> {
  if (args.ownerUserId && args.ownerUserId !== args.excludeUserId) return args.ownerUserId

  const membership = await tx.sedeMembership.findFirst({
    where: {
      userId: { not: args.excludeUserId },
      sede: { empresaId: args.empresaId },
      role: 'ADMIN',
    },
    select: { userId: true },
    orderBy: { createdAt: 'asc' },
  })

  if (membership?.userId) return membership.userId

  const other = await tx.user.findFirst({
    where: { empresaId: args.empresaId, id: { not: args.excludeUserId } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  return other?.id ?? null
}

export type AccountPurgeResult = {
  deletedUserEmail: string
  deletedUserId: string
  company: { id: string; nombre: string; nit: string } | null
  rowsByTable: Record<string, number>
  reassigned: { cotizaciones: number; ordenes: number; toUserId: string | null }
}

export async function purgeUserAccount(args: { userId: string }): Promise<AccountPurgeResult> {
  const preview = await previewAccountDeletion({ userId: args.userId })
  if (!preview) throw new Error('USER_NOT_FOUND')

  return prisma.$transaction((tx) => purgeUserAccountWithin(tx, { preview }), {
    timeout: PURGE_TIMEOUT_MS,
    maxWait: 15_000,
  })
}

/** Variante reutilizable para pruebas: ejecuta la purga dentro de una transacción existente. */
export async function purgeUserAccountWithin(
  tx: Prisma.TransactionClient,
  args: { preview: AccountDeletionPreview }
): Promise<AccountPurgeResult> {
  const { preview } = args
  const user = await tx.user.findUnique({
    where: { id: preview.userId },
    select: {
      id: true,
      email: true,
      empresaId: true,
      empresa: { select: { id: true, nombre: true, nit: true, planOwnerUserId: true } },
    },
  })

  if (!user?.id) throw new Error('USER_NOT_FOUND')

  const assignableEmpresaId = preview.deleteCompany ? null : user.empresaId
  let toUserId: string | null = null
  let cotizaciones = 0
  let ordenes = 0

  if (assignableEmpresaId) {
    toUserId = await resolveReplacementUserId(tx, {
      empresaId: assignableEmpresaId,
      excludeUserId: user.id,
      ownerUserId: user.empresa?.planOwnerUserId ?? null,
    })
  }

  if (toUserId) {
    cotizaciones = (
      await tx.cotizacion.updateMany({ where: { vendedorId: user.id }, data: { vendedorId: toUserId } })
    ).count
    ordenes = (
      await tx.ordenTrabajo.updateMany({ where: { vendedorId: user.id }, data: { vendedorId: toUserId } })
    ).count
  } else {
    // Sin reemplazo posible (o la empresa se elimina): los documentos se van con él.
    cotizaciones = (await tx.cotizacion.deleteMany({ where: { vendedorId: user.id } })).count
    ordenes = (await tx.ordenTrabajo.deleteMany({ where: { vendedorId: user.id } })).count
  }

  // Tokens de acceso temporal emitidos para/por este usuario (no son FK).
  await tx.verificationToken.deleteMany({ where: { identifier: { contains: user.id } } })

  // Invitaciones pendientes a su correo: son rastro de la persona.
  await tx.registrationInvite.deleteMany({ where: { email: user.email } })

  // El usuario (cascade limpia sesiones, cuentas, accesos, notificaciones, etc.).
  await tx.user.delete({ where: { id: user.id } })

  let rowsByTable: Record<string, number> = {}
  let company: AccountPurgeResult['company'] = null

  if (preview.deleteCompany && user.empresa?.id) {
    rowsByTable = await deleteCompanyRows(tx, user.empresa.id)
    await tx.empresa.delete({ where: { id: user.empresa.id } })
    company = { id: user.empresa.id, nombre: user.empresa.nombre, nit: user.empresa.nit }
  }

  return {
    deletedUserEmail: user.email,
    deletedUserId: user.id,
    company,
    rowsByTable,
    reassigned: { cotizaciones, ordenes, toUserId },
  }
}
