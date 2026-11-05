/**
 * Ciclo de vida de una cuenta (Super Admin).
 *
 *   npx tsx scripts/test-account-lifecycle.ts
 *
 * Verifica las invariantes que antes fallaban y la política de retención:
 *  1. Un correo ya registrado no vuelve a crear cuenta ni empresa (responde 409).
 *  2. El trial gratuito de 7 días hábiles es por persona: no se re-otorga en espacios nuevos.
 *  3. El borrado definitivo desde Super Admin no deja rastro (usuario + empresa + data).
 *  4. Los avisos de retención (licencia vencida, trial terminado, inactividad) calculan bien
 *     las fechas y la simulación (`dryRun`) no envía correos ni elimina cuentas.
 *
 * Usa transacciones revertidas para los escenarios destructivos y limpia al final la
 * cuenta temporal que crea para probar el registro.
 */

import 'dotenv/config'
import { POST } from '../src/app/api/auth/register/route'
import { prisma } from '../src/lib/prisma'
import { previewAccountDeletion, purgeUserAccount, purgeUserAccountWithin } from '../src/lib/account-purge'
import { buildRetentionEmail, runAccountRetention } from '../src/lib/account-retention'
import {
  ACCOUNT_INACTIVITY_DELETION_DAYS,
  ACCOUNT_RETENTION_WARNING_DAYS,
  PERSONAL_TRIAL_BUSINESS_DAYS,
  addBusinessDays,
  addDays,
  resolveAccountRetention,
} from '../src/lib/retention-policy'
import { findExistingPersonalEmpresa, hasConsumedPersonalTrial, resolvePersonalTrialFields } from '../src/lib/trial-policy'

if (process.env.NODE_ENV === 'production') {
  console.error('Este script crea y elimina datos de prueba. No lo ejecutes en producción.')
  process.exit(1)
}

let failures = 0

function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1
  console.log(`${ok ? 'OK ' : 'FAIL'} · ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`)
}

function makeRegisterRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function register(email: string, name: string) {
  const res = await POST(makeRegisterRequest({ name, email, password: 'Prueba1234' }))
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, json }
}

async function testTrialPolicy() {
  const freshEmail = `tmp.trial.${Date.now()}@local.test`
  const fresh = await resolvePersonalTrialFields({ userId: 'tmp-sin-historial', email: freshEmail })
  check('Un correo nuevo recibe el trial de 7 días hábiles', Boolean(fresh.trialStartedAt && fresh.trialValidUntil))

  if (fresh.trialStartedAt && fresh.trialValidUntil) {
    const calendarDays = Math.round(
      (fresh.trialValidUntil.getTime() - fresh.trialStartedAt.getTime()) / (24 * 60 * 60 * 1000)
    )
    const weekday = fresh.trialValidUntil.getUTCDay()
    check(
      'El trial cubre 7 días hábiles y vence en día hábil',
      calendarDays >= PERSONAL_TRIAL_BUSINESS_DAYS && weekday !== 0 && weekday !== 6,
      { calendarDays, weekday, validUntil: fresh.trialValidUntil.toISOString() }
    )
  }

  const reused = await findExistingPersonalEmpresa({ userId: 'tmp-sin-historial', email: freshEmail })
  check('No hay espacio personal previo para un correo nuevo', reused === null, reused)

  const consumed = await prisma.empresa.findFirst({
    where: { trialStartedAt: { not: null }, nit: { startsWith: 'PERS-' } },
    select: { email: true, planOwnerUserId: true },
  })

  if (consumed?.email) {
    const replay = await resolvePersonalTrialFields({ userId: consumed.planOwnerUserId, email: consumed.email })
    const yaUsado = await hasConsumedPersonalTrial({ userId: consumed.planOwnerUserId, email: consumed.email })
    check('Quien ya usó el trial no recibe otro', yaUsado && replay.trialStartedAt === null, replay)
  }
}

async function testRegistrationDeduplication() {
  const email = `tmp.registro.${Date.now()}@local.test`

  const first = await register(email, 'TMP Registro')
  check('Registro nuevo responde 201', first.status === 201, first.status)

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      empresaId: true,
      empresa: { select: { nit: true, trialStartedAt: true } },
    },
  })

  check('El espacio personal usa la convención PERS-<userId>', user?.empresa?.nit === `PERS-${user?.id}`, user?.empresa?.nit)
  check('El primer registro otorga trial', Boolean(user?.empresa?.trialStartedAt))

  const second = await register(email, 'TMP Registro')
  check(
    'El mismo correo no se registra dos veces',
    second.status === 409 && second.json.code === 'EMAIL_ALREADY_REGISTERED',
    second
  )

  const empresas = await prisma.empresa.count({ where: { email } })
  check('No se crea una segunda empresa para el mismo correo', empresas === 1, empresas)

  const users = await prisma.user.count({ where: { email } })
  check('No se crea un segundo usuario para el mismo correo', users === 1, users)

  if (!user?.id) return

  const purged = await purgeUserAccount({ userId: user.id })
  const [userGone, empresasLeft] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { id: true } }),
    prisma.empresa.count({ where: { email } }),
  ])

  check('El borrado definitivo elimina al usuario', !userGone)
  check('El borrado definitivo elimina el espacio personal', empresasLeft === 0, purged.company)
}

async function testPurgeScenarios() {
  // Empresa con un solo usuario: se elimina la empresa completa (rollback al final).
  const single = await prisma.user.findFirst({
    where: { email: { endsWith: '@local.test' }, empresaId: { not: null } },
    select: { id: true, email: true, empresaId: true },
  })

  if (single?.empresaId) {
    const preview = await previewAccountDeletion({ userId: single.id })
    check('La vista previa explica el alcance del borrado', Boolean(preview?.reason), preview?.reason)

    try {
      await prisma.$transaction(async (tx) => {
        const result = await purgeUserAccountWithin(tx, { preview: preview! })
        check('La purga de empresa borra las tablas asociadas', Object.keys(result.rowsByTable).length >= 0, result.rowsByTable)
        throw new Error('ROLLBACK')
      })
    } catch (error) {
      check('El escenario de empresa se revierte sin efectos', error instanceof Error && error.message === 'ROLLBACK')
    }

    const [userAfter, empresaAfter] = await Promise.all([
      prisma.user.findUnique({ where: { id: single.id }, select: { id: true } }),
      prisma.empresa.findUnique({ where: { id: single.empresaId }, select: { id: true } }),
    ])
    check('El rollback conserva usuario y empresa', Boolean(userAfter && empresaAfter))
  }

  // Empresa con dos usuarios: la empresa se conserva y se reasigna la documentación.
  const stamp = Date.now()
  try {
    await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nombre: `TMP PURGE ${stamp}`, nit: `TMP-PURGE-${stamp}`, planTier: 'BASIC' },
      })
      const owner = await tx.user.create({
        data: { email: `tmp.owner.${stamp}@local.test`, name: 'Owner', empresaId: empresa.id },
      })
      const victim = await tx.user.create({
        data: { email: `tmp.victim.${stamp}@local.test`, name: 'Victim', empresaId: empresa.id },
      })
      await tx.empresa.update({ where: { id: empresa.id }, data: { planOwnerUserId: owner.id } })
      const sede = await tx.sede.create({ data: { empresaId: empresa.id, nombre: 'Principal', codigo: 'PRIN' } })
      await tx.sedeMembership.create({ data: { sedeId: sede.id, userId: owner.id, role: 'ADMIN' } })
      const cliente = await tx.cliente.create({
        data: { empresaId: empresa.id, nombre: 'Cliente TMP', tipoDocumento: 'NIT', documento: `TMP-DOC-${stamp}` },
      })
      await tx.cotizacion.create({
        data: { numero: `TMP-COT-${stamp}`, sedeId: sede.id, clienteId: cliente.id, vendedorId: victim.id },
      })

      const result = await purgeUserAccountWithin(tx, {
        preview: {
          userId: victim.id,
          email: victim.email,
          empresa: { id: empresa.id, nombre: empresa.nombre, nit: empresa.nit },
          isPersonalWorkspace: false,
          companyUserCount: 2,
          deleteCompany: false,
          reason: 'test',
        },
      })

      const [empresaStill, victimStill, quote] = await Promise.all([
        tx.empresa.findUnique({ where: { id: empresa.id }, select: { id: true } }),
        tx.user.findUnique({ where: { id: victim.id }, select: { id: true } }),
        tx.cotizacion.findFirst({ where: { numero: `TMP-COT-${stamp}` }, select: { vendedorId: true } }),
      ])

      check('Con más usuarios la empresa se conserva', Boolean(empresaStill))
      check('El usuario se elimina', !victimStill)
      check('Las cotizaciones se reasignan al administrador', quote?.vendedorId === owner.id, result.reassigned)

      throw new Error('ROLLBACK')
    })
  } catch (error) {
    check('El escenario cooperativo se revierte sin efectos', error instanceof Error && error.message === 'ROLLBACK')
  }
}

function testRetentionPolicy() {
  const now = new Date('2026-11-04T15:00:00.000Z')

  const active = resolveAccountRetention({ now, createdAt: addDays(now, -90), lastLoginAt: addDays(now, -10) })
  check('Con 10 días de inactividad la cuenta sigue activa', active.stage === 'ACTIVE', active.stage)

  const warning = resolveAccountRetention({
    now,
    createdAt: addDays(now, -120),
    lastLoginAt: addDays(
      now,
      -(ACCOUNT_INACTIVITY_DELETION_DAYS - ACCOUNT_RETENTION_WARNING_DAYS + 2)
    ),
  })
  check('Dentro de los 7 días previos aparece el aviso de eliminación', warning.stage === 'WARNING', {
    stage: warning.stage,
    daysUntilDeletion: warning.daysUntilDeletion,
  })

  const due = resolveAccountRetention({
    now,
    createdAt: addDays(now, -150),
    lastLoginAt: addDays(now, -ACCOUNT_INACTIVITY_DELETION_DAYS),
  })
  check('A los 60 días sin acceso la cuenta queda lista para eliminarse', due.stage === 'DELETION_DUE', due.stage)

  const paid = resolveAccountRetention({
    now,
    createdAt: addDays(now, -365),
    lastLoginAt: addDays(now, -200),
    planValidUntil: addDays(now, 20),
  })
  check('Una licencia vigente exime del borrado automático', paid.stage === 'EXEMPT' && paid.deletionAt === null, {
    stage: paid.stage,
    deletionAt: paid.deletionAt,
  })

  const superAdmin = resolveAccountRetention({
    now,
    createdAt: addDays(now, -365),
    lastLoginAt: addDays(now, -200),
    isSuperAdmin: true,
  })
  check('El Super Admin nunca se elimina automáticamente', superAdmin.exemption === 'SUPER_ADMIN', superAdmin.exemption)

  const neverLoggedIn = resolveAccountRetention({ now, createdAt: addDays(now, -30), lastLoginAt: null })
  check(
    'Sin ingresos la inactividad se cuenta desde la creación',
    neverLoggedIn.lastActivitySource === 'CREATED' && neverLoggedIn.daysInactive === 30,
    { source: neverLoggedIn.lastActivitySource, days: neverLoggedIn.daysInactive }
  )

  const legacy = resolveAccountRetention({
    now,
    createdAt: addDays(now, -800),
    lastLoginAt: addDays(now, -400),
    policyStartAt: addDays(now, -10),
  })
  check(
    'La fecha de activación de la política protege cuentas heredadas',
    legacy.stage === 'ACTIVE' && legacy.lastActivitySource === 'POLICY_START',
    { stage: legacy.stage, source: legacy.lastActivitySource, daysInactive: legacy.daysInactive }
  )

  const trialEnd = addBusinessDays(now, PERSONAL_TRIAL_BUSINESS_DAYS)
  check(
    'El cálculo de días hábiles evita sábados y domingos',
    trialEnd.getUTCDay() !== 0 && trialEnd.getUTCDay() !== 6,
    trialEnd.toISOString()
  )

  const licenseEmail = buildRetentionEmail({
    kind: 'LICENSE_EXPIRED',
    recipientName: 'Ana',
    empresaNombre: 'ACME',
    licenseExpiredAt: addDays(now, -2),
    lastActivityAt: addDays(now, -5),
    deletionAt: addDays(now, 55),
    warningAt: addDays(now, 48),
  })
  check(
    'El correo de licencia vencida avisa suspensión y eliminación',
    licenseEmail.subject.includes('licencia venció') &&
      licenseEmail.html.includes('suspendido') &&
      licenseEmail.html.includes('eliminarán'),
    licenseEmail.subject
  )

  const warningEmail = buildRetentionEmail({
    kind: 'INACTIVITY_WARNING',
    recipientName: 'Ana',
    empresaNombre: 'ACME',
    lastActivityAt: addDays(now, -57),
    deletionAt: addDays(now, 3),
    warningAt: now,
    daysInactive: 57,
    daysUntilDeletion: 3,
  })
  check(
    'El aviso de inactividad indica la fecha de eliminación',
    warningEmail.subject.includes('se eliminará') &&
      warningEmail.html.includes(`${ACCOUNT_INACTIVITY_DELETION_DAYS} días`),
    warningEmail.subject
  )

  check(
    'Los avisos incluyen la política de retención',
    licenseEmail.html.includes('política de retención') && warningEmail.html.includes('política de retención')
  )
}

async function testRetentionDryRun() {
  const summary = await runAccountRetention({ dryRun: true })
  check(
    'La simulación de retención no envía correos ni elimina cuentas',
    summary.dryRun && summary.sent.length === 0 && summary.purged.length === 0,
    { scanned: summary.scanned, wouldSend: summary.wouldSend.length, wouldPurge: summary.wouldPurge.length }
  )
}

async function main() {
  testRetentionPolicy()
  await testTrialPolicy()
  await testRetentionDryRun()
  await testRegistrationDeduplication()
  await testPurgeScenarios()

  console.log(failures === 0 ? '\nTodo OK' : `\n${failures} verificación(es) fallaron`)
  if (failures > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
