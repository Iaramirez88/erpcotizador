import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { sendEmail } from '../src/lib/email'
import { sendWhatsApp } from '../src/lib/whatsapp'
import {
  DEFAULT_WEBSITE_SERVICE_TEMPLATE_META,
  DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS,
  buildWebsiteServiceReminderEmail,
  buildWebsiteServiceReminderWhatsappMessage,
  getWebsiteServiceDueItemsAtThreshold,
  mergeWebsiteServiceMessageTemplate,
  mergeWebsiteServiceReminderSettings,
  normalizeReminderPhone,
} from '../src/lib/website-service-reminders'

async function main() {
  const now = new Date()
  const services = await prisma.websiteService.findMany({
    where: {
      isCancelled: false,
      OR: [{ domainExpiresAt: { not: null } }, { hostingExpiresAt: { not: null } }],
    },
    select: {
      id: true,
      empresaId: true,
      nombre: true,
      websiteUrl: true,
      domainName: true,
      hostedAt: true,
      domainExpiresAt: true,
      hostingExpiresAt: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
      empresa: { select: { nombre: true } },
    },
  })

  const empresaIds = Array.from(new Set(services.map((service) => service.empresaId)))
  const settingsRows = empresaIds.length
    ? await prisma.websiteServiceReminderSetting.findMany({
        where: { empresaId: { in: empresaIds } },
        select: {
          empresaId: true,
          daysBefore: true,
          emailSubjectTemplate: true,
          emailBodyTemplate: true,
          whatsappTemplate: true,
          isEmailEnabled: true,
          isWhatsAppEnabled: true,
        },
      })
    : []

  const templateRows = empresaIds.length
    ? await prisma.websiteServiceMessageTemplate.findMany({
        where: {
          empresaId: { in: empresaIds },
          serviceKind: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.serviceKind,
          triggerKind: DEFAULT_WEBSITE_SERVICE_TEMPLATE_META.triggerKind,
          isActive: true,
        },
        orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      })
    : []

  const settingsByEmpresa = new Map(
    settingsRows.map((row) => [row.empresaId, mergeWebsiteServiceReminderSettings(row)])
  )
  const templateByEmpresa = new Map<string, ReturnType<typeof mergeWebsiteServiceMessageTemplate>>()
  for (const template of templateRows) {
    if (!templateByEmpresa.has(template.empresaId)) {
      templateByEmpresa.set(template.empresaId, mergeWebsiteServiceMessageTemplate(template))
    }
  }

  let scanned = 0
  let due = 0
  let sentEmail = 0
  let sentWhatsAppCount = 0

  for (const service of services) {
    scanned += 1

    const settings = templateByEmpresa.get(service.empresaId)
      ?? settingsByEmpresa.get(service.empresaId)
      ?? DEFAULT_WEBSITE_SERVICE_REMINDER_SETTINGS
    const dueItems = getWebsiteServiceDueItemsAtThreshold(service, now, settings.daysBefore)
    if (dueItems.length === 0) continue

    due += 1

    const existingLogs = await prisma.websiteServiceReminderLog.findMany({
      where: {
        websiteServiceId: service.id,
        daysBefore: settings.daysBefore,
        dueAt: { in: dueItems.map((item) => item.dueAt) },
      },
      select: { dueKind: true, dueAt: true, channel: true },
    })

    const pendingForChannel = (channel: string) =>
      dueItems.filter((item) => {
        return !existingLogs.some(
          (log) =>
            log.channel === channel &&
            log.dueKind === item.kind &&
            log.dueAt.getTime() === item.dueAt.getTime()
        )
      })

    const empresaNombre = service.empresa.nombre || 'SGDigital'
    const contactEmail = (service.contactEmail ?? '').trim()
    const contactPhone = service.contactPhone ? normalizeReminderPhone(service.contactPhone) : ''

    const emailDueItems = settings.isEmailEnabled ? pendingForChannel('EMAIL') : []
    if (contactEmail && emailDueItems.length > 0) {
      const email = buildWebsiteServiceReminderEmail({
        empresaNombre,
        service,
        dueItems: emailDueItems,
        settings,
      })

      const send = await sendEmail({ to: contactEmail, subject: email.subject, html: email.html })
      if (send.ok) {
        await prisma.websiteServiceReminderLog.createMany({
          data: emailDueItems.map((item) => ({
            empresaId: service.empresaId,
            websiteServiceId: service.id,
            dueKind: item.kind,
            dueAt: item.dueAt,
            daysBefore: settings.daysBefore,
            channel: 'EMAIL',
            sentAt: new Date(),
          })),
        })
        sentEmail += 1
      } else {
        console.warn(`[WEBSITE_SERVICE_EMAIL] ${service.id} (${service.nombre}) -> ${contactEmail}: ${send.error}`)
      }
    }

    const whatsappDueItems = settings.isWhatsAppEnabled ? pendingForChannel('WHATSAPP') : []
    if (contactPhone && whatsappDueItems.length > 0) {
      const message = buildWebsiteServiceReminderWhatsappMessage({
        empresaNombre,
        service,
        dueItems: whatsappDueItems,
        settings,
      })

      const send = await sendWhatsApp({ to: contactPhone, message })
      if (send.ok) {
        await prisma.websiteServiceReminderLog.createMany({
          data: whatsappDueItems.map((item) => ({
            empresaId: service.empresaId,
            websiteServiceId: service.id,
            dueKind: item.kind,
            dueAt: item.dueAt,
            daysBefore: settings.daysBefore,
            channel: 'WHATSAPP',
            sentAt: new Date(),
          })),
        })
        sentWhatsAppCount += 1
      } else {
        console.warn(`[WEBSITE_SERVICE_WHATSAPP] ${service.id} (${service.nombre}) -> ${contactPhone}: ${send.error}`)
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scanned,
        due,
        sent: {
          email: sentEmail,
          whatsapp: sentWhatsAppCount,
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