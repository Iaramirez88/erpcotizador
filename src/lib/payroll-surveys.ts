import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { type PayrollSurveyCampaignRow } from '@/lib/payroll'

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export async function ensurePayrollSurveyDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollSurveyCampaign.count({ where: { empresaId } })
  if (count) return

  const ownerUserId = userId ?? (await prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }))?.id ?? null

  await prisma.payrollSurveyCampaign.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        ownerUserId,
        title: 'Pulso de clima de cierre de nómina',
        category: 'CLIMA',
        status: 'ACTIVA',
        anonymous: true,
        audience: 'Operaciones de nómina',
        channel: 'PORTAL',
        questionsCount: 8,
        invitedCount: 14,
        responsesCount: 11,
        averageScore: 4.3,
        opensAt: daysAgo(2),
        closesAt: daysFromNow(5),
        summary: 'Mide carga operativa, soporte interáreas y percepción del cierre actual.',
      },
      {
        id: randomUUID(),
        empresaId,
        ownerUserId,
        title: 'Feedback onboarding 30 días',
        category: 'ONBOARDING',
        status: 'PROGRAMADA',
        anonymous: false,
        audience: 'Nuevos ingresos',
        channel: 'EMAIL',
        questionsCount: 10,
        invitedCount: 6,
        responsesCount: 0,
        opensAt: daysFromNow(3),
        closesAt: daysFromNow(12),
        summary: 'Valida calidad de inducción, acceso a herramientas y relación con el líder.',
      },
      {
        id: randomUUID(),
        empresaId,
        ownerUserId,
        title: 'Encuesta de beneficios flexibles Q2',
        category: 'BENEFICIOS',
        status: 'CERRADA',
        anonymous: true,
        audience: 'Toda la empresa',
        channel: 'PORTAL',
        questionsCount: 6,
        invitedCount: 48,
        responsesCount: 39,
        averageScore: 4.6,
        opensAt: daysAgo(20),
        closesAt: daysAgo(10),
        summary: 'Consolida interés por planes flexibles, packs de descuentos y percepción de valor.',
        notes: 'Se prioriza ampliar convenios de salud y educación.',
      },
    ],
  })
}

export async function serializePayrollSurveyCampaigns(empresaId: string): Promise<PayrollSurveyCampaignRow[]> {
  const rows = await prisma.payrollSurveyCampaign.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      ownerUser: { select: { name: true, email: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    ownerName: item.ownerUser?.name ?? item.ownerUser?.email ?? null,
    title: item.title,
    category: item.category,
    status: item.status,
    anonymous: item.anonymous,
    audience: item.audience,
    channel: item.channel,
    questionsCount: item.questionsCount,
    invitedCount: item.invitedCount,
    responsesCount: item.responsesCount,
    averageScore: item.averageScore,
    opensAt: iso(item.opensAt),
    closesAt: iso(item.closesAt),
    summary: item.summary,
    notes: item.notes,
  }))
}
