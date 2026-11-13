import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeString } from '@/lib/crm'
import { getBookingSettings, normalizeBookingDateKey } from '@/lib/crm-booking-settings'
import {
  buildBookingAvailability,
  resolveBookingAppointmentDuration,
  toBookingDateKey,
} from '@/lib/crm-booking-availability'
import {
  extractHostFromUrl,
  getPublicWebFormSettings,
  getReferrerHost,
  getRequestHost,
  isPublicWebFormDomainAllowed,
} from '@/lib/crm-public-web-form'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function readDays(value: string | null) {
  const parsed = Number.parseInt(value || '', 10)
  if (!Number.isFinite(parsed)) return 45
  return Math.max(1, Math.min(92, parsed))
}

function isAllDayTask(dueAt: Date | null) {
  if (!dueAt) return true
  return dueAt.getHours() === 0 && dueAt.getMinutes() === 0 && dueAt.getSeconds() === 0
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = normalizeString(searchParams.get('channelId'))
    const fromDateKey = normalizeBookingDateKey(searchParams.get('from')) || toBookingDateKey(new Date())
    const days = readDays(searchParams.get('days'))

    if (!channelId) {
      return NextResponse.json({ error: 'channelId es requerido' }, { status: 400 })
    }

    const channel = await prisma.crmChannelConnection.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        empresaId: true,
        sedeId: true,
        settingsJson: true,
        verifyToken: true,
      },
    })

    if (!channel || channel.provider !== 'WEB_FORM') {
      return NextResponse.json({ error: 'Canal booking no encontrado' }, { status: 404 })
    }
    if (!['TESTING', 'ACTIVE'].includes(channel.status)) {
      return NextResponse.json({ error: 'Canal no disponible para agendamiento' }, { status: 409 })
    }

    const publicSettings = getPublicWebFormSettings(channel.settingsJson)
    if (!publicSettings.publicEmbedEnabled) {
      return NextResponse.json({ error: 'Agenda pública deshabilitada' }, { status: 403 })
    }

    const referrerHost = await getReferrerHost()
    const requestHost = await getRequestHost()
    const candidateHost = referrerHost && referrerHost !== requestHost ? referrerHost : extractHostFromUrl(request.url)
    if (referrerHost && referrerHost !== requestHost && !isPublicWebFormDomainAllowed({
      allowedDomains: publicSettings.allowedDomains,
      candidateHost,
    })) {
      return NextResponse.json({ error: 'Dominio no autorizado para la agenda' }, { status: 403 })
    }

    const settings = getBookingSettings(channel.settingsJson)
    const rangeStart = new Date(`${fromDateKey}T00:00:00`)
    const rangeEnd = new Date(rangeStart)
    rangeEnd.setDate(rangeEnd.getDate() + days + 1)

    const tasks = await prisma.crmTask.findMany({
      where: {
        empresaId: channel.empresaId,
        dueAt: { gte: rangeStart, lt: rangeEnd },
        status: { in: ['OPEN', 'DONE'] },
        archivedAt: null,
        ...(channel.sedeId ? { OR: [{ sedeId: channel.sedeId }, { sedeId: null }] } : {}),
      },
      select: {
        id: true,
        dueAt: true,
        description: true,
      },
      orderBy: { dueAt: 'asc' },
    })

    const appointments = tasks
      .filter((task) => !isAllDayTask(task.dueAt))
      .map((task) => ({
        startsAt: task.dueAt as Date,
        durationMinutes: resolveBookingAppointmentDuration(task.description, settings.durationMinutes),
      }))

    const availabilityDays = buildBookingAvailability({
      settings,
      fromDateKey,
      days,
      appointments,
    })

    return NextResponse.json({
      success: true,
      data: {
        channelId: channel.id,
        channelName: channel.name,
        from: fromDateKey,
        days: availabilityDays,
        settings: {
          durationMinutes: settings.durationMinutes,
          durationLabel: settings.durationLabel,
          slotIntervalMinutes: settings.slotIntervalMinutes,
          capacityPerSlot: settings.capacityPerSlot,
          minNoticeMinutes: settings.minNoticeMinutes,
          maxAdvanceDays: settings.maxAdvanceDays,
          timezoneLabel: settings.timezoneLabel,
          businessHours: settings.businessHours,
          blockedDates: settings.blockedDates,
        },
        generatedAt: new Date().toISOString(),
      },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Error calculando disponibilidad de agenda:', error)
    return NextResponse.json({ error: 'No se pudo calcular la disponibilidad de la agenda' }, { status: 500 })
  }
}
