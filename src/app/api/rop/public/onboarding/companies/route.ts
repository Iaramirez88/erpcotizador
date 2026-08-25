import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const companies = await prisma.ropCompany.findMany({
    where: {
      archivedAt: null,
      onboardingStatus: 'ACTIVE',
      visibilityLevel: 'PUBLIC',
      empresaId: { not: null },
    },
    select: {
      id: true,
      empresaId: true,
      legalName: true,
      brandName: true,
      city: true,
      region: true,
      verificationStatus: true,
      descriptionPublic: true,
      services: {
        take: 3,
        orderBy: { createdAt: 'asc' },
        select: {
          serviceCatalog: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: [{ verificationStatus: 'asc' }, { updatedAt: 'desc' }],
    take: 36,
  })

  const empresaIds = Array.from(new Set(companies.map((company) => company.empresaId).filter(Boolean))) as string[]

  const empresas = empresaIds.length
    ? await prisma.empresa.findMany({
        where: { id: { in: empresaIds } },
        select: {
          id: true,
          workspaceCode: true,
          registrationCodeHash: true,
        },
      })
    : []

  const empresaById = new Map(empresas.map((empresa) => [empresa.id, empresa]))

  return NextResponse.json({
    ok: true,
    data: companies
      .map((company) => {
        const empresa = company.empresaId ? empresaById.get(company.empresaId) : null
        if (!empresa?.workspaceCode) return null

        return {
          id: company.id,
          title: company.brandName || company.legalName,
          legalName: company.legalName,
          city: company.city,
          region: company.region,
          verificationStatus: company.verificationStatus,
          description: company.descriptionPublic,
          workspaceCode: empresa.workspaceCode,
          requiresAccessCode: Boolean(empresa.registrationCodeHash),
          services: company.services.map((service) => service.serviceCatalog.name),
        }
      })
      .filter(Boolean),
  })
}