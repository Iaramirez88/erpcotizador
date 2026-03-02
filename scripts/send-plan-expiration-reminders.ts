/**
 * Recordatorios de vencimiento de plan
 *
 * Ejecutar: npx tsx scripts/send-plan-expiration-reminders.ts
 *
 * Envía:
 * - Mensual: 5 días antes de vencimiento
 * - Anual: 15 días antes de vencimiento
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { sendEmail } from '../src/lib/email'
import { sendWhatsApp } from '../src/lib/whatsapp'
import { ensurePlanOwnerUserIdForEmpresa } from '../src/lib/plan-owner'
import { escapeHtml, renderEmail } from '../src/lib/email-template'

function dateOnlyUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function daysUntilUTC(validUntil: Date, now: Date): number {
  const diffMs = dateOnlyUTC(validUntil) - dateOnlyUTC(now)
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

function normalizePhone(raw: string): string {
  // Mínimo: quitar espacios. (El proveedor final puede requerir E.164)
  return raw.trim()
}

async function main() {
  const now = new Date()

  const empresas = await prisma.empresa.findMany({
    where: { planValidUntil: { not: null } },
    select: {
      id: true,
      nombre: true,
      email: true,
      telefono: true,
      planTier: true,
      billingCycle: true,
      planValidUntil: true,
      planOwnerUserId: true,
    },
  })

  let scanned = 0
  let sentEmail = 0
  let sentWhatsAppCount = 0

  for (const e of empresas) {
    scanned += 1

    const validUntil = e.planValidUntil
    if (!validUntil) continue

    const cycle = e.billingCycle
    const threshold = cycle === 'MONTHLY' ? 5 : 15

    const left = daysUntilUTC(validUntil, now)
    if (left !== threshold) continue

    // Resolver owner (por si aún está null en data antigua)
    const ownerUserId = e.planOwnerUserId ?? (await ensurePlanOwnerUserIdForEmpresa(e.id))

    const ownerEmail = ownerUserId
      ? (await prisma.user.findUnique({ where: { id: ownerUserId }, select: { email: true } }))?.email ?? null
      : null

    const toEmail = (e.email ?? ownerEmail ?? '').trim()
    const toPhone = e.telefono ? normalizePhone(e.telefono) : ''

    const subject = `${e.nombre} · Ordex — Tu plan vence en ${threshold} día(s)`

    const html = renderEmail({
      title: 'Recordatorio de vencimiento',
      preheader: `${e.nombre}: tu plan vence en ${threshold} día(s).`,
      intro: `${e.nombre}: tu plan vence pronto.`,
      bodyHtml: `
        <p style="margin:0 0 12px; color:#374151;">Tu plan (<b>${escapeHtml(String(e.planTier))}</b> · ${cycle === 'YEARLY' ? 'Anual' : 'Mensual'}) vence en <b>${threshold} día(s)</b>.</p>
        <p style="margin:0 0 12px; color:#374151;">Vigencia hasta: <b>${escapeHtml(new Intl.DateTimeFormat('es-CO', { dateStyle: 'full' }).format(validUntil))}</b></p>
        <p style="margin:0; color:#374151;">Para renovar, ingresa con el usuario administrador y ve a <b>Configuración → Plan</b>.</p>
      `,
    })

    const message = `SGDigital: el plan de ${e.nombre} vence en ${threshold} día(s). Vigente hasta ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' }).format(validUntil)}. Renueva en Configuración → Plan.`

    // EMAIL (idempotente)
    if (toEmail) {
      const already = await prisma.billingReminderLog.findFirst({
        where: {
          empresaId: e.id,
          planValidUntil: validUntil,
          billingCycle: cycle,
          daysBefore: threshold,
          channel: 'EMAIL',
        },
        select: { id: true },
      })

      if (!already) {
        const send = await sendEmail({ to: toEmail, subject, html })
        if (send.ok) {
          await prisma.billingReminderLog.create({
            data: {
              empresaId: e.id,
              planValidUntil: validUntil,
              billingCycle: cycle,
              daysBefore: threshold,
              channel: 'EMAIL',
              sentAt: new Date(),
            },
            select: { id: true },
          })
          sentEmail += 1
        } else {
          console.warn(`[EMAIL] ${e.id} (${e.nombre}) -> ${toEmail}: ${send.error}`)
        }
      }
    }

    // WHATSAPP (idempotente)
    if (toPhone) {
      const already = await prisma.billingReminderLog.findFirst({
        where: {
          empresaId: e.id,
          planValidUntil: validUntil,
          billingCycle: cycle,
          daysBefore: threshold,
          channel: 'WHATSAPP',
        },
        select: { id: true },
      })

      if (!already) {
        const send = await sendWhatsApp({ to: toPhone, message })
        if (send.ok) {
          await prisma.billingReminderLog.create({
            data: {
              empresaId: e.id,
              planValidUntil: validUntil,
              billingCycle: cycle,
              daysBefore: threshold,
              channel: 'WHATSAPP',
              sentAt: new Date(),
            },
            select: { id: true },
          })
          sentWhatsAppCount += 1
        } else {
          console.warn(`[WHATSAPP] ${e.id} (${e.nombre}) -> ${toPhone}: ${send.error}`)
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scanned,
        sent: { email: sentEmail, whatsapp: sentWhatsAppCount },
      },
      null,
      2
    )
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null)
  })
