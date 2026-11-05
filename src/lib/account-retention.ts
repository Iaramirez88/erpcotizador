import { Prisma, type AccountRetentionNoticeKind } from '@prisma/client'
import { previewAccountDeletion, purgeUserAccount } from '@/lib/account-purge'
import { sendEmail } from '@/lib/email'
import { escapeHtml, renderEmail, renderEmailLink } from '@/lib/email-template'
import { prisma } from '@/lib/prisma'
import {
  ACCOUNT_INACTIVITY_DELETION_DAYS,
  ACCOUNT_RETENTION_WARNING_DAYS,
  DEFAULT_RETENTION_POLICY_START_AT,
  PERSONAL_TRIAL_BUSINESS_DAYS,
  RETENTION_POLICY_PATH,
  addDays,
  formatRetentionDate,
  resolveAccountRetention,
} from '@/lib/retention-policy'
import { isSuperAdminEmail } from '@/lib/super-admin'

/**
 * Avisos y borrado automático por retención de cuentas.
 *
 * Flujo (lo ejecuta `scripts/account-retention.ts` o `/api/cron/account-retention`):
 *  1. Cuando vence la licencia pagada (`planValidUntil`) → correo: cuenta suspendida y data
 *     programada para eliminación.
 *  2. Cuando termina el trial de 7 días hábiles y nunca hubo licencia → correo: prueba
 *     terminada y fecha de eliminación.
 *  3. Siete días antes del borrado → correo de último aviso.
 *  4. A los 60 días sin acceso (`lastLoginAt`, o `createdAt` si nunca ingresó) → se purga la
 *     cuenta completa con `purgeUserAccount()`.
 *
 * Los avisos se registran en `account_retention_notices` con `dedupeKey`, así el trabajo puede
 * correr todos los días sin duplicar correos.
 */

const PLAN_PAGE_PATH = '/dashboard/configuracion/plan'
const DASHBOARD_PATH = '/dashboard'

function resolveAppBaseUrl(): string | null {
  const raw =
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL
  if (typeof raw !== 'string' || !raw.trim()) return null
  return raw.trim().replace(/\/+$/, '')
}

function absoluteUrl(path: string): string | null {
  const base = resolveAppBaseUrl()
  return base ? `${base}${path.startsWith('/') ? path : `/${path}`}` : null
}

/**
 * Piso del cálculo de inactividad: la fecha de activación de la política.
 * Evita que cuentas inactivas heredadas se eliminen el mismo día del despliegue.
 */
function resolveRetentionPolicyStartAt(): Date {
  const raw = process.env.RETENTION_POLICY_START_AT
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = new Date(raw.trim())
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return DEFAULT_RETENTION_POLICY_START_AT
}

function retentionPolicyFooter(): string {
  const policyUrl = absoluteUrl(RETENTION_POLICY_PATH)
  const link = policyUrl
    ? renderEmailLink(policyUrl, 'política de retención de datos')
    : `la política de retención de datos (${RETENTION_POLICY_PATH})`
  return `Política aplicada: las cuentas sin plan activo se eliminan ${ACCOUNT_INACTIVITY_DELETION_DAYS} días después del último acceso, con aviso previo ${ACCOUNT_RETENTION_WARNING_DAYS} días antes. Consulta la ${link}.`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 12px; color:#374151;">${text}</p>`
}

function bulletList(items: string[]): string {
  return `<ul style="margin:0 0 12px; padding-left:20px; color:#374151;">${items
    .map((item) => `<li style="margin:0 0 8px;">${item}</li>`)
    .join('')}</ul>`
}

export type RetentionEmailArgs = {
  kind: AccountRetentionNoticeKind
  recipientName?: string | null
  empresaNombre?: string | null
  lastActivityAt?: Date | null
  deletionAt?: Date | null
  warningAt?: Date | null
  licenseExpiredAt?: Date | null
  trialExpiredAt?: Date | null
  daysInactive?: number | null
  daysUntilDeletion?: number | null
}

export type RetentionEmail = { subject: string; html: string }

/**
 * Construye el correo (asunto + HTML) del aviso según el evento. Es una función pura para
 * poder verificarla en pruebas sin enviar nada.
 */
export function buildRetentionEmail(args: RetentionEmailArgs): RetentionEmail {
  const name = (args.recipientName ?? '').trim()
  const greeting = name ? `Hola ${escapeHtml(name)},` : 'Hola,'
  const empresa = (args.empresaNombre ?? '').trim()
  const empresaLabel = empresa ? `<b>${escapeHtml(empresa)}</b>` : 'tu espacio de trabajo'
  const subjectEmpresa = empresa ? `${empresa} · ` : ''

  const lastActivity = args.lastActivityAt ? formatRetentionDate(args.lastActivityAt) : null
  const deletionAt = args.deletionAt ? formatRetentionDate(args.deletionAt) : null
  const warningAt = args.warningAt ? formatRetentionDate(args.warningAt) : null
  const planUrl = absoluteUrl(PLAN_PAGE_PATH)
  const dashboardUrl = absoluteUrl(DASHBOARD_PATH)

  if (args.kind === 'LICENSE_EXPIRED') {
    const expiredAt = args.licenseExpiredAt ? formatRetentionDate(args.licenseExpiredAt) : null
    const html = renderEmail({
      title: 'Tu licencia venció',
      preheader: `La licencia de ${empresa || 'tu espacio'} venció. La cuenta queda suspendida y la información se eliminará si no renuevas.`,
      intro: greeting,
      bodyHtml: [
        paragraph(
          `La licencia de plan de ${empresaLabel} venció el <b>${escapeHtml(expiredAt ?? 'día de hoy')}</b>. Desde ese momento el acceso queda <b>suspendido</b>: puedes iniciar sesión con tu correo y contraseña, pero necesitas renovar para volver a operar con normalidad.`
        ),
        bulletList([
          `Si no renuevas y no vuelves a ingresar, tu cuenta y toda la información del espacio se eliminarán automáticamente el <b>${escapeHtml(deletionAt ?? `día ${ACCOUNT_INACTIVITY_DELETION_DAYS} posterior a tu último acceso`)}</b>.`,
          lastActivity
            ? `La fecha se calcula como <b>${ACCOUNT_INACTIVITY_DELETION_DAYS} días</b> después de tu último acceso registrado: <b>${escapeHtml(lastActivity)}</b>.`
            : `La fecha se calcula como <b>${ACCOUNT_INACTIVITY_DELETION_DAYS} días</b> después de tu último acceso.`,
          warningAt
            ? `Antes del borrado enviamos un último aviso al correo registrado: <b>${escapeHtml(warningAt)}</b>.`
            : 'Antes del borrado enviamos un último aviso al correo registrado.',
        ]),
        paragraph('Para conservar tu historial, renueva tu plan o ingresa a la plataforma.'),
      ].join(''),
      cta: planUrl ? { label: 'Renovar mi plan', href: planUrl } : undefined,
      footerNote: retentionPolicyFooter(),
    })

    return {
      subject: `${subjectEmpresa}tu licencia venció: la cuenta será suspendida`,
      html,
    }
  }

  if (args.kind === 'TRIAL_ENDED') {
    const expiredAt = args.trialExpiredAt ? formatRetentionDate(args.trialExpiredAt) : null
    const html = renderEmail({
      title: 'Tu prueba gratuita terminó',
      preheader: `Terminaron tus ${PERSONAL_TRIAL_BUSINESS_DAYS} días hábiles de prueba. Sin plan activo, la cuenta y sus datos se eliminan ${ACCOUNT_INACTIVITY_DELETION_DAYS} días después del último acceso.`,
      intro: greeting,
      bodyHtml: [
        paragraph(
          `Tus <b>${PERSONAL_TRIAL_BUSINESS_DAYS} días hábiles</b> de prueba en el plan Intermedio terminaron el <b>${escapeHtml(expiredAt ?? 'día de hoy')}</b>.`
        ),
        paragraph('Puedes elegir un plan para seguir trabajando sin perder lo que ya registraste.'),
        bulletList([
          deletionAt
            ? `Sin un plan activo, tu cuenta y la información de ${empresaLabel} se eliminarán automáticamente el <b>${escapeHtml(deletionAt)}</b> (${ACCOUNT_INACTIVITY_DELETION_DAYS} días después de tu último acceso).`
            : `Sin un plan activo, tu cuenta y la información de ${empresaLabel} se eliminan ${ACCOUNT_INACTIVITY_DELETION_DAYS} días después de tu último acceso.`,
          warningAt
            ? `El último aviso por correo se envía el <b>${escapeHtml(warningAt)}</b>.`
            : `El último aviso por correo se envía ${ACCOUNT_RETENTION_WARNING_DAYS} días antes del borrado.`,
          'El trial se otorga una sola vez por persona: al volver a crear un espacio no se reinicia.',
        ]),
      ].join(''),
      cta: planUrl ? { label: 'Elegir un plan', href: planUrl } : undefined,
      footerNote: retentionPolicyFooter(),
    })

    return {
      subject: `${subjectEmpresa}tu prueba gratuita terminó`,
      html,
    }
  }

  if (args.kind === 'ACCOUNT_DELETED') {
    const html = renderEmail({
      title: 'Tu cuenta fue eliminada',
      preheader: 'La cuenta y sus datos fueron eliminados por la política de retención.',
      intro: greeting,
      bodyHtml: [
        paragraph(
          `Tu cuenta y la información asociada a ${empresaLabel} fueron eliminadas por la política de retención de datos.`
        ),
        paragraph(
          `Si necesitas volver a operar, puedes crear una cuenta nueva; ten en cuenta que el trial gratuito de ${PERSONAL_TRIAL_BUSINESS_DAYS} días hábiles no se otorga dos veces a la misma persona.`
        ),
      ].join(''),
      footerNote: retentionPolicyFooter(),
    })

    return { subject: `${subjectEmpresa}tu cuenta fue eliminada`, html }
  }

  // INACTIVITY_WARNING: último aviso antes del borrado.
  const daysInactive = typeof args.daysInactive === 'number' ? args.daysInactive : null
  const daysLeft = typeof args.daysUntilDeletion === 'number' ? args.daysUntilDeletion : null
  const html = renderEmail({
    title: 'Tu cuenta está por eliminarse',
    preheader: deletionAt
      ? `Tu cuenta y sus datos se eliminarán el ${deletionAt} por inactividad.`
      : 'Tu cuenta y sus datos se eliminarán por inactividad.',
    intro: greeting,
    bodyHtml: [
      paragraph(
        lastActivity && daysInactive !== null
          ? `No registramos ingresos a tu cuenta desde el <b>${escapeHtml(lastActivity)}</b> (<b>${daysInactive} días</b>).`
          : 'No registramos ingresos recientes a tu cuenta.'
      ),
      bulletList([
        deletionAt
          ? `Según la política de retención, las cuentas sin plan activo y sin acceso durante <b>${ACCOUNT_INACTIVITY_DELETION_DAYS} días</b> se eliminan. Tu fecha programada es el <b>${escapeHtml(deletionAt)}</b>${daysLeft !== null ? ` (en ${Math.max(0, daysLeft)} día(s))` : ''}.`
          : `Según la política de retención, las cuentas sin plan activo y sin acceso durante ${ACCOUNT_INACTIVITY_DELETION_DAYS} días se eliminan.`,
        'Se elimina la cuenta, el espacio cuando es personal (o cuando es el único usuario de la empresa) y toda la información asociada.',
        'Si quieres conservar tu información, ingresa a la plataforma o renueva tu plan antes de esa fecha.',
      ]),
    ].join(''),
    cta: dashboardUrl ? { label: 'Ingresar y conservar mi cuenta', href: dashboardUrl } : undefined,
    footerNote: retentionPolicyFooter(),
  })

  return {
    subject: deletionAt
      ? `${subjectEmpresa}tu cuenta se eliminará el ${deletionAt}`
      : `${subjectEmpresa}tu cuenta está por eliminarse`,
    html,
  }
}

export type RetentionSentNotice = {
  userId: string
  email: string
  kind: AccountRetentionNoticeKind
  referenceDate: string
}

export type RetentionPurgeEntry = {
  userId: string
  email: string
  company: string | null
  rowsDeleted: number | null
}

export type RetentionRunSummary = {
  ok: boolean
  dryRun: boolean
  purgeEnabled: boolean
  now: string
  scanned: number
  sent: RetentionSentNotice[]
  wouldSend: RetentionSentNotice[]
  purged: RetentionPurgeEntry[]
  wouldPurge: RetentionPurgeEntry[]
  skipped: Record<string, number>
  errors: Array<{ userId: string; email: string; error: string }>
}

export type RetentionRunOptions = {
  now?: Date
  dryRun?: boolean
  purge?: boolean
  limit?: number
}

const RETENTION_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  lastLoginAt: true,
  empresa: {
    select: {
      id: true,
      nombre: true,
      nit: true,
      planValidUntil: true,
      trialValidUntil: true,
    },
  },
} as const

function buildDedupeKey(args: {
  kind: AccountRetentionNoticeKind
  userId: string
  referenceDate: Date
}): string {
  return `${args.kind}:${args.userId}:${args.referenceDate.toISOString().slice(0, 10)}`
}

async function hasNotice(dedupeKey: string): Promise<boolean> {
  const found = await prisma.accountRetentionNotice.findUnique({ where: { dedupeKey }, select: { id: true } })
  return Boolean(found?.id)
}

async function markNoticeSent(args: {
  userId: string
  kind: AccountRetentionNoticeKind
  referenceDate: Date
  metadata: Prisma.InputJsonValue
}): Promise<void> {
  try {
    await prisma.accountRetentionNotice.create({
      data: {
        userId: args.userId,
        kind: args.kind,
        channel: 'EMAIL',
        referenceDate: args.referenceDate,
        dedupeKey: buildDedupeKey(args),
        metadata: args.metadata,
      },
    })
  } catch (error) {
    // Carrera entre dos ejecuciones simultáneas: el aviso ya quedó registrado.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return
    throw error
  }
}

/**
 * Recalcula el estado justo antes de borrar para no eliminar una cuenta que volvió a ingresar
 * o que renovó su plan mientras corría el trabajo.
 */
async function isStillDeletionDue(
  userId: string,
  now: Date,
  policyStartAt: Date
): Promise<{ due: boolean; email: string } | null> {
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      createdAt: true,
      lastLoginAt: true,
      empresa: { select: { planValidUntil: true, trialValidUntil: true } },
    },
  })
  if (!fresh) return null

  const state = resolveAccountRetention({
    now,
    createdAt: fresh.createdAt,
    lastLoginAt: fresh.lastLoginAt,
    isSuperAdmin: isSuperAdminEmail(fresh.email),
    planValidUntil: fresh.empresa?.planValidUntil ?? null,
    trialValidUntil: fresh.empresa?.trialValidUntil ?? null,
    policyStartAt,
  })

  return { due: state.stage === 'DELETION_DUE', email: fresh.email }
}

/**
 * Ejecuta los avisos y (opcionalmente) el borrado automático.
 *
 * - `dryRun: true` calcula todo pero **no envía correos ni elimina nada**.
 * - `purge: false` envía los avisos pero no elimina cuentas.
 */
export async function runAccountRetention(options: RetentionRunOptions = {}): Promise<RetentionRunSummary> {
  const now = options.now ?? new Date()
  const dryRun = options.dryRun === true
  const purgeEnabled = options.purge !== false && !dryRun
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 2000)

  const summary: RetentionRunSummary = {
    ok: true,
    dryRun,
    purgeEnabled,
    now: now.toISOString(),
    scanned: 0,
    sent: [],
    wouldSend: [],
    purged: [],
    wouldPurge: [],
    skipped: {},
    errors: [],
  }

  const bumpSkip = (reason: string) => {
    summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1
  }

  const inactiveCutoff = addDays(now, -ACCOUNT_RETENTION_WARNING_DAYS)
  const policyStartAt = resolveRetentionPolicyStartAt()

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { lastLoginAt: { lte: inactiveCutoff } },
        { lastLoginAt: null, createdAt: { lte: inactiveCutoff } },
        { empresa: { is: { planValidUntil: { not: null, lte: now } } } },
        { empresa: { is: { planValidUntil: null, trialValidUntil: { not: null, lte: now } } } },
      ],
    },
    select: RETENTION_USER_SELECT,
    orderBy: [{ lastLoginAt: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  })

  for (const user of users) {
    summary.scanned += 1

    const state = resolveAccountRetention({
      now,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      isSuperAdmin: isSuperAdminEmail(user.email),
      planValidUntil: user.empresa?.planValidUntil ?? null,
      trialValidUntil: user.empresa?.trialValidUntil ?? null,
      policyStartAt,
    })

    if (state.stage === 'EXEMPT') {
      bumpSkip(state.exemption === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ACTIVE_PLAN')
      continue
    }

    const empresaNombre = user.empresa?.nombre ?? null
    const notices: Array<{ kind: AccountRetentionNoticeKind; referenceDate: Date }> = []

    if (state.licenseExpiredAt) {
      notices.push({ kind: 'LICENSE_EXPIRED', referenceDate: state.licenseExpiredAt })
    } else if (state.trialExpiredAt) {
      notices.push({ kind: 'TRIAL_ENDED', referenceDate: state.trialExpiredAt })
    }

    if (state.stage === 'WARNING' && state.deletionAt) {
      notices.push({ kind: 'INACTIVITY_WARNING', referenceDate: state.deletionAt })
    }

    for (const notice of notices) {
      const dedupeKey = buildDedupeKey({ ...notice, userId: user.id })
      try {
        if (await hasNotice(dedupeKey)) {
          bumpSkip('ALREADY_NOTIFIED')
          continue
        }

        const payload: RetentionSentNotice = {
          userId: user.id,
          email: user.email,
          kind: notice.kind,
          referenceDate: notice.referenceDate.toISOString(),
        }

        if (dryRun) {
          summary.wouldSend.push(payload)
          continue
        }

        const email = buildRetentionEmail({
          kind: notice.kind,
          recipientName: user.name,
          empresaNombre,
          lastActivityAt: state.lastActivityAt,
          deletionAt: state.deletionAt,
          warningAt: state.warningAt,
          licenseExpiredAt: state.licenseExpiredAt,
          trialExpiredAt: state.trialExpiredAt,
          daysInactive: state.daysInactive,
          daysUntilDeletion: state.daysUntilDeletion,
        })

        const send = await sendEmail({ to: user.email, subject: email.subject, html: email.html })
        if (!send.ok) {
          summary.errors.push({ userId: user.id, email: user.email, error: send.error })
          continue
        }

        await markNoticeSent({
          userId: user.id,
          kind: notice.kind,
          referenceDate: notice.referenceDate,
          metadata: {
            empresaId: user.empresa?.id ?? null,
            empresaNombre,
            reason: notice.kind,
            deletionAt: state.deletionAt ? state.deletionAt.toISOString() : null,
            warningAt: state.warningAt ? state.warningAt.toISOString() : null,
            lastActivityAt: state.lastActivityAt.toISOString(),
            lastActivitySource: state.lastActivitySource,
            daysInactive: state.daysInactive,
          },
        })

        summary.sent.push(payload)
      } catch (error) {
        summary.errors.push({
          userId: user.id,
          email: user.email,
          error: error instanceof Error ? error.message : 'Error inesperado al notificar',
        })
      }
    }

    if (state.stage !== 'DELETION_DUE') continue

    try {
      const preview = await previewAccountDeletion({ userId: user.id })
      if (!preview) {
        bumpSkip('ALREADY_DELETED')
        continue
      }

      if (preview.companyUserCount > 1) {
        // Empresa compartida: nunca se borra la información de otros usuarios.
        bumpSkip('COMPANY_HAS_OTHER_USERS')
        continue
      }

      const entry: RetentionPurgeEntry = {
        userId: user.id,
        email: user.email,
        company: preview.empresa?.nombre ?? null,
        rowsDeleted: null,
      }

      if (!purgeEnabled) {
        summary.wouldPurge.push(entry)
        continue
      }

      const recheck = await isStillDeletionDue(user.id, now, policyStartAt)
      if (!recheck) {
        bumpSkip('ALREADY_DELETED')
        continue
      }
      if (!recheck.due) {
        bumpSkip('REACTIVATED')
        continue
      }

      const result = await purgeUserAccount({ userId: user.id })
      const rowsDeleted = Object.values(result.rowsByTable).reduce((total, count) => total + count, 0)
      summary.purged.push({ ...entry, company: result.company?.nombre ?? entry.company, rowsDeleted })
    } catch (error) {
      summary.errors.push({
        userId: user.id,
        email: user.email,
        error: error instanceof Error ? error.message : 'Error inesperado al eliminar la cuenta',
      })
    }
  }

  return summary
}

