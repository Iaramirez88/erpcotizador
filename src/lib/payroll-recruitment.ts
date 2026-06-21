import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { type PayrollRecruitmentCandidateRow } from '@/lib/payroll'

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

export async function ensurePayrollRecruitmentDemoData(empresaId: string, userId?: string | null) {
  const count = await prisma.payrollRecruitmentCandidate.count({ where: { empresaId } })
  if (count) return

  const ownerUserId = userId ?? (await prisma.user.findFirst({ where: { empresaId }, orderBy: [{ createdAt: 'asc' }], select: { id: true } }))?.id ?? null

  await prisma.payrollRecruitmentCandidate.createMany({
    data: [
      {
        id: randomUUID(),
        empresaId,
        ownerUserId,
        openingTitle: 'Analista de nómina',
        department: 'Operaciones de nómina',
        locationLabel: 'Bogotá híbrido',
        candidateName: 'Laura Rodríguez',
        candidateEmail: 'laura.rodriguez.demo@sgdigital.test',
        candidatePhone: '3001112233',
        source: 'REFERIDO',
        stage: 'SCREENING',
        status: 'ACTIVO',
        score: 78,
        salaryExpectation: 3200000,
        expectedStartDate: daysFromNow(18),
        interviewerNotes: 'Buen manejo de seguridad social y novedades; falta validar cierre contable.',
      },
      {
        id: randomUUID(),
        empresaId,
        ownerUserId,
        openingTitle: 'Coordinador de talento',
        department: 'Gestión de personas',
        locationLabel: 'Medellín presencial',
        candidateName: 'Andrés Pérez',
        candidateEmail: 'andres.perez.demo@sgdigital.test',
        candidatePhone: '3104445566',
        source: 'LINKEDIN',
        stage: 'ENTREVISTA',
        status: 'ACTIVO',
        score: 86,
        salaryExpectation: 5200000,
        expectedStartDate: daysFromNow(25),
        interviewerNotes: 'Fuerte en cultura y liderazgo; programar entrevista con dirección.',
      },
      {
        id: randomUUID(),
        empresaId,
        ownerUserId,
        openingTitle: 'Business partner HR',
        department: 'People analytics',
        locationLabel: 'Remoto',
        candidateName: 'Mariana Castaño',
        candidateEmail: 'mariana.castano.demo@sgdigital.test',
        candidatePhone: '3158889900',
        source: 'BOLSA_EMPLEO',
        stage: 'OFERTA',
        status: 'FINALISTA',
        score: 92,
        salaryExpectation: 6100000,
        expectedStartDate: daysFromNow(12),
        interviewerNotes: 'Perfil sólido para despliegue de people analytics y acompañamiento de líderes.',
        decisionSummary: 'Aprobada para oferta final condicionada a referencias.',
      },
    ],
  })
}

export async function serializePayrollRecruitmentCandidates(empresaId: string): Promise<PayrollRecruitmentCandidateRow[]> {
  const rows = await prisma.payrollRecruitmentCandidate.findMany({
    where: { empresaId },
    orderBy: [{ createdAt: 'desc' }],
    include: {
      ownerUser: { select: { name: true, email: true } },
    },
  })

  return rows.map((item) => ({
    id: item.id,
    ownerName: item.ownerUser?.name ?? item.ownerUser?.email ?? null,
    openingTitle: item.openingTitle,
    department: item.department,
    locationLabel: item.locationLabel,
    candidateName: item.candidateName,
    candidateEmail: item.candidateEmail,
    candidatePhone: item.candidatePhone,
    source: item.source,
    stage: item.stage,
    status: item.status,
    score: item.score,
    salaryExpectation: item.salaryExpectation,
    expectedStartDate: iso(item.expectedStartDate),
    interviewerNotes: item.interviewerNotes,
    decisionSummary: item.decisionSummary,
    resumeUrl: item.resumeUrl,
  }))
}
